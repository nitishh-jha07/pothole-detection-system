import { useEffect, useState, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { Navigation, Wifi, AlertTriangle, CheckCircle2 } from "lucide-react";
import PotholeMap from "./PotholeMap";
import { SectionHeader } from "./DetectionDashboard";
import RouteSessionSummary from "./RouteSessionSummary";
import SafetyAlertBanner from "./SafetyAlertBanner";
import type { DetectionRecord, PotholeSeverity } from "@/types/pothole";
import type { RouteSession, RouteCoordinate, EncounteredPothole } from "@/types/route";
import type { ActiveAlertData } from "@/types/alert";
import { initialRouteSession } from "@/types/route";
import {
  haversineDistance,
  ROUTE_ASSOCIATION_THRESHOLD_M,
  getSeverityAlertThreshold,
  getSeverityRearmDistance,
} from "@/lib/geoUtils";
import {
  getAudioEnabled,
  setAudioEnabled,
  playSafetyAlertChime,
} from "@/lib/audioAlert";

interface LocationTrackerProps {
  latitude: number | null;
  longitude: number | null;
  setLatitude: Dispatch<SetStateAction<number | null>>;
  setLongitude: Dispatch<SetStateAction<number | null>>;
  records?: DetectionRecord[];
  focusTarget?: { latitude: number; longitude: number; id: string } | null;
  onSelectPothole?: (record: DetectionRecord) => void;
}

const SEVERITY_RANK: Record<PotholeSeverity, number> = {
  Severe: 3,
  Moderate: 2,
  Minor: 1,
};

const LocationTracker = ({
  latitude,
  longitude,
  setLatitude,
  setLongitude,
  records = [],
  focusTarget,
  onSelectPothole,
}: LocationTrackerProps) => {
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // ---------------- PHASE 6: ROUTE MONITORING SESSION STATE ----------------
  const [session, setSession] = useState<RouteSession>(() => {
    try {
      const saved = sessionStorage.getItem("activeRouteSession");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to restore route session from sessionStorage:", e);
    }
    return initialRouteSession;
  });

  // Sync session with sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("activeRouteSession", JSON.stringify(session));
    } catch (e) {
      console.error("Failed to save route session to sessionStorage:", e);
    }
  }, [session]);

  // Set of encountered pothole IDs for O(1) lookups
  const encounteredPotholeIds = useMemo(
    () => new Set(session.encounteredPotholes.map((e) => e.potholeId)),
    [session.encounteredPotholes]
  );

  // Route Control Handlers
  const handleStartRoute = () => {
    const startPoint: RouteCoordinate[] =
      latitude !== null && longitude !== null
        ? [{ latitude, longitude, timestamp: Date.now() }]
        : [];

    const newSession: RouteSession = {
      id: `ROUTE-${Date.now()}`,
      status: "active",
      startTime: new Date().toISOString(),
      endTime: null,
      path: startPoint,
      distanceTraveledMeters: 0,
      encounteredPotholes: [],
      summary: {
        totalEncountered: 0,
        severeCount: 0,
        moderateCount: 0,
        minorCount: 0,
      },
    };
    setSession(newSession);
  };

  const handleStopRoute = () => {
    setSession((prev) => ({
      ...prev,
      status: "completed",
      endTime: new Date().toISOString(),
    }));
  };

  const handleResetRoute = () => {
    setSession(initialRouteSession);
    try {
      sessionStorage.removeItem("activeRouteSession");
    } catch (e) {}
  };

  // ---------------- PHASE 7: REAL-TIME SAFETY ALERT STATE ----------------
  const [audioEnabled, setAudioEnabledState] = useState<boolean>(() => getAudioEnabled());
  const [activeAlert, setActiveAlert] = useState<ActiveAlertData | null>(null);
  const [dismissedPotholeIds, setDismissedPotholeIds] = useState<Set<string>>(new Set());

  // Ref to track which potholes have already played a chime in their current approach episode
  const chimedPotholeIdsRef = useRef<Set<string>>(new Set());

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    setAudioEnabledState(next);
  };

  const handleDismissAlert = (potholeId: string) => {
    setDismissedPotholeIds((prev) => new Set(prev).add(potholeId));
    setActiveAlert(null);
  };

  // ---------------- BROWSER GEOLOCATION WATCHER ----------------
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setAccuracy(position.coords.accuracy);
        setError("");
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [setLatitude, setLongitude]);

  // ---------------- ROUTE BREADCRUMB & ENCOUNTER LOGIC (PHASE 6) ----------------
  useEffect(() => {
    if (session.status !== "active" || latitude === null || longitude === null) {
      return;
    }

    // Filter 1: GPS Jitter - ignore tiny displacements (< 3 meters) to avoid stationary drift
    const lastCoord = session.path[session.path.length - 1];
    let segmentDist = 0;
    if (lastCoord) {
      segmentDist = haversineDistance(
        lastCoord.latitude,
        lastCoord.longitude,
        latitude,
        longitude
      );
      if (segmentDist < 3) {
        return;
      }
    }

    const newCoord: RouteCoordinate = {
      latitude,
      longitude,
      timestamp: Date.now(),
    };

    // Filter 2: Proximity evaluation against persistent pothole records (threshold = 25m)
    const LAT_LON_DELTA = 0.0004; // ~44m bounding box pre-filter
    const currentEncounteredIds = new Set(
      session.encounteredPotholes.map((ep) => ep.potholeId)
    );
    const newlyEncountered: EncounteredPothole[] = [];

    for (const r of records) {
      if (
        !r ||
        r.latitude === null ||
        r.longitude === null ||
        typeof r.latitude !== "number" ||
        typeof r.longitude !== "number"
      ) {
        continue;
      }
      const pid = String(r.id);
      if (currentEncounteredIds.has(pid)) {
        continue;
      }

      if (
        Math.abs(r.latitude - latitude) < LAT_LON_DELTA &&
        Math.abs(r.longitude - longitude) < LAT_LON_DELTA
      ) {
        const dist = haversineDistance(latitude, longitude, r.latitude, r.longitude);
        if (dist <= ROUTE_ASSOCIATION_THRESHOLD_M) {
          newlyEncountered.push({
            potholeId: pid,
            record: r,
            encounteredAt: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            distanceAtEncounter: dist,
          });
          currentEncounteredIds.add(pid);
        }
      }
    }

    setSession((prev) => {
      const updatedPath = [...prev.path, newCoord];
      const updatedDistance = prev.distanceTraveledMeters + segmentDist;

      if (newlyEncountered.length === 0) {
        return {
          ...prev,
          path: updatedPath,
          distanceTraveledMeters: updatedDistance,
        };
      }

      const allEncountered = [...newlyEncountered, ...prev.encounteredPotholes];
      const severeCount = allEncountered.filter(
        (e) => e.record.severity === "Severe"
      ).length;
      const moderateCount = allEncountered.filter(
        (e) => e.record.severity === "Moderate"
      ).length;
      const minorCount = allEncountered.filter(
        (e) => e.record.severity === "Minor"
      ).length;

      return {
        ...prev,
        path: updatedPath,
        distanceTraveledMeters: updatedDistance,
        encounteredPotholes: allEncountered,
        summary: {
          totalEncountered: allEncountered.length,
          severeCount,
          moderateCount,
          minorCount,
        },
      };
    });
  }, [latitude, longitude, session.status, records]);

  // ---------------- REAL-TIME POTHOLE SAFETY ALERT ENGINE (PHASE 7) ----------------
  useEffect(() => {
    // If coordinates are missing, clear alerts
    if (latitude === null || longitude === null) {
      setActiveAlert(null);
      return;
    }

    // If GPS accuracy is poor (> 35m), suppress new alerts
    const isAccuracyLow = accuracy !== null && accuracy > 35;
    if (isAccuracyLow) {
      setActiveAlert(null);
      return;
    }

    // Scan persistent pothole records using lightweight spatial bounding box (approx 65m)
    const BOX_DELTA = 0.0006;
    const eligibleAlerts: {
      potholeId: string;
      record: DetectionRecord;
      severity: PotholeSeverity;
      distance: number;
      threshold: number;
      rearmDistance: number;
      rank: number;
    }[] = [];

    // Temporary set to record which dismissed IDs are still within re-arm distance
    const unRearmedDismissed = new Set(dismissedPotholeIds);

    for (const r of records) {
      if (
        !r ||
        r.latitude === null ||
        r.longitude === null ||
        typeof r.latitude !== "number" ||
        typeof r.longitude !== "number"
      ) {
        continue;
      }

      const pid = String(r.id);
      const threshold = getSeverityAlertThreshold(r.severity);
      const rearmDist = getSeverityRearmDistance(r.severity);

      // Fast bounding box pre-filter before haversine
      if (
        Math.abs(r.latitude - latitude) < BOX_DELTA &&
        Math.abs(r.longitude - longitude) < BOX_DELTA
      ) {
        const dist = haversineDistance(latitude, longitude, r.latitude, r.longitude);

        // Hysteresis re-arm check: if distance exceeds severity threshold + 10m, re-arm
        if (dist > rearmDist) {
          unRearmedDismissed.delete(pid);
          chimedPotholeIdsRef.current.delete(pid);
        } else if (dist <= threshold) {
          // Inside severity-specific alert threshold!
          eligibleAlerts.push({
            potholeId: pid,
            record: r,
            severity: r.severity,
            distance: dist,
            threshold,
            rearmDistance: rearmDist,
            rank: SEVERITY_RANK[r.severity] || 1,
          });
        }
      } else {
        // Outside bounding box (> 65m): automatically re-armed
        unRearmedDismissed.delete(pid);
        chimedPotholeIdsRef.current.delete(pid);
      }
    }

    // Update dismissed potholes with re-armed state
    if (unRearmedDismissed.size !== dismissedPotholeIds.size) {
      setDismissedPotholeIds(unRearmedDismissed);
    }

    // If no potholes are currently in their severity-specific alert zone
    if (eligibleAlerts.length === 0) {
      setActiveAlert(null);
      return;
    }

    // Prioritization:
    // 1. Severity: Severe > Moderate > Minor (higher rank first)
    // 2. Distance: nearer > farther (ascending distance)
    eligibleAlerts.sort((a, b) => {
      if (b.rank !== a.rank) {
        return b.rank - a.rank;
      }
      return a.distance - b.distance;
    });

    const primary = eligibleAlerts[0];
    const additionalCount = eligibleAlerts.length - 1;

    // If user dismissed this pothole for this approach episode, keep visual banner suppressed
    if (unRearmedDismissed.has(primary.potholeId)) {
      setActiveAlert(null);
      return;
    }

    // One chime per approach episode
    if (!chimedPotholeIdsRef.current.has(primary.potholeId)) {
      playSafetyAlertChime(primary.severity);
      chimedPotholeIdsRef.current.add(primary.potholeId);
    }

    // Set active alert data for UI and map
    setActiveAlert({
      potholeId: primary.potholeId,
      record: primary.record,
      severity: primary.severity,
      distance: primary.distance,
      threshold: primary.threshold,
      rearmDistance: primary.rearmDistance,
      confidence: primary.record.confidence,
      additionalCount,
    });
  }, [latitude, longitude, records, accuracy, dismissedPotholeIds]);

  const isAccuracyLow = accuracy !== null && accuracy > 35;

  return (
    <section id="dashboard" className="relative py-16">
      <div className="container mx-auto px-4">
        <SectionHeader
          title="GPS Location & Road Monitoring"
          subtitle="Real-time browser GPS tracking and live spatial pothole mapping"
        />

        {/* GPS Error Alert if any */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">GPS Tracking Notice</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* GPS Coordinate Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Latitude */}
          <div className="glass-card p-4 border border-border flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Latitude</p>
              <p className="text-lg font-mono font-semibold text-foreground">
                {latitude !== null ? latitude.toFixed(6) : "Acquiring..."}
              </p>
            </div>
          </div>

          {/* Longitude */}
          <div className="glass-card p-4 border border-border flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-neon-cyan/10 text-neon-cyan">
              <Navigation className="w-5 h-5 rotate-90" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Longitude</p>
              <p className="text-lg font-mono font-semibold text-foreground">
                {longitude !== null ? longitude.toFixed(6) : "Acquiring..."}
              </p>
            </div>
          </div>

          {/* GPS Status & Accuracy */}
          <div className="glass-card p-4 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                {latitude !== null ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Wifi className="w-5 h-5 animate-pulse text-amber-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">GPS Signal</p>
                <p className="text-sm font-semibold text-foreground">
                  {latitude !== null ? "Live Satellite Fix" : "Connecting..."}
                </p>
              </div>
            </div>
            {accuracy !== null && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                ±{Math.round(accuracy)}m
              </span>
            )}
          </div>
        </div>

        {/* Phase 6: Road / Route-Level Monitoring Controller & Summary */}
        <RouteSessionSummary
          session={session}
          onStartRoute={handleStartRoute}
          onStopRoute={handleStopRoute}
          onResetRoute={handleResetRoute}
          hasGpsFix={latitude !== null && longitude !== null}
        />

        {/* Phase 7: Real-Time Pothole Safety Alert Banner */}
        <SafetyAlertBanner
          alert={activeAlert}
          onDismiss={handleDismissAlert}
          audioEnabled={audioEnabled}
          onToggleAudio={handleToggleAudio}
          isAccuracyLow={isAccuracyLow}
        />

        {/* Upgraded Interactive Pothole Map Synchronized with Detection History, Active Route, and Safety Warnings */}
        <PotholeMap
          latitude={latitude}
          longitude={longitude}
          records={records}
          focusTarget={focusTarget}
          onSelectPothole={onSelectPothole}
          routePath={session.path}
          encounteredPotholeIds={encounteredPotholeIds}
          activeAlertPotholeId={activeAlert?.potholeId || null}
        />
      </div>
    </section>
  );
};

export default LocationTracker;