/**
 * ============================================================================
 * GEOFENCE SERVICE (geofenceService.ts)
 * ============================================================================
 * Calculates point-in-circle hub detection for loading/unloading geofences.
 * Detects corridor deviation when vehicle strays > 15km from planned route.
 * Used by the live tracking engine to auto-trigger status transitions.
 * ============================================================================
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Geofence {
  center: GeoPoint;
  radius_meters: number;
  label: string;
}

/**
 * Haversine formula: calculates great-circle distance between two GPS coordinates.
 * Overloads:
 *   - haversineDistance(a: GeoPoint, b: GeoPoint): number  -> returns distance in METERS
 *   - haversineDistance(lat1, lon1, lat2, lon2): number   -> returns distance in KILOMETERS
 */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number;
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
export function haversineDistance(
  arg1: GeoPoint | number,
  arg2: GeoPoint | number,
  arg3?: number,
  arg4?: number
): number {
  let lat1: number;
  let lon1: number;
  let lat2: number;
  let lon2: number;
  let inKm = false;

  if (typeof arg1 === 'number') {
    lat1 = arg1;
    lon1 = arg2 as number;
    lat2 = arg3 as number;
    lon2 = arg4 as number;
    inKm = true;
  } else {
    lat1 = arg1.latitude;
    lon1 = arg1.longitude;
    const b = arg2 as GeoPoint;
    lat2 = b.latitude;
    lon2 = b.longitude;
  }

  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const h =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const meters = R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return inKm ? meters / 1000 : meters;
}

/**
 * Checks if a GPS point is within a circular geofence.
 */
export function isPointInGeofence(point: GeoPoint, fence: Geofence): boolean {
  const distance = haversineDistance(point, fence.center);
  return distance <= fence.radius_meters;
}

/**
 * Detects if a vehicle has deviated from the planned corridor.
 * Evaluates perpendicular cross-track distance to each segment formed by corridor waypoints.
 * If vehicle is > maxDeviationKm away from the closest segment point, a deviation is flagged.
 *
 * Overloads:
 *   - isCorridorDeviation(currentPosition: GeoPoint, waypoints: GeoPoint[], maxKm?: number): boolean
 *   - isCorridorDeviation(lat: number, lon: number, waypoints: GeoPoint[], maxKm?: number): boolean
 */
export function isCorridorDeviation(
  posOrLat: GeoPoint | number,
  wayOrLon: GeoPoint[] | number,
  wayOrMax?: GeoPoint[] | number,
  maxDevKm?: number
): boolean {
  let pos: GeoPoint;
  let waypoints: GeoPoint[];
  let maxKm = 15;

  if (typeof posOrLat === 'number') {
    pos = { latitude: posOrLat, longitude: wayOrLon as number };
    waypoints = wayOrMax as GeoPoint[];
    if (typeof maxDevKm === 'number') maxKm = maxDevKm;
  } else {
    pos = posOrLat;
    waypoints = wayOrLon as GeoPoint[];
    if (typeof wayOrMax === 'number') maxKm = wayOrMax;
  }

  if (!waypoints || waypoints.length === 0) return false;

  // Single waypoint fallback
  if (waypoints.length === 1) {
    const distKm = haversineDistance(pos.latitude, pos.longitude, waypoints[0].latitude, waypoints[0].longitude);
    return distKm > maxKm;
  }

  // Segment cross-track calculation across all consecutive waypoints
  let minDistanceKm = Infinity;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const w1 = waypoints[i];
    const w2 = waypoints[i + 1];

    const midLat = ((w1.latitude + w2.latitude) / 2) * (Math.PI / 180);
    const cosMidLat = Math.cos(midLat);

    const dx = (w2.longitude - w1.longitude) * cosMidLat;
    const dy = w2.latitude - w1.latitude;
    const segLenSq = dx * dx + dy * dy;

    let closestLat = w1.latitude;
    let closestLon = w1.longitude;

    if (segLenSq > 0) {
      const px = (pos.longitude - w1.longitude) * cosMidLat;
      const py = pos.latitude - w1.latitude;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
      closestLat = w1.latitude + t * (w2.latitude - w1.latitude);
      closestLon = w1.longitude + t * (w2.longitude - w1.longitude);
    }

    const distKm = haversineDistance(pos.latitude, pos.longitude, closestLat, closestLon);
    if (distKm < minDistanceKm) {
      minDistanceKm = distKm;
    }
  }

  return minDistanceKm > maxKm;
}

/**
 * Creates a default geofence around a lat/lng coordinate (500m default for hub detection).
 */
export function createHubGeofence(
  center: GeoPoint,
  label: string,
  radiusMeters = 500
): Geofence {
  return { center, radius_meters: radiusMeters, label };
}

/**
 * Calculates estimated ETA based on remaining distance and average speed.
 * @param remainingDistanceKm  - Distance left to destination in km
 * @param avgSpeedKmh          - Historical or live average speed in km/h
 * @returns                    - ETA as ISO date string, or null if inputs invalid
 */
export function calculateETA(
  remainingDistanceKm: number,
  avgSpeedKmh: number
): string | null {
  if (remainingDistanceKm <= 0 || avgSpeedKmh <= 0) return null;
  const hoursRemaining = remainingDistanceKm / avgSpeedKmh;
  const eta = new Date(Date.now() + hoursRemaining * 3600 * 1000);
  return eta.toISOString();
}

/**
 * Formats remaining time into a human-readable string (e.g. "3h 45m").
 */
export function formatETA(etaIso: string): string {
  const now = Date.now();
  const etaMs = new Date(etaIso).getTime();
  const diffMs = etaMs - now;
  if (diffMs <= 0) return 'Arrived';
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
