import { GEO_CONSTANTS } from '../constants/index.js';

export type RadiusTier = 'flash' | 'next-day' | 'out-of-range';

/**
 * Haversine formula — great-circle distance between two lat/lng points in kilometers.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = GEO_CONSTANTS.EARTH_RADIUS_KM;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Round to 2 decimal places
}

/**
 * Determines store radius tier based on distance in kilometers:
 * - <= 3.0 km: Flash tier (Flash Hero)
 * - <= 10.0 km: Next-Day tier
 * - > 10.0 km: Out of range
 */
export function getRadiusTier(km: number): RadiusTier {
  if (km <= GEO_CONSTANTS.FLASH_RADIUS_KM) {
    return 'flash';
  }
  if (km <= GEO_CONSTANTS.NEXT_DAY_RADIUS_KM) {
    return 'next-day';
  }
  return 'out-of-range';
}

/**
 * Calculates estimated pickup minutes based on distance.
 * Returns 20 minutes for Flash Hero (<= 3km), null if out-of-range.
 */
export function calculateEstimatedMinutes(km: number): number | null {
  if (km <= GEO_CONSTANTS.FLASH_RADIUS_KM) {
    return GEO_CONSTANTS.ESTIMATED_FLASH_MINUTES;
  }
  if (km <= GEO_CONSTANTS.NEXT_DAY_RADIUS_KM) {
    return 1440; // Next-day (24 hours)
  }
  return null;
}
