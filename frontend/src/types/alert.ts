import type { DetectionRecord, PotholeSeverity } from "./pothole";

export type AlertLevel = PotholeSeverity;

export type SafetyAlertStatus = "idle" | "active" | "dismissed";

export interface ActiveAlertData {
  potholeId: string;
  record: DetectionRecord;
  severity: PotholeSeverity;
  distance: number;
  threshold: number;
  rearmDistance: number;
  confidence: number;
  additionalCount: number; // count of other eligible potholes within their thresholds
}
