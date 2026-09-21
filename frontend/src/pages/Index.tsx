import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import DetectionDashboard from "@/components/DetectionDashboard";
import LocationTracker from "@/components/LocationTracker";
import DetectionHistory from "@/components/DetectionHistory";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import AlertManagement from "@/components/AlertManagement";
import WorkflowSection from "@/components/WorkflowSection";
import FooterSection from "@/components/FooterSection";
import type { DetectionRecord } from "@/types/pothole";
import {
  getStoredDetectionHistory,
  saveDetectionHistory,
  generateNextDetectionId,
  deleteDetectionRecord,
  clearDetectionHistory,
} from "@/lib/detectionStorage";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Persistent Detection History State (single source of truth)
  const [history, setHistory] = useState<DetectionRecord[]>(() =>
    getStoredDetectionHistory()
  );

  // Target coordinates for "View on Map" navigation
  const [focusTarget, setFocusTarget] = useState<{
    latitude: number;
    longitude: number;
    id: string;
  } | null>(null);

  // Load persisted DB records on mount
  const loadPersistentRecords = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/potholes");
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      const mapped: DetectionRecord[] = data.map((item: any) => {
        const dt = new Date(item.detected_at);
        return {
          id: String(item.id),
          date: dt.toLocaleDateString(),
          time: dt.toLocaleTimeString(),
          latitude: item.latitude,
          longitude: item.longitude,
          potholeCount: item.pothole_count,
          severity: item.severity,
          confidence: item.confidence,
          inputType: (item.input_type?.charAt(0).toUpperCase() +
            item.input_type?.slice(1).toLowerCase()) as any,
          outputUrl: item.output_url,
        };
      });
      setHistory((prev) => {
        const recordMap = new Map<string, DetectionRecord>();
        for (const item of mapped) {
          recordMap.set(String(item.id), item);
        }
        for (const item of prev) {
          if (!recordMap.has(String(item.id))) {
            recordMap.set(String(item.id), item);
          }
        }
        return Array.from(recordMap.values());
      });
    } catch (e) {
      console.error('Failed to load persistent pothole records', e);
    }
  };

  useEffect(() => {
    loadPersistentRecords();
  }, []);

  const handleNewDetection = (incoming: DetectionRecord) => {
    setHistory((prev) => {
      const targetId = String(incoming.id);

      if (incoming.action === "updated" || incoming.isDuplicate) {
        // If an entry with targetId exists in prev, update it in-place
        const exists = prev.some((r) => String(r.id) === targetId);
        let updated: DetectionRecord[];
        if (exists) {
          updated = prev.map((r) => {
            if (String(r.id) === targetId) {
              return {
                ...r,
                date: incoming.date,
                time: incoming.time,
                severity: incoming.severity,
                confidence: incoming.confidence,
                potholeCount: incoming.potholeCount,
                outputUrl: incoming.outputUrl || r.outputUrl,
                description: incoming.description || r.description,
                inputType: incoming.inputType || r.inputType,
              };
            }
            return r;
          });
        } else {
          updated = [incoming, ...prev];
        }
        saveDetectionHistory(updated);
        return updated;
      }

      // Action is "created": assign ID if not provided, or use incoming.id
      const id = incoming.id ? String(incoming.id) : generateNextDetectionId(prev);
      const recordWithId: DetectionRecord = {
        ...incoming,
        id,
      };
      // Prepend without duplicate IDs
      const updated = [recordWithId, ...prev.filter((r) => String(r.id) !== String(id))];
      saveDetectionHistory(updated);
      return updated;
    });

    // Re-synchronize with persistent records from backend
    loadPersistentRecords();
  };

  // Handler to delete a single detection record
  const handleDeleteRecord = (id: string) => {
    const updated = deleteDetectionRecord(id);
    setHistory(updated);
    if (focusTarget?.id === id) {
      setFocusTarget(null);
    }
  };

  // Handler to clear all history records
  const handleClearHistory = () => {
    clearDetectionHistory();
    setHistory([]);
    setFocusTarget(null);
  };

  // Handler to smoothly scroll to map and focus marker
  const handleViewOnMap = (record: DetectionRecord) => {
    setFocusTarget({
      latitude: record.latitude,
      longitude: record.longitude,
      id: record.id,
    });
    const mapElement =
      document.getElementById("dashboard") ||
      document.getElementById("pothole-map");
    mapElement?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {showSplash && (
          <SplashScreen onComplete={() => setShowSplash(false)} />
        )}
      </AnimatePresence>

      {!showSplash && (
        <>
          <Navbar />

          <HeroSection />

          <DetectionDashboard
            latitude={latitude}
            longitude={longitude}
            onNewDetection={handleNewDetection}
          />

          <LocationTracker
            latitude={latitude}
            longitude={longitude}
            setLatitude={setLatitude}
            setLongitude={setLongitude}
            records={history}
            focusTarget={focusTarget}
          />

          <DetectionHistory
            records={history}
            onDeleteRecord={handleDeleteRecord}
            onClearHistory={handleClearHistory}
            onViewOnMap={handleViewOnMap}
          />

          <AnalyticsDashboard
            records={history}
            onViewOnMap={(lat, lng, id) => {
              setFocusTarget({
                latitude: lat,
                longitude: lng,
                id,
              });
              const mapElement =
                document.getElementById("dashboard") ||
                document.getElementById("pothole-map");
              mapElement?.scrollIntoView({ behavior: "smooth" });
            }}
          />

          <AlertManagement />

          <WorkflowSection />

          <FooterSection />
        </>
      )}
    </div>
  );
};

export default Index;