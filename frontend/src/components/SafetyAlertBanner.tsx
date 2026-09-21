import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Volume2,
  VolumeX,
  X,
  ShieldAlert,
} from "lucide-react";
import type { ActiveAlertData } from "@/types/alert";

interface SafetyAlertBannerProps {
  alert: ActiveAlertData | null;
  onDismiss: (potholeId: string) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  isAccuracyLow?: boolean;
}

export const SafetyAlertBanner = ({
  alert,
  onDismiss,
  audioEnabled,
  onToggleAudio,
  isAccuracyLow = false,
}: SafetyAlertBannerProps) => {
  // If GPS accuracy is low (> 35m) and there's no active alert, or even if there is, we inform the user
  if (isAccuracyLow) {
    return (
      <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs flex items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span className="font-semibold">GPS Accuracy Low — Safety Alerts on Standby</span>
          <span className="text-muted-foreground hidden sm:inline">
            (Satellite accuracy uncertainty exceeds safe detection threshold)
          </span>
        </div>
        <button
          onClick={onToggleAudio}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/60 border border-border text-muted-foreground hover:text-foreground text-[11px] transition-colors"
          title={audioEnabled ? "Mute audio warning chimes" : "Enable audio warning chimes"}
        >
          {audioEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-neon-cyan" />
              <span>Audio On</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>Muted</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // If no alert is currently active, render nothing
  if (!alert) {
    return null;
  }

  const { severity, potholeId, distance, confidence, additionalCount } = alert;

  const confPercent =
    confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  // Styling and content configurations per severity level
  let title = "POTHOLE NEARBY";
  let borderClass = "border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.25)]";
  let bgClass = "from-amber-950/40 to-card/90";
  let badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/40";
  let icon = <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />;

  if (severity === "Severe") {
    title = "CRITICAL POTHOLE NEARBY";
    borderClass = "border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.3)]";
    bgClass = "from-red-950/50 to-card/90";
    badgeClass = "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse";
    icon = <AlertOctagon className="w-5 h-5 text-red-400 animate-bounce" />;
  } else if (severity === "Minor") {
    title = "MINOR ROAD DEFECT NEARBY";
    borderClass = "border-emerald-500/70 shadow-[0_0_16px_rgba(16,185,129,0.2)]";
    bgClass = "from-emerald-950/30 to-card/90";
    badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    icon = <Info className="w-5 h-5 text-emerald-400" />;
  }

  return (
    <div
      role="alert"
      className={`glass-card p-4 rounded-2xl mb-4 border-2 bg-gradient-to-r ${bgClass} ${borderClass} transition-all duration-300 relative overflow-hidden`}
    >
      {/* Top Accent Strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          severity === "Severe"
            ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
            : severity === "Moderate"
            ? "bg-amber-500 shadow-[0_0_10px_#f59e0b]"
            : "bg-emerald-500"
        }`}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: Icon & Alert Messaging */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-card/80 border border-border shrink-0 mt-0.5 sm:mt-0">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading font-extrabold text-sm md:text-base tracking-wide text-foreground">
                {title}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}
              >
                {severity}
              </span>
              <span className="font-mono text-xs text-foreground font-semibold px-2 py-0.5 rounded bg-muted/60 border border-border">
                {potholeId}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <span>
                Distance:{" "}
                <strong className="text-neon-cyan font-mono text-sm">
                  {distance.toFixed(1)} m
                </strong>
              </span>
              <span>•</span>
              <span>
                Confidence:{" "}
                <strong className="text-foreground font-mono font-medium">
                  {confPercent}%
                </strong>
              </span>
              {additionalCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-medium text-[11px] flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    +{additionalCount} other {additionalCount === 1 ? "hazard" : "hazards"} nearby
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Audio Toggle & Dismiss Button */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={onToggleAudio}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              audioEnabled
                ? "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/25"
                : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
            }`}
            title={audioEnabled ? "Disable warning audio chimes" : "Enable warning audio chimes"}
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Audio On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Muted</span>
              </>
            )}
          </button>

          <button
            onClick={() => onDismiss(potholeId)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
            title="Dismiss this alert for the current approach"
          >
            <X className="w-3.5 h-3.5" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafetyAlertBanner;
