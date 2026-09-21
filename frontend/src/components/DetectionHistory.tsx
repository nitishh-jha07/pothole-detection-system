import { useState, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  MapPin,
  Clock,
  ExternalLink,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  FileVideo,
  FileImage,
  Camera,
  Layers,
  ArrowRight,
} from "lucide-react";
import { SectionHeader } from "./DetectionDashboard";
import type { DetectionRecord, PotholeSeverity, DetectionInputType } from "@/types/pothole";

interface DetectionHistoryProps {
  records: DetectionRecord[];
  onDeleteRecord: (id: string) => void;
  onClearHistory: () => void;
  onViewOnMap: (record: DetectionRecord) => void;
}

export const DetectionHistory = ({
  records,
  onDeleteRecord,
  onClearHistory,
  onViewOnMap,
}: DetectionHistoryProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [inputTypeFilter, setInputTypeFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "severity">("newest");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string; id: string } | null>(null);

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    return records
      .filter((record) => {
        // Severity filter
        if (severityFilter !== "All" && record.severity !== severityFilter) {
          return false;
        }

        // Input type filter
        if (inputTypeFilter !== "All" && record.inputType !== inputTypeFilter) {
          return false;
        }

        // Search term (ID, coordinates, date)
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchId = record.id.toLowerCase().includes(term);
          const matchCoords = `${record.latitude},${record.longitude}`.includes(term);
          const matchDate = record.date.toLowerCase().includes(term);
          if (!matchId && !matchCoords && !matchDate) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          const timeA = new Date(`${a.date}T${a.time}`).getTime() || 0;
          const timeB = new Date(`${b.date}T${b.time}`).getTime() || 0;
          return timeB - timeA;
        }
        if (sortBy === "oldest") {
          const timeA = new Date(`${a.date}T${a.time}`).getTime() || 0;
          const timeB = new Date(`${b.date}T${b.time}`).getTime() || 0;
          return timeA - timeB;
        }
        if (sortBy === "severity") {
          const rank: Record<PotholeSeverity, number> = { Severe: 3, Moderate: 2, Minor: 1 };
          return rank[b.severity] - rank[a.severity];
        }
        return 0;
      });
  }, [records, severityFilter, inputTypeFilter, searchTerm, sortBy]);

  // Aggregate Counters from actual history records
  const counters = useMemo(() => {
    const totalEvents = records.length;
    const totalPotholes = records.reduce((acc, r) => acc + (r.potholeCount || 1), 0);
    const severePotholes = records
      .filter((r) => r.severity === "Severe")
      .reduce((acc, r) => acc + (r.potholeCount || 1), 0);
    const moderatePotholes = records
      .filter((r) => r.severity === "Moderate")
      .reduce((acc, r) => acc + (r.potholeCount || 1), 0);
    const minorPotholes = records
      .filter((r) => r.severity === "Minor")
      .reduce((acc, r) => acc + (r.potholeCount || 1), 0);

    return {
      totalEvents,
      totalPotholes,
      severePotholes,
      moderatePotholes,
      minorPotholes,
    };
  }, [records]);

  // Helper to format confidence percentage
  const formatConfidence = (conf: number) => {
    if (conf <= 1) {
      return `${Math.round(conf * 100)}%`;
    }
    return `${Math.round(conf)}%`;
  };

  const getSeverityBadgeClass = (severity: PotholeSeverity) => {
    switch (severity) {
      case "Severe":
        return "bg-red-500/20 text-red-400 border border-red-500/40";
      case "Moderate":
        return "bg-amber-500/20 text-amber-400 border border-amber-500/40";
      case "Minor":
        return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
    }
  };

  const getInputTypeIcon = (type: DetectionInputType) => {
    switch (type) {
      case "Video":
        return <FileVideo className="w-3.5 h-3.5 text-neon-purple" />;
      case "Live":
        return <Camera className="w-3.5 h-3.5 text-neon-cyan" />;
      case "Image":
      default:
        return <FileImage className="w-3.5 h-3.5 text-neon-blue" />;
    }
  };

  return (
    <section id="history" className="relative py-16">
      <div className="container mx-auto px-4">
        <SectionHeader
          title="Detection History & Records"
          subtitle="Persistent event log of road inspections and localized YOLO pothole detections"
        />

        {/* ---------------- COUNTERS ROW ---------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Total Detection Events */}
          <div className="glass-card p-4 border border-border">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Detection Events</span>
              <History className="w-4 h-4 text-neon-blue" />
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">
              {counters.totalEvents}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Logged sessions</p>
          </div>

          {/* Total Potholes */}
          <div className="glass-card p-4 border border-border">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Total Potholes</span>
              <Layers className="w-4 h-4 text-neon-cyan" />
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">
              {counters.totalPotholes}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Individual defects</p>
          </div>

          {/* Severe Potholes */}
          <div className="glass-card p-4 border border-red-500/30 bg-red-500/5">
            <div className="flex items-center justify-between text-red-400 mb-1">
              <span className="text-xs font-medium">Severe</span>
              <AlertOctagon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold font-heading text-red-400">
              {counters.severePotholes}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Critical hazards</p>
          </div>

          {/* Moderate Potholes */}
          <div className="glass-card p-4 border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-xs font-medium">Moderate</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold font-heading text-amber-400">
              {counters.moderatePotholes}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Medium cavities</p>
          </div>

          {/* Minor Potholes */}
          <div className="glass-card p-4 border border-emerald-500/30 bg-emerald-500/5 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-xs font-medium">Minor</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold font-heading text-emerald-400">
              {counters.minorPotholes}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Surface wear</p>
          </div>
        </div>

        {/* ---------------- FILTER & CONTROLS TOOLBAR ---------------- */}
        <div className="glass-card p-4 border border-border rounded-xl mb-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by ID (e.g. PTH-001), coordinates, or date..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-blue/60"
              />
            </div>

            {/* Severity Filter Buttons */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border text-xs flex-wrap">
              <span className="px-2 text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" /> Severity:
              </span>
              {["All", "Severe", "Moderate", "Minor"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    severityFilter === s
                      ? s === "Severe"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : s === "Moderate"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : s === "Minor"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input Type Filter */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border text-xs">
              <span className="px-2 text-muted-foreground">Type:</span>
              {(["All", "Image", "Video", "Live"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setInputTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    inputTypeFilter === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/40 px-3 py-1.5 rounded-lg border border-border text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-foreground border-none text-xs focus:outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-card text-foreground">Newest First</option>
                  <option value="oldest" className="bg-card text-foreground">Oldest First</option>
                  <option value="severity" className="bg-card text-foreground">Highest Severity</option>
                </select>
              </div>

              {/* Clear History Button */}
              {records.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium transition-all"
                  title="Clear all stored detection history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- CONFIRMATION DIALOG ---------------- */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="glass-card p-6 rounded-xl border border-destructive/50 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 text-destructive mb-3">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Clear All Detection History?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to clear all detection history? This will permanently delete all {records.length} saved detection records from browser storage.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onClearHistory();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all"
                >
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PREVIEW MODAL ---------------- */}
        {previewMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setPreviewMedia(null)}>
            <div className="glass-card p-4 rounded-xl border border-border max-w-3xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground">{previewMedia.id}</span>
                  <span className="text-xs text-muted-foreground">Detection Media Output</span>
                </div>
                <button
                  onClick={() => setPreviewMedia(null)}
                  className="px-2.5 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <div className="rounded-lg overflow-hidden bg-black/60 flex items-center justify-center">
                {previewMedia.type === "Video" ? (
                  <video controls autoPlay className="max-h-[70vh] w-full rounded">
                    <source src={previewMedia.url} type="video/mp4" />
                  </video>
                ) : (
                  <img src={previewMedia.url} alt="Detection Result" className="max-h-[70vh] object-contain rounded" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- RECORDS TABLE / CARDS ---------------- */}
        {records.length === 0 ? (
          /* EMPTY STATE */
          <div className="glass-card p-12 text-center border border-border rounded-xl">
            <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              No detection history available yet.
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Upload an image or video in the Smart Detection Dashboard, and detected road hazards will appear here automatically.
            </p>
            <button
              onClick={() => {
                document.getElementById("detection")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn-primary-glow text-xs py-2 px-4 rounded-lg inline-flex items-center gap-1.5"
            >
              <span>Go to Detection Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : filteredAndSortedRecords.length === 0 ? (
          /* NO MATCHING FILTERS */
          <div className="glass-card p-8 text-center border border-border rounded-xl">
            <p className="text-sm text-muted-foreground">
              No records match your active search and filter criteria.
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSeverityFilter("All");
                setInputTypeFilter("All");
              }}
              className="mt-3 text-xs text-neon-blue hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* TABLE DISPLAY */
          <div className="glass-card overflow-hidden border border-border rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">ID</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Date & Time</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Location</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Potholes</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Severity</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Confidence</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Input Type</th>
                    <th className="text-right p-4 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredAndSortedRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      {/* ID */}
                      <td className="p-4">
                        <span className="font-mono font-bold text-foreground text-xs px-2 py-1 rounded bg-muted/60 border border-border">
                          {record.id}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-foreground text-xs">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium">{record.date}</p>
                            <p className="text-[11px] text-muted-foreground">{record.time}</p>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                          <span className="font-mono text-muted-foreground">
                            {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
                          </span>
                        </div>
                      </td>

                      {/* Pothole count */}
                      <td className="p-4">
                        <span className="text-xs font-semibold text-foreground">
                          {record.potholeCount} {record.potholeCount === 1 ? "pothole" : "potholes"}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${getSeverityBadgeClass(
                            record.severity
                          )}`}
                        >
                          {record.severity}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td className="p-4">
                        <span className="text-xs font-mono font-medium text-foreground">
                          {formatConfidence(record.confidence)}
                        </span>
                      </td>

                      {/* Input Type */}
                      <td className="p-4 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {getInputTypeIcon(record.inputType)}
                          <span>{record.inputType}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Media Preview if outputUrl exists */}
                          {record.outputUrl && (
                            <button
                              onClick={() => setPreviewMedia({ url: record.outputUrl!, type: record.inputType, id: record.id })}
                              className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                              title="Preview Detection Media"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View on Map */}
                          <button
                            onClick={() => onViewOnMap(record)}
                            className="px-2.5 py-1 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium flex items-center gap-1 transition-all"
                            title="Locate detection on Pothole Map"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {/* Delete individual record */}
                          <button
                            onClick={() => onDeleteRecord(record.id)}
                            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all"
                            title="Delete this record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DetectionHistory;
