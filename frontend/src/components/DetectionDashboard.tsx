import { Upload, Camera, MapPin, AlertOctagon, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { DetectionRecord, PotholeSeverity } from "@/types/pothole";

/* ---------------- SECTION HEADER EXPORT ---------------- */
export const SectionHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => (
  <div className="text-center mb-10">
    <h2 className="text-4xl font-bold font-heading">{title}</h2>
    <p className="text-muted-foreground mt-2">{subtitle}</p>
  </div>
);

/* ---------------- PROPS ---------------- */
interface DetectionDashboardProps {
  latitude: number | null;
  longitude: number | null;
  onNewDetection?: (record: DetectionRecord) => void;
}

/* ---------------- MAIN DASHBOARD ---------------- */
const DetectionDashboard = ({
  latitude,
  longitude,
  onNewDetection,
}: DetectionDashboardProps) => {
  const [outputFile, setOutputFile] = useState("");
  const [fileType, setFileType] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [lastDetectionStats, setLastDetectionStats] = useState<{
    potholeCount: number;
    severity: PotholeSeverity;
    confidence: number;
    isDuplicate?: boolean;
    recordId?: string;
    action?: "created" | "updated";
  } | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setLiveMode(false);
    setLastDetectionStats(null);

    const formData = new FormData();
    formData.append("file", file);
        if (latitude !== null && longitude !== null) {
          formData.append("latitude", latitude.toString());
          formData.append("longitude", longitude.toString());
        }

    try {
      const res = await fetch("http://127.0.0.1:8000/detect", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      setOutputFile(data.output_url);
      setFileType(data.file_type);

      const potholeCount = data.pothole_count ?? 0;
      const severity: PotholeSeverity =
        data.severity === "Severe" || data.severity === "Moderate" || data.severity === "Minor"
          ? data.severity
          : "Moderate";
      const confidence = data.confidence ?? 0.88;
      const isDuplicate: boolean = !!data.is_duplicate;
      const recordId: string = data.record_id ? String(data.record_id) : "";
      const action: "created" | "updated" = data.action === "updated" ? "updated" : "created";

      if (potholeCount > 0) {
        setLastDetectionStats({
          potholeCount,
          severity,
          confidence,
          isDuplicate,
          recordId,
          action,
        });

        // Emit new detection record to sync with persistent history and map
        if (onNewDetection) {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const hours = String(now.getHours()).padStart(2, "0");
          const mins = String(now.getMinutes()).padStart(2, "0");
          const secs = String(now.getSeconds()).padStart(2, "0");

          const lat = latitude !== null ? Number(latitude.toFixed(6)) : null;
          const lng = longitude !== null ? Number(longitude.toFixed(6)) : null;

          const newRecord: DetectionRecord = {
            id: recordId || "", // Uses backend database ID
            date: `${year}-${month}-${day}`,
            time: `${hours}:${mins}:${secs}`,
            latitude: lat,
            longitude: lng,
            potholeCount,
            severity,
            confidence,
            inputType: data.file_type === "video" ? "Video" : "Image",
            outputUrl: data.output_url,
            description: `${potholeCount} potholes detected via ${data.file_type}`,
            isDuplicate,
            action,
          };

          onNewDetection(newRecord);
        }
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred during detection.");
    }

    setLoading(false);
  };

  const toggleLiveDetection = () => {
    setLiveMode(!liveMode);

    if (!liveMode) {
      setOutputFile("");
      setFileType("");
      setLastDetectionStats(null);
    }
  };

  return (
    <section id="detection" className="relative py-24">
      <div className="container mx-auto px-4">
        <SectionHeader
          title="Smart Detection Dashboard"
          subtitle="Upload pothole images/videos or use live webcam detection"
        />

        {/* GPS STATUS */}
        <div className="mb-6 p-4 border rounded-xl flex items-center gap-3 glass-card">
          <MapPin className="text-neon-cyan" />

          <div>
            <p className="font-semibold text-foreground text-sm">Detection Location Coordinates</p>

            {latitude !== null && longitude !== null ? (
              <p className="text-sm font-mono text-muted-foreground">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </p>
            ) : (
              <p className="text-sm text-yellow-400">Waiting for GPS location...</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Panel */}
          <div className="space-y-4">
            <label className="p-6 border border-border rounded-xl cursor-pointer block glass-card hover:border-primary/50 transition-colors">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/60 transition-colors">
                <Upload className="w-10 h-10 mx-auto mb-3 text-primary" />

                <p className="text-sm font-medium text-foreground">Upload Image / Video for Detection</p>
                <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, MP4, AVI</p>

                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </label>

            <button
              onClick={toggleLiveDetection}
              className={`w-full p-4 border rounded-xl flex items-center justify-center gap-3 transition-all font-medium text-sm ${
                liveMode
                  ? "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/20"
                  : "border-border glass-card hover:border-neon-cyan/50 text-foreground"
              }`}
            >
              <Camera className={liveMode ? "text-destructive" : "text-neon-cyan"} />

              <span>{liveMode ? "Stop Live Detection" : "Start Live Detection"}</span>
            </button>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-2 border border-border rounded-xl p-4 glass-card flex flex-col justify-between">
            <div>
              {liveMode ? (
                <img
                  src="http://127.0.0.1:8000/live"
                  alt="Live Detection"
                  className="rounded-lg w-full"
                />
              ) : loading ? (
                <div className="aspect-video flex items-center justify-center text-primary animate-pulse font-medium">
                  Detecting Potholes via YOLO...
                </div>
              ) : outputFile ? (
                fileType === "video" ? (
                  <video controls className="rounded-lg w-full">
                    <source src={outputFile} type="video/mp4" />
                  </video>
                ) : (
                  <img
                    src={outputFile}
                    alt="Detection Result"
                    className="rounded-lg w-full"
                  />
                )
              ) : (
                <div className="aspect-video flex items-center justify-center text-muted-foreground text-sm">
                  Upload Image / Video or Start Live Detection to view results
                </div>
              )}
            </div>

            {/* Real Detection Feedback Badge */}
            {lastDetectionStats && (
              <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-foreground">
                    YOLO Detection Completed:
                  </span>
                  <span className="text-foreground">
                    {lastDetectionStats.potholeCount} {lastDetectionStats.potholeCount === 1 ? "Pothole" : "Potholes"} Found
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-semibold uppercase ${
                    lastDetectionStats.severity === "Severe"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : lastDetectionStats.severity === "Moderate"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    {lastDetectionStats.severity}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {lastDetectionStats.confidence <= 1 ? Math.round(lastDetectionStats.confidence * 100) : Math.round(lastDetectionStats.confidence)}% Confidence
                  </span>
                  <span className="text-neon-cyan font-medium">
                    {lastDetectionStats.action === "updated"
                      ? "• Existing Pothole Updated"
                      : "• New Pothole Registered"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DetectionDashboard;