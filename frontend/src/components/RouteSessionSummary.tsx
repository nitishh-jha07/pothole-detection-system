import { useState, useEffect } from "react";
import {
  Play,
  Square,
  RotateCcw,
  Navigation,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Milestone,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { RouteSession } from "@/types/route";

interface RouteSessionSummaryProps {
  session: RouteSession;
  onStartRoute: () => void;
  onStopRoute: () => void;
  onResetRoute: () => void;
  hasGpsFix: boolean;
}

export const RouteSessionSummary = ({
  session,
  onStartRoute,
  onStopRoute,
  onResetRoute,
  hasGpsFix,
}: RouteSessionSummaryProps) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFeedExpanded, setIsFeedExpanded] = useState<boolean>(false);

  // Timer effect for active route
  useEffect(() => {
    let interval: any = null;
    if (session.status === "active") {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (session.status === "idle") {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.status]);

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formattedDistance =
    session.distanceTraveledMeters >= 1000
      ? `${(session.distanceTraveledMeters / 1000).toFixed(2)} km`
      : `${Math.round(session.distanceTraveledMeters)} m`;

  return (
    <div className="glass-card p-5 border border-border/80 rounded-2xl mb-6 relative overflow-hidden bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md">
      {/* Glow Accent Bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 transition-all duration-500 ${
          session.status === "active"
            ? "bg-gradient-to-r from-neon-blue via-neon-cyan to-emerald-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]"
            : session.status === "completed"
            ? "bg-amber-500/80"
            : "bg-border/60"
        }`}
      />

      {/* Top Header & Session Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
              session.status === "active"
                ? "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]"
                : session.status === "completed"
                ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                : "bg-muted/40 text-muted-foreground border-border"
            }`}
          >
            <Navigation
              className={`w-5 h-5 ${
                session.status === "active" ? "animate-pulse" : ""
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-heading font-bold text-foreground">
                Road / Route-Level Monitoring
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  session.status === "active"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse"
                    : session.status === "completed"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-muted/50 text-muted-foreground border-border"
                }`}
              >
                {session.status === "active"
                  ? "Route Active"
                  : session.status === "completed"
                  ? "Trip Finalized"
                  : "Not Active"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Correlates live GPS journey with persistent potholes within 25m encounter radius
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
          {session.status !== "active" ? (
            <button
              onClick={onStartRoute}
              disabled={!hasGpsFix}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                hasGpsFix
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/40 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  : "bg-muted/40 text-muted-foreground border-border cursor-not-allowed opacity-60"
              }`}
              title={
                hasGpsFix
                  ? "Begin recording path and monitoring potholes along route"
                  : "Acquiring GPS fix before starting..."
              }
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Route Monitoring</span>
            </button>
          ) : (
            <button
              onClick={onStopRoute}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 transition-all cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              title="Stop monitoring and finalize route summary"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>End Route</span>
            </button>
          )}

          {(session.status === "completed" ||
            session.path.length > 0 ||
            session.encounteredPotholes.length > 0) && (
            <button
              onClick={onResetRoute}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground border border-border transition-all cursor-pointer"
              title="Reset trip path and encounter summary"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Trip</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Journey & Encounter Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
        {/* Trip Duration */}
        <div className="p-3 rounded-xl bg-card/50 border border-border/70 flex flex-col justify-between">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-neon-blue" /> Duration
          </span>
          <span className="text-xl font-mono font-bold text-foreground mt-1">
            {formatDuration(elapsedSeconds)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {session.status === "active" ? "Live tracking" : "Elapsed time"}
          </span>
        </div>

        {/* Distance Traveled */}
        <div className="p-3 rounded-xl bg-card/50 border border-border/70 flex flex-col justify-between">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
            <Milestone className="w-3 h-3 text-neon-cyan" /> Distance
          </span>
          <span className="text-xl font-mono font-bold text-foreground mt-1">
            {formattedDistance}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {session.path.length} GPS breadcrumbs
          </span>
        </div>

        {/* Total Encountered */}
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex flex-col justify-between">
          <span className="text-[11px] text-primary font-medium flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Encountered
          </span>
          <span className="text-2xl font-mono font-bold text-primary mt-1">
            {session.summary.totalEncountered}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            ≤ 25m from route
          </span>
        </div>

        {/* Severe Encountered */}
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col justify-between">
          <span className="text-[11px] text-red-400 font-medium flex items-center gap-1">
            <AlertOctagon className="w-3 h-3" /> Severe
          </span>
          <span className="text-2xl font-mono font-bold text-red-400 mt-1">
            {session.summary.severeCount}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            Critical defects
          </span>
        </div>

        {/* Moderate Encountered */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
          <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Moderate
          </span>
          <span className="text-2xl font-mono font-bold text-amber-400 mt-1">
            {session.summary.moderateCount}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            Medium defects
          </span>
        </div>

        {/* Minor Encountered */}
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Minor
          </span>
          <span className="text-2xl font-mono font-bold text-emerald-400 mt-1">
            {session.summary.minorCount}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            Low risk defects
          </span>
        </div>
      </div>

      {/* Encountered Hazards Feed (Accordion) */}
      {session.encounteredPotholes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <button
            onClick={() => setIsFeedExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
          >
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-neon-cyan" />
              <span>
                Potholes Encountered on This Journey (
                {session.encounteredPotholes.length})
              </span>
            </span>
            {isFeedExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isFeedExpanded && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              {session.encounteredPotholes.map((item, idx) => (
                <div
                  key={`${item.potholeId}-${idx}`}
                  className="p-2.5 rounded-lg bg-card/60 border border-border/70 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        item.record.severity === "Severe"
                          ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                          : item.record.severity === "Moderate"
                          ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                          : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                      }`}
                    />
                    <div>
                      <span className="font-mono font-bold text-foreground">
                        {item.potholeId}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {item.record.severity} • {item.record.potholeCount} hazard
                        {item.record.potholeCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="font-mono text-neon-cyan text-[11px]">
                      {item.distanceAtEncounter.toFixed(1)} m away
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.encounteredAt}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteSessionSummary;
