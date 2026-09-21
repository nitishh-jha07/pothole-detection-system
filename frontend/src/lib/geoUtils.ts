// src/lib/geoUtils.ts
export const PROXIMITY_THRESHOLD_M = 50; // meters - configurable proximity (Phase 4)
export const ROUTE_ASSOCIATION_THRESHOLD_M = 25; // meters - configurable route encounter threshold (Phase 6)
export const ALERT_THRESHOLD_M = 35; // meters - maximum/base alert radius (Phase 7)

export const SEVERITY_ALERT_DISTANCES = {
  Severe: 35,
  Moderate: 25,
  Minor: 20,
} as const;

export const ALERT_REARM_HYSTERESIS_M = 10; // meters buffer beyond threshold to re-arm

export function getSeverityAlertThreshold(severity: string): number {
  if (severity === "Severe") return SEVERITY_ALERT_DISTANCES.Severe;
  if (severity === "Moderate") return SEVERITY_ALERT_DISTANCES.Moderate;
  return SEVERITY_ALERT_DISTANCES.Minor;
}

export function getSeverityRearmDistance(severity: string): number {
  return getSeverityAlertThreshold(severity) + ALERT_REARM_HYSTERESIS_M;
}

/**
 * Calculate the Haversine distance between two latitude/longitude points.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate the cumulative distance along a sequence of GPS coordinates in meters.
 */
export function calculatePathDistance(
  coords: { latitude: number; longitude: number }[]
): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(
      coords[i - 1].latitude,
      coords[i - 1].longitude,
      coords[i].latitude,
      coords[i].longitude
    );
  }
  return total;
}
