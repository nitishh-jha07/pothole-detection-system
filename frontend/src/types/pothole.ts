export type PotholeSeverity = "Minor" | "Moderate" | "Severe";
export type DetectionInputType = "Image" | "Video" | "Live";

export interface DetectionRecord {
  id: string; // e.g. "PTH-001"
  date: string; // e.g. "2026-09-17"
  time: string; // e.g. "12:45:30"
  latitude: number | null;
  longitude: number | null;
  potholeCount: number;
  severity: PotholeSeverity;
  confidence: number; // e.g. 0.92 or 92
  // UI‑only optional fields – not persisted in DB
  distance?: number;
  isKnown?: boolean;
  isDuplicate?: boolean;
  action?: "created" | "updated";
  inputType: DetectionInputType;
  outputUrl?: string;
  description?: string;
}

export interface PotholeRecord {
  id: string;
  severity: PotholeSeverity;
  confidence: number; // percentage (0 - 100) or decimal
  latitude: number;
  longitude: number;
  timestamp: string; // formatted time, e.g. "12:35 PM"
  inputType?: "image" | "video" | "live" | "Image" | "Video" | "Live";
  description?: string;
  potholeCount?: number;
  distance?: number;
  isKnown?: boolean;
}
