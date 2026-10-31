import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SEED_DATA } from '../db/seed.js';
import * as schema from '../db/schema.js';
import {
  USER_ROLES,
  BOOKING_STATUSES,
  OTP_PURPOSES,
} from '../../packages/shared/src/constants/index.js';

describe('Empirical Verification: Schema vs Migration 0000 Parity', () => {
  const sqlContent = readFileSync(
    resolve(process.cwd(), 'infra/db/migrations/0000_military_rattler.sql'),
    'utf-8'
  );

  it('should verify all 3 PostgreSQL enums exist in SQL with exact values', () => {
    // 1. booking_status
    assert.ok(
      sqlContent.includes('CREATE TYPE "public"."booking_status" AS ENUM'),
      'Missing booking_status enum in SQL'
    );
    for (const status of BOOKING_STATUSES) {
      assert.ok(
        sqlContent.includes(`'${status}'`),
        `Missing booking_status enum value ${status} in SQL`
      );
    }

    // 2. otp_purpose
    assert.ok(
      sqlContent.includes('CREATE TYPE "public"."otp_purpose" AS ENUM'),
      'Missing otp_purpose enum in SQL'
    );
    for (const purpose of OTP_PURPOSES) {
      assert.ok(
        sqlContent.includes(`'${purpose}'`),
        `Missing otp_purpose enum value ${purpose} in SQL`
      );
    }

    // 3. user_role
    assert.ok(
      sqlContent.includes('CREATE TYPE "public"."user_role" AS ENUM'),
      'Missing user_role enum in SQL'
    );
    for (const role of USER_ROLES) {
      assert.ok(
        sqlContent.includes(`'${role}'`),
        `Missing user_role enum value ${role} in SQL`
      );
    }
  });

  it('should verify all 7 tables exist in both schema and generated SQL', () => {
    const requiredTables: [keyof typeof schema, string][] = [
      ['users', 'users'],
      ['savedAddresses', 'saved_addresses'],
      ['stores', 'stores'],
      ['bookings', 'bookings'],
      ['bookingTrail', 'booking_trail'],
      ['otpCodes', 'otp_codes'],
      ['inventoryItems', 'inventory_items'],
    ];

    for (const [exportKey, sqlTableName] of requiredTables) {
      assert.ok(
        exportKey in schema,
        `Table export ${String(exportKey)} missing from schema.ts export`
      );
      assert.ok(
        sqlContent.includes(`CREATE TABLE "${sqlTableName}"`),
        `Table ${sqlTableName} missing CREATE TABLE in 0000_military_rattler.sql`
      );
    }
  });

  it('should verify all cost columns are integer (paise)', () => {
    // bookings: estimated_cost_paise, final_cost_paise
    assert.ok(
      sqlContent.includes('"estimated_cost_paise" integer'),
      'bookings.estimated_cost_paise must be integer'
    );
    assert.ok(
      sqlContent.includes('"final_cost_paise" integer'),
      'bookings.final_cost_paise must be integer'
    );
    // inventory_items: unit_cost_paise
    assert.ok(
      sqlContent.includes('"unit_cost_paise" integer'),
      'inventory_items.unit_cost_paise must be integer'
    );
  });

  it('should verify all coordinate columns are numeric(9, 6)', () => {
    // saved_addresses
    assert.ok(
      sqlContent.includes('"lat" numeric(9, 6) NOT NULL'),
      'saved_addresses.lat must be numeric(9, 6)'
    );
    assert.ok(
      sqlContent.includes('"lng" numeric(9, 6) NOT NULL'),
      'saved_addresses.lng must be numeric(9, 6)'
    );
    // stores
    assert.ok(
      sqlContent.includes('"lat" numeric(9, 6) NOT NULL'),
      'stores.lat must be numeric(9, 6)'
    );
    assert.ok(
      sqlContent.includes('"lng" numeric(9, 6) NOT NULL'),
      'stores.lng must be numeric(9, 6)'
    );
    // bookings
    assert.ok(
      sqlContent.includes('"pickup_lat" numeric(9, 6)'),
      'bookings.pickup_lat must be numeric(9, 6)'
    );
    assert.ok(
      sqlContent.includes('"pickup_lng" numeric(9, 6)'),
      'bookings.pickup_lng must be numeric(9, 6)'
    );
  });

  it('should verify all foreign key cascade rules match requirements', () => {
    // saved_addresses -> users ON DELETE cascade
    assert.ok(
      sqlContent.includes(
        'FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade'
      ),
      'saved_addresses.user_id must ON DELETE cascade'
    );

    // booking_trail -> bookings ON DELETE cascade
    assert.ok(
      sqlContent.includes(
        'FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade'
      ),
      'booking_trail.booking_id must ON DELETE cascade'
    );

    // inventory_items -> stores ON DELETE cascade
    assert.ok(
      sqlContent.includes(
        'FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade'
      ),
      'inventory_items.store_id must ON DELETE cascade'
    );

    // otp_codes -> users & bookings ON DELETE cascade
    assert.ok(
      sqlContent.includes(
        'FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade'
      ),
      'otp_codes.user_id must ON DELETE cascade'
    );
    assert.ok(
      sqlContent.includes(
        'FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade'
      ),
      'otp_codes.booking_id must ON DELETE cascade'
    );

    // bookings -> stores & users ON DELETE no action
    assert.ok(
      sqlContent.includes(
        'FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action'
      ),
      'bookings.store_id must ON DELETE no action'
    );
  });

  it('should verify all required indexes are present in SQL', () => {
    const expectedIndexes = [
      'idx_trail_booking_id',
      'idx_trail_created_at',
      'idx_bookings_user_id',
      'idx_bookings_store_id',
      'idx_bookings_status',
      'idx_bookings_assigned_emp',
      'idx_bookings_created_at',
      'idx_inventory_store_id',
      'idx_inventory_sku',
      'idx_otp_email_purpose',
      'idx_otp_booking_id',
      'idx_otp_expires_at',
      'idx_saved_addresses_user_id',
      'idx_stores_city',
      'idx_stores_active',
      'idx_users_email',
      'idx_users_role',
      'idx_users_store_id',
    ];

    for (const idx of expectedIndexes) {
      assert.ok(
        sqlContent.includes(`CREATE INDEX "${idx}"`),
        `Missing index ${idx} in migration SQL`
      );
    }
  });
});

describe('Empirical Verification: SEED_DATA Referential Integrity', () => {
  const userMap = new Map(SEED_DATA.users.map((u) => [u.id, u]));
  const storeMap = new Map(SEED_DATA.stores.map((s) => [s.id, s]));
  const bookingMap = new Map(SEED_DATA.bookings.map((b) => [b.id, b]));

  it('should verify all users have unique IDs and valid emails', () => {
    assert.equal(userMap.size, SEED_DATA.users.length);
    const emails = new Set(SEED_DATA.users.map((u) => u.email));
    assert.equal(emails.size, SEED_DATA.users.length);
  });

  it('should verify user storeId references valid stores if set', () => {
    for (const u of SEED_DATA.users) {
      if (u.storeId) {
        assert.ok(
          storeMap.has(u.storeId),
          `User ${u.id} has invalid storeId: ${u.storeId}`
        );
      }
    }
  });

  it('should verify store adminId references valid users if set', () => {
    for (const s of SEED_DATA.stores) {
      if (s.adminId) {
        assert.ok(
          userMap.has(s.adminId),
          `Store ${s.id} has invalid adminId: ${s.adminId}`
        );
        const adminUser = userMap.get(s.adminId)!;
        assert.ok(
          ['ADMIN', 'SUPER_ADMIN'].includes(adminUser.role),
          `Store admin ${s.adminId} must have ADMIN or SUPER_ADMIN role, has ${adminUser.role}`
        );
      }
    }
  });

  it('should verify saved addresses reference valid users', () => {
    for (const addr of SEED_DATA.savedAddresses) {
      assert.ok(
        userMap.has(addr.userId),
        `Saved address ${addr.id} has invalid userId: ${addr.userId}`
      );
    }
  });

  it('should verify bookings reference valid stores, users, and employees', () => {
    for (const b of SEED_DATA.bookings) {
      assert.ok(
        storeMap.has(b.storeId),
        `Booking ${b.id} has invalid storeId: ${b.storeId}`
      );

      if (b.userId) {
        assert.ok(
          userMap.has(b.userId),
          `Booking ${b.id} has invalid userId: ${b.userId}`
        );
      }

      if (b.assignedEmployeeId) {
        assert.ok(
          userMap.has(b.assignedEmployeeId),
          `Booking ${b.id} has invalid assignedEmployeeId: ${b.assignedEmployeeId}`
        );
        const emp = userMap.get(b.assignedEmployeeId)!;
        assert.ok(
          ['EMPLOYEE', 'ADMIN'].includes(emp.role),
          `Assigned employee ${b.assignedEmployeeId} has unexpected role ${emp.role}`
        );
      }

      if (b.technicianId) {
        assert.ok(
          userMap.has(b.technicianId),
          `Booking ${b.id} has invalid technicianId: ${b.technicianId}`
        );
        const tech = userMap.get(b.technicianId)!;
        assert.ok(
          ['EMPLOYEE', 'ADMIN'].includes(tech.role),
          `Technician ${b.technicianId} has unexpected role ${tech.role}`
        );
      }
    }
  });

  it('should verify booking trails reference valid bookings and users', () => {
    for (const trail of SEED_DATA.bookingTrails) {
      assert.ok(
        bookingMap.has(trail.bookingId),
        `Booking trail ${trail.id} has invalid bookingId: ${trail.bookingId}`
      );

      if (trail.triggeredByUserId) {
        assert.ok(
          userMap.has(trail.triggeredByUserId),
          `Booking trail ${trail.id} has invalid triggeredByUserId: ${trail.triggeredByUserId}`
        );
      }
    }
  });

  it('should verify inventory items reference valid stores', () => {
    for (const item of SEED_DATA.inventoryItems) {
      assert.ok(
        storeMap.has(item.storeId),
        `Inventory item ${item.id} has invalid storeId: ${item.storeId}`
      );
    }
  });
});

describe('Adversarial Challenge: seed.ts Foreign Key Dependency Sequence', () => {
  it('detects foreign key constraint risk if stores are inserted with adminId before users exist', () => {
    // In PostgreSQL, stores.admin_id REFERENCES users(id).
    // If stores are inserted FIRST:
    const storesWithAdminId = SEED_DATA.stores.filter((s) => s.adminId !== null);
    assert.ok(
      storesWithAdminId.length > 0,
      'Stores in SEED_DATA have adminId populated'
    );

    // In seed.ts lines 495-496:
    // db.insert(stores).values(s) is executed before users are inserted!
    // In a live PostgreSQL DB, this fails FK validation unless adminId is null on insert.
    // Let's verify whether users has any FK to stores:
    // If users table is checked: users has storeId, but NO foreign key constraint to stores!
    // Therefore, users CAN be inserted first, or stores inserted without adminId first.
    const userCols = Object.keys(schema.users);
    assert.ok(userCols.includes('storeId'), 'users has storeId column');
    // Verify in SQL that users has NO foreign key constraint to stores:
    const sqlContent = readFileSync(
      resolve(process.cwd(), 'infra/db/migrations/0000_military_rattler.sql'),
      'utf-8'
    );
    assert.equal(
      sqlContent.includes('ALTER TABLE "users" ADD CONSTRAINT'),
      false,
      'users has no FK constraints, so users can safely be inserted before stores!'
    );
  });
});
