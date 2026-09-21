import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Shield,
  Activity,
  Target,
  Flame,
  Navigation,
  ExternalLink,
  Milestone,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { SectionHeader } from "./DetectionDashboard";
import type { DetectionRecord } from "@/types/pothole";
import type { RouteSession } from "@/types/route";
import {
  computeNetworkRiskScore,
  computeRouteRiskScore,
  aggregateSeverityDistribution,
  aggregateTemporalTrends,
  aggregateModalityDistribution,
  findPotholeHotspots,
} from "@/lib/riskAnalysis";

interface AnalyticsDashboardProps {
  records?: DetectionRecord[];
  onViewOnMap?: (latitude: number, longitude: number, id: string) => void;
}

const AnalyticsDashboard = ({
  records = [],
  onViewOnMap,
}: AnalyticsDashboardProps) => {
  // Read active or last completed route session from sessionStorage
  const [routeSession, setRouteSession] = useState<RouteSession | null>(null);

  useEffect(() => {
    const readSession = () => {
      try {
        const raw = sessionStorage.getItem("activeRouteSession");
        if (raw) {
          setRouteSession(JSON.parse(raw));
        } else {
          setRouteSession(null);
        }
      } catch (e) {
        console.error("Failed to read route session in analytics:", e);
      }
    };

    readSession();
    // Poll lightly to synchronize if user starts/ends route in LocationTracker
    const interval = setInterval(readSession, 2000);
    return () => clearInterval(interval);
  }, []);

  // ---------------- MEMOIZED RISK & ANALYTICS CALCULATIONS ----------------
  const networkMetrics = useMemo(() => computeNetworkRiskScore(records), [records]);
  const severityData = useMemo(() => aggregateSeverityDistribution(records), [records]);
  const temporalData = useMemo(() => aggregateTemporalTrends(records), [records]);
  const modalityData = useMemo(() => aggregateModalityDistribution(records), [records]);
  const hotspots = useMemo(() => findPotholeHotspots(records), [records]);
  const routeMetrics = useMemo(() => computeRouteRiskScore(routeSession), [routeSession]);

  // Risk Gauge Styling
  let riskColorClass = "text-emerald-400";
  let riskBadgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  let gaugeGradient = "hsl(150 80% 45%)";

  if (networkMetrics.classification === "Critical Risk") {
    riskColorClass = "text-red-400";
    riskBadgeClass = "bg-red-500/20 text-red-400 border-red-500/40";
    gaugeGradient = "hsl(0 72% 51%)";
  } else if (networkMetrics.classification === "High Risk") {
    riskColorClass = "text-orange-400";
    riskBadgeClass = "bg-orange-500/20 text-orange-400 border-orange-500/40";
    gaugeGradient = "hsl(25 95% 53%)";
  } else if (networkMetrics.classification === "Moderate Risk") {
    riskColorClass = "text-amber-400";
    riskBadgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/40";
    gaugeGradient = "hsl(45 93% 47%)";
  }

  return (
    <section id="analytics" className="relative py-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(217_91%_60%/0.04)_0%,transparent_50%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <SectionHeader
          title="Road Risk Analytics & Insights"
          subtitle="Real-time statistical risk modeling, spatial hazard hotspots, and journey health analysis"
        />

        {/* ---------------- TOP KPI METRIC CARDS ---------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Defects */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-3">
              <Target className="w-5 h-5 text-neon-blue" />
              <span className="text-xs font-mono text-neon-cyan">
                {records.length} events
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-heading font-bold text-foreground">
              {networkMetrics.totalPotholes}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total Potholes Mapped</p>
          </motion.div>

          {/* Mapped Road Risk */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-3">
              <Activity className={`w-5 h-5 ${riskColorClass}`} />
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${riskBadgeClass}`}
              >
                {networkMetrics.classification}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                {networkMetrics.score}
              </p>
              <span className="text-xs text-muted-foreground font-mono">/ 100</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Mapped Road Risk Index</p>
          </motion.div>

          {/* Severe Hazard Density */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="text-xs text-destructive font-mono">
                {networkMetrics.severeCount} critical
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-heading font-bold text-foreground">
              {networkMetrics.severeRatio}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Severe Hazard Density</p>
          </motion.div>

          {/* Mean Detection Confidence */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-3">
              <Shield className="w-5 h-5 text-neon-cyan" />
              <span className="text-xs text-emerald-400 font-mono">YOLOv8 Real</span>
            </div>
            <p className="text-2xl md:text-3xl font-heading font-bold text-foreground">
              {networkMetrics.averageConfidence > 0
                ? `${networkMetrics.averageConfidence}%`
                : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Mean YOLO Confidence</p>
          </motion.div>
        </div>

        {/* ---------------- RISK GAUGE METER CARD ---------------- */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-6 mb-8 border border-border/80"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Mapped Road Risk Assessment
              </h3>
              <p className="text-xs text-muted-foreground">
                Algorithmic evaluation weighting severe, moderate, and minor defects across mapped road corridors
              </p>
            </div>
            <span className={`text-xs font-bold font-mono px-3 py-1 rounded-full border ${riskBadgeClass}`}>
              Score: {networkMetrics.score} / 100 • {networkMetrics.classification}
            </span>
          </div>

          <div className="relative w-full h-3.5 rounded-full bg-muted/60 overflow-hidden mt-3">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.min(100, Math.max(5, networkMetrics.score))}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full transition-all"
              style={{ background: gaugeGradient }}
            />
          </div>

          <div className="flex justify-between mt-2 text-[11px] text-muted-foreground font-mono">
            <span>0 (Low Risk)</span>
            <span>25</span>
            <span>50 (Moderate)</span>
            <span>75</span>
            <span>100 (Critical)</span>
          </div>
        </motion.div>

        {/* ---------------- RECHARTS DATA VISUALIZATIONS ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Severity Distribution Donut Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-6 border border-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">Severity Distribution</h3>
            </div>
            {networkMetrics.totalPotholes > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(230 25% 10%)",
                        borderColor: "hsl(230 20% 22%)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {severityData.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-muted-foreground">
                        {s.name}: <strong className="text-foreground">{s.value}</strong> ({s.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                No pothole records mapped yet
              </div>
            )}
          </motion.div>

          {/* Temporal Detection Velocity BarChart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 border border-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-neon-blue" />
              <h3 className="text-sm font-semibold text-foreground">Detection History by Date</h3>
            </div>
            {temporalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={temporalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 20% 18%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(230 25% 10%)",
                      borderColor: "hsl(230 20% 22%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                No dates recorded yet
              </div>
            )}
          </motion.div>

          {/* Ingestion Modality Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6 border border-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-neon-cyan" />
              <h3 className="text-sm font-semibold text-foreground">Input Ingestion Modality</h3>
            </div>
            {records.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={modalityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 20% 18%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="modality"
                    tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(230 25% 10%)",
                      borderColor: "hsl(230 20% 22%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(185 80% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                No modalities recorded yet
              </div>
            )}
          </motion.div>
        </div>

        {/* ---------------- JOURNEY ROUTE RISK PANEL ---------------- */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-6 mb-8 border border-border"
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Navigation className="w-5 h-5 text-neon-cyan" />
            <h3 className="text-base font-heading font-bold text-foreground">
              Journey Route Risk Intelligence (Phase 6 Correlation)
            </h3>
          </div>

          {routeSession && (routeSession.distanceTraveledMeters > 0 || routeSession.encounteredPotholes.length > 0) ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-card/60 border border-border">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Milestone className="w-3.5 h-3.5 text-neon-blue" /> Distance
                </span>
                <p className="text-lg font-mono font-bold text-foreground mt-1">
                  {routeMetrics.distanceKm} km
                </p>
                <span className="text-[10px] text-muted-foreground">Traveled</span>
              </div>

              <div className="p-3 rounded-xl bg-card/60 border border-border">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-neon-cyan" /> Encountered
                </span>
                <p className="text-lg font-mono font-bold text-foreground mt-1">
                  {routeMetrics.encounteredCount}
                </p>
                <span className="text-[10px] text-muted-foreground">Hazard defects</span>
              </div>

              <div className="p-3 rounded-xl bg-card/60 border border-border">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-amber-400" /> Defect Density
                </span>
                <p className="text-lg font-mono font-bold text-foreground mt-1">
                  {routeMetrics.defectsPerKm}
                </p>
                <span className="text-[10px] text-muted-foreground">Potholes / km</span>
              </div>

              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <span className="text-[11px] text-red-400 font-medium">Severe / Mod / Min</span>
                <p className="text-lg font-mono font-bold text-red-400 mt-1">
                  {routeMetrics.severeCount} / {routeMetrics.moderateCount} / {routeMetrics.minorCount}
                </p>
                <span className="text-[10px] text-muted-foreground">Severity count</span>
              </div>

              <div className="p-3 rounded-xl bg-card/60 border border-border col-span-2 sm:col-span-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-medium">Route Risk Score</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      routeMetrics.classification === "Critical Risk"
                        ? "bg-red-500/20 text-red-400 border-red-500/40"
                        : routeMetrics.classification === "High Risk"
                        ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                        : routeMetrics.classification === "Moderate Risk"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    }`}
                  >
                    {routeMetrics.classification}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-heading font-bold text-foreground">
                    {routeMetrics.score}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">/ 100</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-muted/20 border border-border text-center text-xs text-muted-foreground">
              No active or completed route journey recorded yet. Start Route Monitoring in the GPS tracker above to analyze journey safety.
            </div>
          )}
        </motion.div>

        {/* ---------------- HAZARD HOTSPOTS (50M CLUSTERS) ---------------- */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-6 border border-border"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-400" />
              <div>
                <h3 className="text-base font-heading font-bold text-foreground">
                  Identified Hazard Hotspots (50m Spatial Clusters)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Geographical defect aggregations indicating critical road surface deterioration corridors
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-card/60 border border-border text-muted-foreground">
              {hotspots.length} clusters found
            </span>
          </div>

          {hotspots.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground font-medium">
                    <th className="p-3">Rank / ID</th>
                    <th className="p-3">Centroid Location</th>
                    <th className="p-3">Defects</th>
                    <th className="p-3">Highest Severity</th>
                    <th className="p-3">Cluster Risk</th>
                    <th className="p-3">Radius</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {hotspots.map((spot) => (
                    <tr key={spot.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-foreground">
                        #{spot.rank} {spot.id}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {spot.centerLat.toFixed(5)}, {spot.centerLng.toFixed(5)}
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {spot.totalDefects} {spot.totalDefects === 1 ? "defect" : "defects"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            spot.highestSeverity === "Severe"
                              ? "bg-red-500/20 text-red-400 border border-red-500/40"
                              : spot.highestSeverity === "Moderate"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          }`}
                        >
                          {spot.highestSeverity}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            spot.riskClassification === "Critical Risk"
                              ? "text-red-400"
                              : spot.riskClassification === "High Risk"
                              ? "text-orange-400"
                              : "text-amber-400"
                          }`}
                        >
                          {spot.riskClassification}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        ~{spot.radiusMeters} m
                      </td>
                      <td className="p-3 text-right">
                        {onViewOnMap && spot.records[0] && (
                          <button
                            onClick={() =>
                              onViewOnMap(
                                spot.centerLat,
                                spot.centerLng,
                                String(spot.records[0].id)
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors text-[11px] font-medium cursor-pointer"
                            title="Focus map on this hotspot centroid"
                          >
                            <span>Map</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-muted/20 border border-border text-center text-xs text-muted-foreground">
              No defect clusters within 50m detected. Current mapped hazards are isolated.
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default AnalyticsDashboard;
