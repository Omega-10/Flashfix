import { Pool } from 'pg';

const NEON_DB_URL = process.env.DATABASE_URL || '';

let pool: Pool | null = null;
function getPool(): Pool | null {
  if (!NEON_DB_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: NEON_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 5000,
    });
  }
  return pool;
}

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
  } catch {
    storeList = [
      { id: 'store-001', name: 'Flashfix — Koramangala', address: '12th Main, 4th Block', city: 'Bengaluru', lat: '12.9352', lng: '77.6245', rating: '4.80', reviewCount: 342 },
      { id: 'store-002', name: 'Flashfix — Indiranagar', address: '100 Feet Road', city: 'Bengaluru', lat: '12.9784', lng: '77.6408', rating: '4.70', reviewCount: 218 },
      { id: 'store-003', name: 'Flashfix — HSR Layout', address: 'Sector 2, HSR Layout', city: 'Bengaluru', lat: '12.9116', lng: '77.6389', rating: '4.90', reviewCount: 504 },
    ];
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
        phone: s.phone || '+91 98765 43210',
        hours: s.hours || '9 AM - 9 PM',
        services: s.services || ['Screen Replacement', 'Battery Replacement', 'Water Damage', 'Diagnostics'],
        rating: Number(s.rating || 4.8),
        reviews: Number(s.review_count || s.reviews || s.reviewCount || 128),
        distanceKm: dist,
        tier: dist <= 3 ? 'flash' : dist <= 10 ? 'next-day' : 'out-of-range',
        isFlashHero: dist <= 3,
        estimatedPickupMinutes: dist <= 3 ? 20 + Math.round(dist * 4) : null,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return res.status(200).json(enriched);
}
