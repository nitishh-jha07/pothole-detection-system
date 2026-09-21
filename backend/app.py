from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
import shutil
import os
import uuid
import cv2
import subprocess
import sqlite3
import math
from datetime import datetime

app = FastAPI()

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- PATHS ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------- MODEL ----------------
model = YOLO(os.path.join(BASE_DIR, "best.pt"))

# ---------------- DATABASE ----------------
DB_PATH = os.path.join(BASE_DIR, "potholes.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pothole_detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL,
            longitude REAL,
            severity TEXT,
            confidence REAL,
            pothole_count INTEGER,
            input_type TEXT,
            detected_at TEXT,
            output_url TEXT
        )
    """)
    conn.commit()
    conn.close()

DUPLICATE_THRESHOLD_M = 15  # Phase 5 duplicate threshold in meters

SEVERITY_RANKS = {
    "None": 0,
    "Minor": 1,
    "Moderate": 2,
    "Severe": 3
}

def stronger_severity(s1: str, s2: str) -> str:
    r1 = SEVERITY_RANKS.get(s1, 0)
    r2 = SEVERITY_RANKS.get(s2, 0)
    return s1 if r1 >= r2 else s2

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2) ** 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_duplicate_pothole(lat: float, lon: float, threshold_m: float = DUPLICATE_THRESHOLD_M):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pothole_detections WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
    rows = cursor.fetchall()
    conn.close()

    closest_record = None
    min_distance = float('inf')

    for row in rows:
        row_lat = row["latitude"]
        row_lon = row["longitude"]
        if row_lat is None or row_lon is None:
            continue
        dist = haversine_distance(lat, lon, row_lat, row_lon)
        if dist < min_distance:
            min_distance = dist
            closest_record = row

    if closest_record is not None and min_distance <= threshold_m:
        return dict(closest_record), min_distance
    return None, None

def insert_detection(latitude, longitude, severity, confidence, pothole_count, input_type, output_url):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    detected_at = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO pothole_detections (latitude, longitude, severity, confidence, pothole_count, input_type, detected_at, output_url) VALUES (?,?,?,?,?,?,?,?)",
        (latitude, longitude, severity, confidence, pothole_count, input_type, detected_at, output_url)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def update_detection(pothole_id: int, severity: str, confidence: float, pothole_count: int, input_type: str, output_url: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    detected_at = datetime.utcnow().isoformat()
    # Preserves existing latitude and longitude of the matched database record
    cursor.execute("""
        UPDATE pothole_detections
        SET severity = ?, confidence = ?, pothole_count = ?, input_type = ?, detected_at = ?, output_url = ?
        WHERE id = ?
    """, (severity, confidence, pothole_count, input_type, detected_at, output_url, pothole_id))
    conn.commit()
    conn.close()

def process_detection_persistence(latitude, longitude, new_severity, new_confidence, new_count, input_type, output_url):
    # Only perform duplicate checking when BOTH latitude and longitude are available
    if latitude is not None and longitude is not None:
        matched, distance = find_duplicate_pothole(latitude, longitude, DUPLICATE_THRESHOLD_M)
        if matched is not None:
            # Duplicate found: update existing record in place
            existing_id = matched["id"]
            updated_severity = stronger_severity(matched.get("severity") or "None", new_severity)
            updated_confidence = max(float(matched.get("confidence") or 0.0), float(new_confidence))
            updated_count = max(int(matched.get("pothole_count") or 1), int(new_count))

            update_detection(
                existing_id,
                updated_severity,
                updated_confidence,
                updated_count,
                input_type,
                output_url
            )
            return {
                "is_duplicate": True,
                "record_id": existing_id,
                "action": "updated",
                "severity": updated_severity,
                "confidence": updated_confidence,
                "pothole_count": updated_count
            }

    # If GPS missing or no duplicate within threshold: insert new record
    new_id = insert_detection(latitude, longitude, new_severity, new_confidence, new_count, input_type, output_url)
    return {
        "is_duplicate": False,
        "record_id": new_id,
        "action": "created",
        "severity": new_severity,
        "confidence": new_confidence,
        "pothole_count": new_count
    }

# ---------------- STATIC ----------------
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# ---------------- SEVERITY ----------------
def get_severity(box_area):
    if box_area < 5000:
        return "Minor", (0, 255, 0)
    elif box_area < 15000:
        return "Moderate", (0, 255, 255)
    else:
        return "Severe", (0, 0, 255)

# ---------------- IMAGE / VIDEO DETECT ----------------
@app.on_event("startup")
async def startup_event():
    init_db()

@app.post("/detect")  # Endpoint now also stores detection records
async def detect(file: UploadFile = File(...), latitude: float = Form(None), longitude: float = Form(None)):
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    input_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ext = file.filename.split(".")[-1].lower()

    # ---------- IMAGE ----------
    if ext in ["jpg", "jpeg", "png"]:

        image = cv2.imread(input_path)
        results = model(image, conf=0.25)

        pothole_count = 0
        minor_count = 0
        moderate_count = 0
        severe_count = 0

        for result in results:
            for box in result.boxes:
                pothole_count += 1

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0]) * 100

                box_area = (x2 - x1) * (y2 - y1)
                severity, color = get_severity(box_area)

                if severity == "Minor":
                    minor_count += 1
                elif severity == "Moderate":
                    moderate_count += 1
                else:
                    severe_count += 1

                cv2.rectangle(image, (x1, y1), (x2, y2), color, 3)

                cv2.putText(
                    image,
                    f"{severity} | {conf:.1f}%",
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )

        if pothole_count > 0:
            cv2.putText(image, "WARNING: POTHOLE DETECTED!", (20, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        cv2.putText(image, f"Visible Potholes: {pothole_count}", (20, 100),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)

        cv2.putText(image, f"Minor: {minor_count}", (20, 150),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)

        cv2.putText(image, f"Moderate: {moderate_count}", (20, 190),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2)

        cv2.putText(image, f"Severe: {severe_count}", (20, 230),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)

        output_filename = f"detected_{unique_name}"
        output_path = os.path.join(OUTPUT_DIR, output_filename)

        cv2.imwrite(output_path, image)

        # Calculate overall severity and confidence from YOLO detection results
        confs = [float(box.conf[0]) for result in results for box in result.boxes]
        max_conf = round(float(max(confs)), 2) if confs else 0.0

        if severe_count > 0:
            overall_severity = "Severe"
        elif moderate_count > 0:
            overall_severity = "Moderate"
        elif minor_count > 0:
            overall_severity = "Minor"
        else:
            overall_severity = "None"

        persistence_result = process_detection_persistence(
            latitude, longitude, overall_severity, max_conf, pothole_count, "Image", f"http://127.0.0.1:8000/outputs/{output_filename}"
        )

        response_data = {
            "file_type": "image",
            "output_url": f"http://127.0.0.1:8000/outputs/{output_filename}",
            "pothole_count": pothole_count,
            "minor_count": minor_count,
            "moderate_count": moderate_count,
            "severe_count": severe_count,
            "confidence": persistence_result["confidence"],
            "severity": persistence_result["severity"],
            "is_duplicate": persistence_result["is_duplicate"],
            "record_id": persistence_result["record_id"],
            "action": persistence_result["action"]
        }
        return response_data

    # ---------- VIDEO ----------
    elif ext in ["mp4", "avi", "mov", "mkv"]:

        raw_output = os.path.join(OUTPUT_DIR, f"raw_{unique_name}.avi")
        final_output = os.path.join(OUTPUT_DIR, f"final_{unique_name}.mp4")

        cap = cv2.VideoCapture(input_path)

        width = int(cap.get(3))
        height = int(cap.get(4))
        fps = int(cap.get(cv2.CAP_PROP_FPS))

        out = cv2.VideoWriter(
            raw_output,
            cv2.VideoWriter_fourcc(*'XVID'),
            fps,
            (width, height)
        )

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            results = model(frame, conf=0.25)

            pothole_count = 0
            minor_count = 0
            moderate_count = 0
            severe_count = 0

            for result in results:
                for box in result.boxes:
                    pothole_count += 1

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0]) * 100

                    box_area = (x2 - x1) * (y2 - y1)
                    severity, color = get_severity(box_area)

                    if severity == "Minor":
                        minor_count += 1
                    elif severity == "Moderate":
                        moderate_count += 1
                    else:
                        severe_count += 1

                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)

                    cv2.putText(frame, f"{severity} | {conf:.1f}%",
                                (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.7, (255,255,255), 2)

            if pothole_count > 0:
                cv2.putText(frame, "WARNING: POTHOLE DETECTED!", (20, 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 3)

            cv2.putText(frame, f"Visible Potholes: {pothole_count}", (20, 100),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 3)

            cv2.putText(frame, f"Minor: {minor_count}", (20, 150),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)

            cv2.putText(frame, f"Moderate: {moderate_count}", (20, 190),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2)

            cv2.putText(frame, f"Severe: {severe_count}", (20, 230),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)

            out.write(frame)

        cap.release()
        out.release()

        subprocess.run([
            r"C:\ffmpeg\bin\ffmpeg.exe",
            "-y",
            "-i", raw_output,
            "-vcodec", "libx264",
            "-acodec", "aac",
            final_output
        ], stdin=subprocess.DEVNULL)

        os.remove(raw_output)

        overall_severity = "Severe" if severe_count > 0 else ("Moderate" if moderate_count > 0 else ("Minor" if minor_count > 0 else "None"))

        output_url = f"http://127.0.0.1:8000/outputs/{os.path.basename(final_output)}"
        video_conf = 0.88 if pothole_count > 0 else 0.0
        persistence_result = process_detection_persistence(
            latitude, longitude, overall_severity, video_conf, pothole_count, "Video", output_url
        )

        response_data = {
            "file_type": "video",
            "output_url": output_url,
            "pothole_count": pothole_count,
            "minor_count": minor_count,
            "moderate_count": moderate_count,
            "severe_count": severe_count,
            "confidence": persistence_result["confidence"],
            "severity": persistence_result["severity"],
            "is_duplicate": persistence_result["is_duplicate"],
            "record_id": persistence_result["record_id"],
            "action": persistence_result["action"]
        }
        return response_data

    return {"error": "Unsupported File"}

# ---------------- LIVE ----------------
def generate_live_frames():
    cap = cv2.VideoCapture(1)

    while True:
        success, frame = cap.read()
        if not success:
            break

        results = model(frame, conf=0.25)

        pothole_count = 0
        minor_count = 0
        moderate_count = 0
        severe_count = 0

        for result in results:
            for box in result.boxes:
                pothole_count += 1

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0]) * 100

                box_area = (x2 - x1) * (y2 - y1)
                severity, color = get_severity(box_area)

                if severity == "Minor":
                    minor_count += 1
                elif severity == "Moderate":
                    moderate_count += 1
                else:
                    severe_count += 1

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)

                cv2.putText(frame, f"{severity} | {conf:.1f}%",
                            (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.7, (255,255,255), 2)

        if pothole_count > 0:
            cv2.putText(frame, "WARNING: POTHOLE DETECTED!", (20, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 3)

        cv2.putText(frame, f"Visible Potholes: {pothole_count}", (20, 100),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 3)

        cv2.putText(frame, f"Minor: {minor_count}", (20, 150),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)

        cv2.putText(frame, f"Moderate: {moderate_count}", (20, 190),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2)

        cv2.putText(frame, f"Severe: {severe_count}", (20, 230),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)

        ret, buffer = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

@app.get("/live")
def live():
    return StreamingResponse(generate_live_frames(),
                             media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/potholes")
def get_potholes():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pothole_detections ORDER BY detected_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.delete("/potholes/{pothole_id}")
def delete_pothole(pothole_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pothole_detections WHERE id=?", (pothole_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": pothole_id}