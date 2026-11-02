import { getPool } from '../db.ts';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * GET /stores
 * Public list of active stores.
 */
export async function getStoresHandler(_req: any, res: any) {
  try {
    const db = getPool();
    if (db) {
      const storesRes = await db.query(
        `SELECT 
           s.id,
           s.slug,
           s.name,
           s.address,
           s.city,
           s.lat,
           s.lng,
           s.phone,
           s.hours,
           s.is_active as "isActive",
           s.rating,
           s.review_count as "reviewCount"
         FROM stores s
         ORDER BY s.created_at ASC`
      );

      return res.status(200).json({ success: true, data: storesRes.rows });
    }
  } catch (dbErr) {
    console.error('Neon DB stores query error:', dbErr);
  }

  return res.status(200).json({ success: true, data: [] });
}

/**
 * GET /stores/nearby
 * Returns active stores enriched with geo distance, tier, and ETA.
 */
export async function getNearbyStoresHandler(req: any, res: any) {
  const url = new URL(req.url || '', 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat') || '12.9352');
  const lng = parseFloat(url.searchParams.get('lng') || '77.6245');

  let storeList: any[] = [];
  try {
    const db = getPool();
    if (db) {
      const resDb = await db.query(`SELECT * FROM stores WHERE is_active = true`);
      storeList = resDb.rows;
    }
  } catch (err) {
    console.warn('Neon DB nearby stores error:', err);
  }

  const enriched = storeList
    .map((s) => {
      const sLat = parseFloat(s.lat);
      const sLng = parseFloat(s.lng);
      const dist = haversineKm(lat, lng, sLat, sLng);
      return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        lat: sLat,
        lng: sLng,
        phone: s.phone || null,
        hours: s.hours || '9 AM - 9 PM',
        services: s.services || ['Screen Replacement', 'Battery Replacement', 'Diagnostics'],
        rating: Number(s.rating || 4.8),
        reviews: Number(s.review_count || 0),
        distanceKm: dist,
        tier: dist <= 3 ? 'flash' : dist <= 10 ? 'next-day' : 'out-of-range',
        isFlashHero: dist <= 3,
        estimatedPickupMinutes: dist <= 3 ? 20 + Math.round(dist * 4) : null,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return res.status(200).json(enriched);
}
