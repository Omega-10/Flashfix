// Haversine formula — great-circle distance between two lat/lng points
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type RadiusTier = "flash" | "next-day" | "out-of-range";

export function getRadiusTier(km: number): RadiusTier {
  if (km <= 4) return "flash";       // ≤4km shows Flash (≤3km = same-day USP hero)
  if (km <= 10) return "next-day";
  return "out-of-range";
}
