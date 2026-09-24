/**
 * High-precision Geodesic & GPS Utilities for Smart Voyager AI Live Group Tracking
 */

export interface GpsCoordinates {
  lat: number;
  lng: number;
}

/**
 * Calculates great-circle distance between two points on a sphere (Haversine formula).
 * Returns distance in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's mean radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats a metric distance into human-friendly string (e.g., '140 m' or '1.4 km')
 */
export function formatDistance(meters: number): string {
  if (isNaN(meters) || meters === null || meters === undefined) return 'Nearby';
  if (meters < 10) return 'Right here (<10m)';
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Calculates initial bearing in degrees (0° to 360°) from point 1 to point 2
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (Math.round((θ * 180) / Math.PI) + 360) % 360;
}

/**
 * Converts degrees into 8-point compass direction
 */
export function getCompassDirection(bearingDeg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const index = Math.round(bearingDeg / 45);
  return directions[index % 8];
}

/**
 * Determines whether a group member has wandered beyond a safety perimeter threshold
 */
export function isMemberWandering(
  memberCoords: GpsCoordinates,
  centerCoords: GpsCoordinates,
  thresholdMeters: number = 500
): { wandering: boolean; distance: number } {
  const distance = calculateDistanceMeters(
    memberCoords.lat,
    memberCoords.lng,
    centerCoords.lat,
    centerCoords.lng
  );
  return {
    wandering: distance > thresholdMeters,
    distance,
  };
}

/**
 * Generates small realistic GPS wander delta (~10-25 meters) for live simulation
 */
export function generateGpsJitter(coords: GpsCoordinates): GpsCoordinates {
  // ~0.0001 degrees latitude is approximately 11.1 meters
  const deltaLat = (Math.random() - 0.5) * 0.0003;
  const deltaLng = (Math.random() - 0.5) * 0.0003;
  return {
    lat: Number((coords.lat + deltaLat).toFixed(6)),
    lng: Number((coords.lng + deltaLng).toFixed(6)),
  };
}
