/**
 * Geographic calculations and Flash tier classification for Flashfix platform.
 */

export interface GeoLocation {
  lat: number;
  lng: number;
}

export type StoreServiceTier = 'flash' | 'next-day' | 'out-of-range';

export interface StoreTierResult {
  distanceKm: number;
  tier: StoreServiceTier;
  isFlashHero: boolean;
  estimatedPickupMinutes: number | null;
}

/**
 * Calculates great-circle distance between two coordinates using the Haversine formula.
 * Earth radius is 6371 km. Result is returned in kilometers rounded to 2 decimal places.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 2 decimal places
  return Math.round(distance * 100) / 100;
}

/**
 * Calculates tier and Flash badge eligibility based on distance in kilometers.
 * - <= 3.0 km -> 'flash' (⚡ 20-min pickup window)
 * - <= 10.0 km -> 'next-day'
 * - > 10.0 km -> 'out-of-range'
 */
export function calculateStoreTier(distanceKm: number): StoreTierResult {
  if (distanceKm <= 3.0) {
    return {
      distanceKm,
      tier: 'flash',
      isFlashHero: true,
      estimatedPickupMinutes: 20
    };
  }

  if (distanceKm <= 10.0) {
    return {
      distanceKm,
      tier: 'next-day',
      isFlashHero: false,
      estimatedPickupMinutes: 1440 // next day window
    };
  }

  return {
    distanceKm,
    tier: 'out-of-range',
    isFlashHero: false,
    estimatedPickupMinutes: null
  };
}
