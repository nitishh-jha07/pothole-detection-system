import type { DetectionRecord } from "./pothole";

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface EncounteredPothole {
  potholeId: string;
  record: DetectionRecord;
  encounteredAt: string; // formatted time or ISO string
  distanceAtEncounter: number; // in meters
}

export interface RouteSession {
  id: string;
  status: "idle" | "active" | "completed";
  startTime: string | null;
  endTime: string | null;
  path: RouteCoordinate[];
  distanceTraveledMeters: number;
  encounteredPotholes: EncounteredPothole[];
  summary: {
    totalEncountered: number;
    severeCount: number;
    moderateCount: number;
    minorCount: number;
  };
}

export const initialRouteSession: RouteSession = {
  id: "",
  status: "idle",
  startTime: null,
  endTime: null,
  path: [],
  distanceTraveledMeters: 0,
  encounteredPotholes: [],
  summary: {
    totalEncountered: 0,
    severeCount: 0,
    moderateCount: 0,
    minorCount: 0,
  },
};
