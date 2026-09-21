import type { DetectionRecord, PotholeSeverity } from "./pothole";

export type RiskClassification = "Low Risk" | "Moderate Risk" | "High Risk" | "Critical Risk";

export interface RoadRiskMetrics {
  score: number; // 0 - 100
  classification: RiskClassification;
  totalPotholes: number;
  severeCount: number;
  moderateCount: number;
  minorCount: number;
  severeRatio: number; // percentage 0 - 100
  averageConfidence: number; // percentage 0 - 100
  volumeDampener: number;
  severityRatio: number;
}

export interface PotholeHotspot {
  id: string; // e.g. "HOTSPOT-1"
  rank: number;
  centerLat: number;
  centerLng: number;
  totalDefects: number;
  potholeCount: number;
  severeCount: number;
  moderateCount: number;
  minorCount: number;
  highestSeverity: PotholeSeverity;
  riskClassification: RiskClassification;
  radiusMeters: number;
  records: DetectionRecord[];
}

export interface SeverityChartData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

export interface TemporalChartData {
  date: string;
  count: number;
}

export interface ModalityChartData {
  modality: string;
  count: number;
  color: string;
}

export interface RouteRiskMetrics {
  distanceKm: number;
  encounteredCount: number;
  defectsPerKm: number;
  severeCount: number;
  moderateCount: number;
  minorCount: number;
  averageConfidence: number;
  score: number; // 0 - 100
  classification: RiskClassification;
}
