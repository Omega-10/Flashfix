import { Pool } from 'pg';

const NEON_DB_URL = process.env.DATABASE_URL || '';

let pool: Pool | null = null;
function getPool(): Pool | null {
  if (!NEON_DB_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: NEON_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '', 'http://localhost');
  const storeId = url.searchParams.get('storeId');
  const filterStore = storeId && storeId !== 'ALL' ? storeId : null;
  const status = url.searchParams.get('status');
  const filterStatus = status && status !== 'ALL' ? status : null;
  const search = url.searchParams.get('search');
  const filterSearch = search ? `%${search.trim().toLowerCase()}%` : null;

  try {
    const db = getPool();
    if (db) {
      const resDb = await db.query(
        `SELECT 
           b.id,
           b.tracking_code as "trackingCode",
           b.brand,
           b.device_model as "deviceModel",
           b.issue_type as "issueType",
           b.issue_description as "issueDescription",
           b.store_id as "storeId",
           b.scheduled_date as "scheduledDate",
           b.scheduled_time as "scheduledTime",
           b.pickup_address as "pickupAddress",
           b.pickup_lat as "pickupLat",
           b.pickup_lng as "pickupLng",
           b.contact_name as "contactName",
           b.contact_email as "contactEmail",
           b.contact_phone as "contactPhone",
           b.status,
           b.estimated_cost_paise as "estimatedCostPaise",
           b.final_cost_paise as "finalCostPaise",
           b.payment_method as "paymentMethod",
           b.payment_status as "paymentStatus",
           b.notes,
           b.assigned_employee_id as "assignedEmployeeId",
           u1.name as "assignedEmployeeName",
           b.technician_id as "technicianId",
           u2.name as "technicianName",
           b.pickup_otp as "pickupOtp",
           b.custody_otp as "custodyOtp",
           b.created_at as "createdAt",
           b.updated_at as "updatedAt"
         FROM bookings b
         LEFT JOIN users u1 ON b.assigned_employee_id = u1.id
         LEFT JOIN users u2 ON b.technician_id = u2.id
         WHERE ($1::text IS NULL OR b.store_id = $1)
           AND ($2::text IS NULL OR b.status = $2)
           AND ($3::text IS NULL OR (
             LOWER(b.id) LIKE $3 OR 
             LOWER(b.contact_name) LIKE $3 OR 
             LOWER(b.contact_phone) LIKE $3 OR 
             LOWER(b.device_model) LIKE $3 OR 
             LOWER(b.brand) LIKE $3
           ))
         ORDER BY b.created_at DESC`,
        [filterStore, filterStatus, filterSearch]
      );

      return res.status(200).json({
        success: true,
        data: resDb.rows,
      });
    }
  } catch (err: any) {
    console.warn('Bookings API error:', err);
  }

  return res.status(200).json({
    success: true,
    data: [],
  });
}
