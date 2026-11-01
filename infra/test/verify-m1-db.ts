import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

async function verify() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('--- Verifying users and password_hash ---');
  const usersRes = await pool.query(
    `SELECT email, role, (password_hash IS NOT NULL) as has_password, substring(password_hash from 1 for 10) as hash_prefix FROM users WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN') ORDER BY email`
  );
  console.log('Staff users:', usersRes.rows);

  // Test bcrypt verification for superadmin
  const saRes = await pool.query(`SELECT password_hash FROM users WHERE email = 'superadmin@flashfix.in'`);
  const saHash = saRes.rows[0]?.password_hash;
  const isMatch = bcrypt.compareSync('Admin@123', saHash);
  console.log('Superadmin password verify (Admin@123):', isMatch);

  console.log('--- Verifying store_admins junction table ---');
  const saTableRes = await pool.query(`SELECT sa.id, sa.store_id, u.email FROM store_admins sa JOIN users u ON sa.user_id = u.id ORDER BY sa.store_id, u.email`);
  console.log('Store admins junction rows:', saTableRes.rows);

  console.log('--- Verifying user_role enum ---');
  const enumRes = await pool.query(`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype ORDER BY enumlabel`);
  console.log('user_role enum labels:', enumRes.rows.map(r => r.enumlabel));

  await pool.end();
}

verify().catch(console.error);
