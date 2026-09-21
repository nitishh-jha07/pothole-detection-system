import type { DetectionRecord, PotholeSeverity } from "@/types/pothole";
import type { RouteSession } from "@/types/route";
import type {
  RoadRiskMetrics,
  RiskClassification,
  PotholeHotspot,
  SeverityChartData,
  TemporalChartData,
  ModalityChartData,
  RouteRiskMetrics,
} from "@/types/analytics";
import { haversineDistance } from "./geoUtils";

export const HOTSPOT_RADIUS_M = 50; // Phase 8 Hotspot clustering threshold (50m)

/**
 * Classify any 0 - 100 risk score into standard safety tiers.
 * 0–25 = Low Risk
 * 26–50 = Moderate Risk
 * 51–75 = High Risk
 * 76–100 = Critical Risk
 */
export function classifyRisk(score: number): RiskClassification {
  if (score <= 25) return "Low Risk";
  if (score <= 50) return "Moderate Risk";
  if (score <= 75) return "High Risk";
  return "Critical Risk";
}

/**
 * Compute the Mapped Road Risk Score across all persistent detection records.
 * Uses exact approved formula:
 * Severity weights: Severe=5, Moderate=3, Minor=1
 * Base severity ratio = (5*C_severe + 3*C_moderate + 1*C_minor) / (max(C_total, 1) * 5)
 * Volume dampener = min(1.0, log10(C_total + 1) / log10(20))
 * Score = min(100, round(severityRatio * 100 * volumeDampener))
 */
export function computeNetworkRiskScore(records: DetectionRecord[]): RoadRiskMetrics {
  if (!records || records.length === 0) {
    return {
      score: 0,
      classification: "Low Risk",
      totalPotholes: 0,
      severeCount: 0,
      moderateCount: 0,
      minorCount: 0,
      severeRatio: 0,
      averageConfidence: 0,
      volumeDampener: 0,
      severityRatio: 0,
    };
  }

  let severeCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  let totalConfidence = 0;
  let validConfCount = 0;

  for (const r of records) {
    const count = Math.max(1, r.potholeCount || 1);
    if (r.severity === "Severe") {
      severeCount += count;
    } else if (r.severity === "Moderate") {
      moderateCount += count;
    } else {
      minorCount += count;
    }

    if (typeof r.confidence === "number" && !isNaN(r.confidence)) {
      const normalizedConf = r.confidence <= 1 ? r.confidence * 100 : r.confidence;
      totalConfidence += normalizedConf;
      validConfCount++;
    }
  }

  const totalPotholes = severeCount + moderateCount + minorCount;

  // Base severity ratio: 0.2 (all minor) to 1.0 (all severe)
  const severityRatio =
    (5 * severeCount + 3 * moderateCount + 1 * minorCount) /
    (Math.max(totalPotholes, 1) * 5);

  // Volume dampener: log10(C_total + 1) / log10(20)
  const volumeDampener = Math.min(
    1.0,
    Math.log10(totalPotholes + 1) / Math.log10(20)
  );

  const rawScore = Math.round(severityRatio * 100 * volumeDampener);
  const score = Math.min(100, Math.max(0, rawScore));
  const classification = classifyRisk(score);

  const severeRatio = totalPotholes > 0 ? (severeCount / totalPotholes) * 100 : 0;
  const averageConfidence = validConfCount > 0 ? totalConfidence / validConfCount : 0;

  return {
    score,
    classification,
    totalPotholes,
    severeCount,
    moderateCount,
    minorCount,
    severeRatio: Math.round(severeRatio * 10) / 10,
    averageConfidence: Math.round(averageConfidence * 10) / 10,
    volumeDampener: Math.round(volumeDampener * 100) / 100,
    severityRatio: Math.round(severityRatio * 100) / 100,
  };
}

/**
 * Compute the Route-Level Risk Score for an active or completed journey.
 * Uses exact approved formula:
 * Density = N_encountered / max(D_km, 0.1)
 * SeverityFactor = (5*N_severe + 3*N_moderate + 1*N_minor) / max(N_encountered, 1)
 * RouteScore = min(100, round(Density * 12 * (SeverityFactor / 3) * averageConfidence))
 */
export function computeRouteRiskScore(session: RouteSession | null | undefined): RouteRiskMetrics {
  if (!session || (!session.distanceTraveledMeters && session.encounteredPotholes.length === 0)) {
    return {
      distanceKm: 0,
      encounteredCount: 0,
      defectsPerKm: 0,
      severeCount: 0,
      moderateCount: 0,
      minorCount: 0,
      averageConfidence: 0,
      score: 0,
      classification: "Low Risk",
    };
  }

  const distanceKm = Math.max(0, session.distanceTraveledMeters / 1000);
  const encounteredList = session.encounteredPotholes || [];
  const encounteredCount = encounteredList.length;

  if (encounteredCount === 0) {
    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      encounteredCount: 0,
      defectsPerKm: 0,
      severeCount: 0,
      moderateCount: 0,
      minorCount: 0,
      averageConfidence: 0,
      score: 0,
      classification: "Low Risk",
    };
  }

  let severeCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  let totalConfidence = 0;

  for (const item of encounteredList) {
    const sev = item.record?.severity;
    if (sev === "Severe") severeCount++;
    else if (sev === "Moderate") moderateCount++;
    else minorCount++;

    const conf = item.record?.confidence ?? 0.85;
    const normalized = conf > 1 ? conf / 100 : conf;
    totalConfidence += normalized;
  }

  const averageConfidence = totalConfidence / encounteredCount;
  const effectiveDistance = Math.max(distanceKm, 0.1);
  const density = encounteredCount / effectiveDistance;

  const severityFactor =
    (5 * severeCount + 3 * moderateCount + 1 * minorCount) /
    Math.max(encounteredCount, 1);

  const rawRouteScore = Math.round(
    density * 12 * (severityFactor / 3) * averageConfidence
  );
  const score = Math.min(100, Math.max(0, rawRouteScore));
  const classification = classifyRisk(score);

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    encounteredCount,
    defectsPerKm: Math.round(density * 10) / 10,
    severeCount,
    moderateCount,
    minorCount,
    averageConfidence: Math.round(averageConfidence * 100) / 100,
    score,
    classification,
  };
}

/**
 * Aggregate detection records by severity for Pie/Donut Chart rendering.
 */
export function aggregateSeverityDistribution(records: DetectionRecord[]): SeverityChartData[] {
  let severe = 0;
  let moderate = 0;
  let minor = 0;

  for (const r of records) {
    const count = Math.max(1, r.potholeCount || 1);
    if (r.severity === "Severe") severe += count;
    else if (r.severity === "Moderate") moderate += count;
    else minor += count;
  }

  const total = severe + moderate + minor;

  return [
    {
      name: "Severe",
      value: severe,
      color: "hsl(0 72% 51%)", // Red
      percentage: total > 0 ? Math.round((severe / total) * 100) : 0,
    },
    {
      name: "Moderate",
      value: moderate,
      color: "hsl(45 93% 47%)", // Amber
      percentage: total > 0 ? Math.round((moderate / total) * 100) : 0,
    },
    {
      name: "Minor",
      value: minor,
      color: "hsl(150 80% 45%)", // Emerald
      percentage: total > 0 ? Math.round((minor / total) * 100) : 0,
    },
  ];
}

/**
 * Aggregate detection records over time based on detected_at / date.
 * Groups by date (YYYY-MM-DD or formatted date).
 */
export function aggregateTemporalTrends(records: DetectionRecord[]): TemporalChartData[] {
  if (!records || records.length === 0) {
    return [];
  }

  const dateCounts = new Map<string, number>();

  for (const r of records) {
    let dateStr = "";
    if (r.date) {
      dateStr = r.date;
    } else {
      dateStr = "Recent";
    }

    const count = Math.max(1, r.potholeCount || 1);
    dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + count);
  }

  // Convert to chart-ready array
  return Array.from(dateCounts.entries()).map(([date, count]) => ({
    date,
    count,
  }));
}

/**
 * Aggregate detection records by ingestion modality (Image, Video, Live Camera).
 */
export function aggregateModalityDistribution(records: DetectionRecord[]): ModalityChartData[] {
  let imageCount = 0;
  let videoCount = 0;
  let liveCount = 0;

  for (const r of records) {
    const count = Math.max(1, r.potholeCount || 1);
    const mode = (r.inputType || "").toLowerCase();
    if (mode === "video") {
      videoCount += count;
    } else if (mode === "live") {
      liveCount += count;
    } else {
      imageCount += count;
    }
  }

  return [
    { modality: "Image Detection", count: imageCount, color: "hsl(217 91% 60%)" },
    { modality: "Video Scan", count: videoCount, color: "hsl(185 80% 55%)" },
    { modality: "Live Camera Feed", count: liveCount, color: "hsl(270 70% 60%)" },
  ];
}

/**
 * Spatial clustering algorithm to identify Pothole Hotspots.
 * Groups defects within 50 meters into localized high-risk clusters.
 */
export function findPotholeHotspots(
  records: DetectionRecord[],
  radiusMeters: number = HOTSPOT_RADIUS_M
): PotholeHotspot[] {
  const valid = records.filter(
    (r) =>
      r &&
      typeof r.latitude === "number" &&
      typeof r.longitude === "number" &&
      !isNaN(r.latitude) &&
      !isNaN(r.longitude)
  );

  if (valid.length === 0) {
    return [];
  }

  const visited = new Set<string>();
  const clusters: {
    members: DetectionRecord[];
  }[] = [];

  const BOX_DELTA = 0.0006; // ~65m pre-filter for performance

  for (let i = 0; i < valid.length; i++) {
    const root = valid[i];
    const rootId = String(root.id);
    if (visited.has(rootId)) continue;

    visited.add(rootId);
    const clusterMembers: DetectionRecord[] = [root];

    for (let j = i + 1; j < valid.length; j++) {
      const candidate = valid[j];
      const candId = String(candidate.id);
      if (visited.has(candId)) continue;

      // Fast bounding box check
      if (
        Math.abs(root.latitude! - candidate.latitude!) < BOX_DELTA &&
        Math.abs(root.longitude! - candidate.longitude!) < BOX_DELTA
      ) {
        const dist = haversineDistance(
          root.latitude!,
          root.longitude!,
          candidate.latitude!,
          candidate.longitude!
        );

        if (dist <= radiusMeters) {
          visited.add(candId);
          clusterMembers.push(candidate);
        }
      }
    }

    clusters.push({ members: clusterMembers });
  }

  // Filter to clusters with at least 2 defects or 1 multi-pothole event
  // Then compute centroids and stats
  const hotspots: PotholeHotspot[] = clusters
    .map((c, index) => {
      let totalDefects = 0;
      let severeCount = 0;
      let moderateCount = 0;
      let minorCount = 0;
      let sumLat = 0;
      let sumLng = 0;

      for (const m of c.members) {
        const count = Math.max(1, m.potholeCount || 1);
        totalDefects += count;
        if (m.severity === "Severe") severeCount += count;
        else if (m.severity === "Moderate") moderateCount += count;
        else minorCount += count;

        sumLat += m.latitude!;
        sumLng += m.longitude!;
      }

      const centerLat = sumLat / c.members.length;
      const centerLng = sumLng / c.members.length;

      // Find highest severity in cluster
      let highestSeverity: PotholeSeverity = "Minor";
      if (severeCount > 0) highestSeverity = "Severe";
      else if (moderateCount > 0) highestSeverity = "Moderate";

      // Compute cluster radius
      let maxDist = 0;
      for (const m of c.members) {
        const d = haversineDistance(centerLat, centerLng, m.latitude!, m.longitude!);
        if (d > maxDist) maxDist = d;
      }

      // Risk level for cluster
      let riskClassification: RiskClassification = "Moderate Risk";
      if (severeCount >= 2 || totalDefects >= 4) {
        riskClassification = "Critical Risk";
      } else if (severeCount >= 1 || totalDefects >= 2) {
        riskClassification = "High Risk";
      }

      return {
        id: `HOTSPOT-${index + 1}`,
        rank: 0,
        centerLat: Number(centerLat.toFixed(6)),
        centerLng: Number(centerLng.toFixed(6)),
        totalDefects,
        potholeCount: c.members.length,
        severeCount,
        moderateCount,
        minorCount,
        highestSeverity,
        riskClassification,
        radiusMeters: Math.round(maxDist * 10) / 10,
        records: c.members,
      };
    })
    // Sort clusters: highest severity first (Severe > Moderate > Minor), then defect count descending
    .sort((a, b) => {
      const sevRank = { Severe: 3, Moderate: 2, Minor: 1 };
      if (sevRank[b.highestSeverity] !== sevRank[a.highestSeverity]) {
        return sevRank[b.highestSeverity] - sevRank[a.highestSeverity];
      }
      return b.totalDefects - a.totalDefects;
    });

  // Assign 1-indexed ranks
  hotspots.forEach((h, idx) => {
    h.rank = idx + 1;
    h.id = `HOTSPOT-${idx + 1}`;
  });

  return hotspots;
}
