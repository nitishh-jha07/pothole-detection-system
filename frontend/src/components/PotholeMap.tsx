import { useState, useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  Crosshair,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Layers,
  MapPin,
  Eye,
  Filter,
  History,
} from "lucide-react";
import type { DetectionRecord, PotholeSeverity } from "@/types/pothole";
import { haversineDistance, PROXIMITY_THRESHOLD_M } from "@/lib/geoUtils";

/* ---------------- CUSTOM LEAFLET DIV ICONS ---------------- */

const createCurrentLocationIcon = () =>
  L.divIcon({
    className: "custom-current-location-marker",
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: leaflet-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: rgba(59, 130, 246, 0.3);"></div>
        <div style="position: relative; width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; border: 2.5px solid #ffffff; box-shadow: 0 0 10px #3b82f6;"></div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const createPotholeIcon = (
  severity: PotholeSeverity,
  isFocused: boolean = false,
  isEncountered: boolean = false,
  isActiveAlert: boolean = false
) => {
  let color = "#10b981"; // Minor: emerald/green
  let pulseColor = "rgba(16, 185, 129, 0.45)";
  const stroke = isFocused ? "#38bdf8" : isActiveAlert ? "#ef4444" : isEncountered ? "#06b6d4" : "#ffffff";
  const scale = isFocused ? 1.25 : isActiveAlert ? 1.25 : isEncountered ? 1.15 : 1;

  if (severity === "Severe") {
    color = "#ef4444"; // Severe: red
    pulseColor = "rgba(239, 68, 68, 0.55)";
  } else if (severity === "Moderate") {
    color = "#f59e0b"; // Moderate: amber/orange
    pulseColor = "rgba(245, 158, 11, 0.45)";
  }

  return L.divIcon({
    className: `custom-pothole-marker-${severity.toLowerCase()}${isEncountered ? " encountered-marker" : ""}${isActiveAlert ? " active-alert-marker" : ""}`,
    html: `
      <div style="position: relative; width: ${34 * scale}px; height: ${34 * scale}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${pulseColor}; animation: leaflet-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        ${
          isActiveAlert
            ? `<div style="position: absolute; width: ${42 * scale}px; height: ${42 * scale}px; border-radius: 50%; border: 2.5px solid #ef4444; background: rgba(239, 68, 68, 0.2); animation: leaflet-ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite; box-shadow: 0 0 16px #ef4444;"></div>`
            : ""
        }
        ${
          isEncountered
            ? `<div style="position: absolute; width: ${38 * scale}px; height: ${38 * scale}px; border-radius: 50%; border: 2px dashed #06b6d4; animation: spin 6s linear infinite; box-shadow: 0 0 12px rgba(6, 182, 212, 0.5);"></div>`
            : ""
        }
        <div style="position: relative; width: ${24 * scale}px; height: ${24 * scale}px; border-radius: 50%; background: ${color}; border: ${
          isFocused ? "3px" : isActiveAlert ? "3px" : isEncountered ? "2.5px" : "2px"
        } solid ${stroke}; box-shadow: 0 0 ${
          isFocused ? "16px #38bdf8" : isActiveAlert ? "20px #ef4444" : isEncountered ? "16px #06b6d4" : `12px ${color}`
        }; display: flex; align-items: center; justify-content: center;">
          <svg width="${12 * scale}" height="${12 * scale}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34 * scale, 34 * scale],
    iconAnchor: [(17 * scale), (17 * scale)],
    popupAnchor: [0, -(17 * scale)],
  });
};

/* ---------------- MAP CONTROLLER COMPONENT ---------------- */

interface MapControllerProps {
  latitude: number | null;
  longitude: number | null;
  recenterTrigger: number;
  focusTarget?: { latitude: number; longitude: number; id: string } | null;
}

const MapController = ({
  latitude,
  longitude,
  recenterTrigger,
  focusTarget,
}: MapControllerProps) => {
  const map = useMap();

  // Handle fly to focus target from "View on Map"
  useEffect(() => {
    if (focusTarget && focusTarget.latitude && focusTarget.longitude) {
      map.flyTo([focusTarget.latitude, focusTarget.longitude], 17, {
        duration: 1.2,
      });
    }
  }, [focusTarget, map]);

  // Handle recenter to current GPS
  useEffect(() => {
    if (recenterTrigger > 0 && latitude !== null && longitude !== null) {
      map.flyTo([latitude, longitude], 16, {
        duration: 1.2,
      });
    }
  }, [recenterTrigger, latitude, longitude, map]);

  return null;
};

/* ---------------- COMPONENT PROPS ---------------- */

export interface PotholeMapProps {
  latitude: number | null;
  longitude: number | null;
  records?: DetectionRecord[];
  focusTarget?: { latitude: number; longitude: number; id: string } | null;
  onSelectPothole?: (record: DetectionRecord) => void;
  routePath?: { latitude: number; longitude: number }[];
  encounteredPotholeIds?: Set<string>;
  activeAlertPotholeId?: string | null;
}

/* ---------------- MAIN POTHOLE MAP COMPONENT ---------------- */

export const PotholeMap = ({
  latitude,
  longitude,
  records = [],
  focusTarget,
  onSelectPothole,
  routePath,
  encounteredPotholeIds,
  activeAlertPotholeId,
}: PotholeMapProps) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>("All");
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);
  const [dbRecords, setDbRecords] = useState<DetectionRecord[]>([]);

  // Memoize Leaflet polyline points from route path
  const routePositions = useMemo(() => {
    if (!routePath || routePath.length < 2) return [];
    return routePath.map((pt) => [pt.latitude, pt.longitude] as [number, number]);
  }, [routePath]);

  // Fetch persistent records from backend
  useEffect(() => {
    let isMounted = true;
    const fetchPersistentPotholes = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/potholes");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
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
            inputType: (item.input_type
              ? item.input_type.charAt(0).toUpperCase() + item.input_type.slice(1).toLowerCase()
              : "Image") as any,
            outputUrl: item.output_url,
          };
        });
        setDbRecords(mapped);
      } catch (err) {
        console.error("Failed to fetch persistent potholes:", err);
      }
    };

    fetchPersistentPotholes();
    return () => {
      isMounted = false;
    };
  }, []);

  // Default coordinate if GPS is pending
  const defaultPosition: [number, number] = [20.5937, 78.9629];
  const centerPosition: [number, number] =
    latitude !== null && longitude !== null
      ? [latitude, longitude]
      : defaultPosition;

  // Merge records from props with dbRecords, deduplicating by id and ignoring invalid/null coordinates
  const allValidRecords = useMemo(() => {
    const combined = [...records, ...dbRecords];
    const seen = new Set<string>();
    const unique: DetectionRecord[] = [];

    for (const r of combined) {
      if (
        !r ||
        r.latitude === null ||
        r.longitude === null ||
        typeof r.latitude !== "number" ||
        typeof r.longitude !== "number" ||
        isNaN(r.latitude) ||
        isNaN(r.longitude)
      ) {
        continue;
      }
      const key = String(r.id);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }
    return unique;
  }, [records, dbRecords]);

  // Recalculate distance and isKnown whenever latitude or longitude change
  const processedRecords = useMemo(() => {
    const hasGPS =
      latitude !== null &&
      longitude !== null &&
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      !isNaN(latitude) &&
      !isNaN(longitude);

    return allValidRecords.map((record) => {
      let distance: number | undefined = undefined;
      let isKnown = false;

      if (
        hasGPS &&
        record.latitude !== null &&
        record.longitude !== null
      ) {
        distance = haversineDistance(
          latitude,
          longitude,
          record.latitude,
          record.longitude
        );
        isKnown = distance <= PROXIMITY_THRESHOLD_M;
      }

      return {
        ...record,
        distance,
        isKnown,
      };
    });
  }, [allValidRecords, latitude, longitude]);

  // Filter records based on selected severity filter
  const filteredRecords = useMemo(() => {
    if (selectedSeverity === "All") return processedRecords;
    return processedRecords.filter((p) => p.severity === selectedSeverity);
  }, [processedRecords, selectedSeverity]);

  // Counters derived strictly from real detection records
  const counts = useMemo(() => {
    const list = allValidRecords.length > 0 ? allValidRecords : records;
    const totalEvents = list.length;
    const totalPotholes = list.reduce((sum, r) => sum + (r.potholeCount || 1), 0);
    const severePotholes = list
      .filter((r) => r.severity === "Severe")
      .reduce((sum, r) => sum + (r.potholeCount || 1), 0);
    const moderatePotholes = list
      .filter((r) => r.severity === "Moderate")
      .reduce((sum, r) => sum + (r.potholeCount || 1), 0);
    const minorPotholes = list
      .filter((r) => r.severity === "Minor")
      .reduce((sum, r) => sum + (r.potholeCount || 1), 0);

    return {
      totalEvents,
      totalPotholes,
      severe: severePotholes,
      moderate: moderatePotholes,
      minor: minorPotholes,
    };
  }, [allValidRecords, records]);

  const handleRecenter = () => {
    setRecenterTrigger((prev) => prev + 1);
  };

  return (
    <div id="pothole-map" className="space-y-6">
      <style>{`
        @keyframes leaflet-ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .leaflet-popup-content-wrapper {
          background: hsl(230 25% 10%) !important;
          color: hsl(210 40% 96%) !important;
          border: 1px solid hsl(230 20% 22%) !important;
          border-radius: 12px !important;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6) !important;
          padding: 4px !important;
        }
        .leaflet-popup-tip {
          background: hsl(230 25% 10%) !important;
          border: 1px solid hsl(230 20% 22%) !important;
        }
        .leaflet-container {
          font-family: inherit;
          z-index: 10;
        }
      `}</style>

      {/* ---------------- CARD WRAPPER ---------------- */}
      <div className="glass-card p-4 md:p-6 relative overflow-hidden border border-border">
        {/* Header with Title & Action Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <MapPin className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-heading font-bold text-foreground">
                Pothole Monitoring Map
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Synchronized with detection history: {records.length} events, {counts.totalPotholes} total hazards mapped
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Recenter Button */}
            <button
              onClick={handleRecenter}
              disabled={latitude === null || longitude === null}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                latitude !== null && longitude !== null
                  ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 cursor-pointer"
                  : "bg-muted/50 border-border text-muted-foreground cursor-not-allowed opacity-60"
              }`}
              title="Center map on current GPS location"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Center Location</span>
            </button>

            {/* Severity Filter */}
            <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border text-xs">
              <span className="px-2 text-muted-foreground hidden md:inline flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              {(["All", "Severe", "Moderate", "Minor"] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    selectedSeverity === sev
                      ? sev === "Severe"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : sev === "Moderate"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : sev === "Minor"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- MAP & SIDE LEGEND LAYOUT ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Map Container */}
          <div className="lg:col-span-3 rounded-xl overflow-hidden border border-border relative h-[480px]">
            <MapContainer
              center={centerPosition}
              zoom={latitude !== null ? 16 : 5}
              scrollWheelZoom={true}
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapController
                latitude={latitude}
                longitude={longitude}
                recenterTrigger={recenterTrigger}
                focusTarget={focusTarget}
              />

              {/* Active Route Journey Polyline */}
              {routePositions.length > 1 && (
                <Polyline
                  positions={routePositions}
                  pathOptions={{
                    color: "#06b6d4",
                    weight: 4,
                    opacity: 0.85,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              )}

              {/* Current GPS Location Marker */}
              {latitude !== null && longitude !== null && (
                <Marker
                  position={[latitude, longitude]}
                  icon={createCurrentLocationIcon()}
                >
                  <Popup>
                    <div className="p-1 min-w-[180px]">
                      <div className="flex items-center gap-1.5 pb-1 mb-2 border-b border-border/60">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                        <strong className="text-sm font-semibold text-foreground">
                          Current Location
                        </strong>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Latitude:</span>
                          <span className="font-mono text-foreground font-medium">
                            {latitude.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Longitude:</span>
                          <span className="font-mono text-foreground font-medium">
                            {longitude.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] pt-1 text-neon-cyan">
                          <span>Status:</span>
                          <span>Live GPS Active</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Pothole Markers from History */}
              {filteredRecords.map((record) => {
                const isFocused = focusTarget?.id === record.id;
                const isEncountered = encounteredPotholeIds?.has(String(record.id)) ?? false;
                const isActiveAlert = activeAlertPotholeId ? String(record.id) === activeAlertPotholeId : false;
                const confPercent =
                  record.confidence <= 1
                    ? Math.round(record.confidence * 100)
                    : Math.round(record.confidence);

                return (
                  <Marker
                    key={record.id}
                    position={[record.latitude, record.longitude]}
                    icon={createPotholeIcon(record.severity, isFocused, isEncountered, isActiveAlert)}
                    eventHandlers={{
                      click: () => onSelectPothole?.(record),
                    }}
                  >
                    <Popup>
                      <div className="p-1.5 min-w-[210px] text-xs">
                        {/* Header: ID + Active Alert Badge + Known Pothole Badge + Encountered Badge + Severity Badge */}
                        <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-border/60">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-foreground font-mono">
                              {record.id}
                            </span>
                            {isActiveAlert && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-500/25 text-red-400 border border-red-500/50 animate-pulse">
                                Active Safety Warning
                              </span>
                            )}
                            {record.isKnown && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                                Known Pothole
                              </span>
                            )}
                            {isEncountered && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40">
                                Encountered on Route
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              record.severity === "Severe"
                                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                                : record.severity === "Moderate"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            }`}
                          >
                            {record.severity}
                          </span>
                        </div>

                        {/* Details: Distance, Potholes, Severity, Confidence, Lat, Long, Detected Time, Input */}
                        <div className="space-y-1.5 text-muted-foreground">
                          {record.distance !== undefined && (
                            <div className="flex justify-between items-center bg-muted/40 px-2 py-1 rounded border border-border/50">
                              <span className="text-foreground font-medium">Distance:</span>
                              <span className="font-semibold text-neon-cyan font-mono">
                                {record.distance.toFixed(1)} m
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span>Potholes:</span>
                            <span className="font-semibold text-foreground">
                              {record.potholeCount} {record.potholeCount === 1 ? "hazard" : "hazards"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Severity:</span>
                            <span
                              className={`font-semibold ${
                                record.severity === "Severe"
                                  ? "text-red-400"
                                  : record.severity === "Moderate"
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {record.severity}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Confidence:</span>
                            <span className="font-semibold text-foreground font-mono">
                              {confPercent}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Latitude:</span>
                            <span className="font-mono text-foreground">
                              {record.latitude.toFixed(6)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Longitude:</span>
                            <span className="font-mono text-foreground">
                              {record.longitude.toFixed(6)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-border/40">
                            <span>Detection time:</span>
                            <span className="text-foreground font-medium">
                              {record.date} {record.time}
                            </span>
                          </div>
                          {record.inputType && (
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                              <span>Input:</span>
                              <span className="text-neon-cyan font-medium">
                                {record.inputType} Detection
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* ---------------- MAP LEGEND PANEL ---------------- */}
          <div className="glass-card p-4 rounded-xl border border-border flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-border mb-3">
                <Layers className="w-4 h-4 text-neon-blue" />
                <h4 className="font-semibold text-sm text-foreground">
                  Map Legend
                </h4>
              </div>

              <div className="space-y-3 text-xs">
                {/* Current Location Legend item */}
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex items-center gap-3">
                  <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                    <span className="w-4 h-4 rounded-full bg-blue-500/30 animate-ping absolute"></span>
                    <span className="w-3 h-3 rounded-full bg-blue-500 border border-white"></span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Current GPS</p>
                    <p className="text-[10px] text-muted-foreground">
                      {latitude !== null && longitude !== null
                        ? "Active tracking"
                        : "Waiting for signal"}
                    </p>
                  </div>
                </div>

                {/* Severe Pothole Legend item */}
                <div
                  onClick={() =>
                    setSelectedSeverity(
                      selectedSeverity === "Severe" ? "All" : "Severe"
                    )
                  }
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                    selectedSeverity === "Severe"
                      ? "bg-red-500/15 border-red-500/50"
                      : "bg-muted/40 border-border/60 hover:bg-muted/70"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-400">Severe</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                        {counts.severe}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Area ≥ 15,000 px² • Critical
                    </p>
                  </div>
                </div>

                {/* Moderate Pothole Legend item */}
                <div
                  onClick={() =>
                    setSelectedSeverity(
                      selectedSeverity === "Moderate" ? "All" : "Moderate"
                    )
                  }
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                    selectedSeverity === "Moderate"
                      ? "bg-amber-500/15 border-amber-500/50"
                      : "bg-muted/40 border-border/60 hover:bg-muted/70"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400">
                        Moderate
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                        {counts.moderate}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      5k – 15,000 px² • Medium
                    </p>
                  </div>
                </div>

                {/* Minor Pothole Legend item */}
                <div
                  onClick={() =>
                    setSelectedSeverity(
                      selectedSeverity === "Minor" ? "All" : "Minor"
                    )
                  }
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                    selectedSeverity === "Minor"
                      ? "bg-emerald-500/15 border-emerald-500/50"
                      : "bg-muted/40 border-border/60 hover:bg-muted/70"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-400">
                        Minor
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        {counts.minor}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      &lt; 5,000 px² • Low risk
                    </p>
                  </div>
                </div>

                {/* Route Journey Legend Item */}
                <div className="p-2.5 rounded-lg bg-neon-cyan/5 border border-neon-cyan/30 flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-neon-cyan flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-neon-cyan"></span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-neon-cyan">Route Encounter</p>
                    <p className="text-[10px] text-muted-foreground">
                      ≤ 25m from driven path
                    </p>
                  </div>
                </div>

                {/* Active Safety Warning Legend Item */}
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/40 flex items-center gap-3">
                  <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                    <span className="w-4 h-4 rounded-full bg-red-500/30 animate-ping absolute"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white"></span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-400">Safety Warning</p>
                    <p className="text-[10px] text-muted-foreground">
                      Active hazard nearby
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hint footer */}
            <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
              <span>Click markers to view details or use History to navigate.</span>
            </div>
          </div>
        </div>

        {/* ---------------- BELOW MAP SUMMARY METRICS ---------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-4 border-t border-border">
          {/* Total Detection Events */}
          <div className="p-4 rounded-xl border border-border bg-card/60">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <History className="w-3 h-3 text-neon-blue" /> Detection Events
            </p>
            <p className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
              {counts.totalEvents}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Sessions recorded</p>
          </div>

          {/* Total Potholes */}
          <div className="p-4 rounded-xl border border-border bg-card/60">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 text-neon-cyan" /> Total Potholes
            </p>
            <p className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
              {counts.totalPotholes}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Defects mapped</p>
          </div>

          {/* Severe */}
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
            <p className="text-xs text-red-400 font-medium flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" /> Severe
            </p>
            <p className="text-2xl md:text-3xl font-heading font-bold text-red-400 mt-1">
              {counts.severe}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Critical severity</p>
          </div>

          {/* Moderate */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <p className="text-xs text-amber-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Moderate
            </p>
            <p className="text-2xl md:text-3xl font-heading font-bold text-amber-400 mt-1">
              {counts.moderate}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Medium severity</p>
          </div>

          {/* Minor */}
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 col-span-2 sm:col-span-1">
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Minor
            </p>
            <p className="text-2xl md:text-3xl font-heading font-bold text-emerald-400 mt-1">
              {counts.minor}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Minor severity</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PotholeMap;