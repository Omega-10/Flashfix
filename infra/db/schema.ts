import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. PostgreSQL Enums
export const userRoleEnum = pgEnum('user_role', [
  'CONSUMER',
  'EMPLOYEE',
  'ADMIN',
  'SUPER_ADMIN',
  'TECHNICIAN',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'PENDING',
  'CONFIRMED',
  'PICKUP_EN_ROUTE',
  'PICKUP_OTP_SENT',
  'IN_TRANSIT',
  'CUSTODY_OTP_SENT',
  'IN_REPAIR',
  'REPAIR_COMPLETE',
  'RETURN_EN_ROUTE',
  'DELIVERED',
  'CANCELLED',
]);

export const otpPurposeEnum = pgEnum('otp_purpose', [
  'LOGIN',
  'PICKUP',
  'CUSTODY',
]);

// 2. Users Table
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone'),
    role: userRoleEnum('role').default('CONSUMER').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    googleId: text('google_id').unique(),
    avatarUrl: text('avatar_url'),
    storeId: text('store_id'), // Home store for ADMIN and EMPLOYEE
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
    index('idx_users_store_id').on(table.storeId),
  ]
);

// 3. Saved Addresses Table
export const savedAddresses = pgTable(
  'saved_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    label: text('label'), // "Home", "Office", etc.
    address: text('address').notNull(),
    landmark: text('landmark'),
    lat: numeric('lat', { precision: 9, scale: 6 }).notNull(),
    lng: numeric('lng', { precision: 9, scale: 6 }).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_saved_addresses_user_id').on(table.userId)]
);

// 4. Stores Table
export const stores = pgTable(
  'stores',
  {
    id: text('id').primaryKey(), // 'store-001'
    slug: text('slug').unique(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    lat: numeric('lat', { precision: 9, scale: 6 }).notNull(),
    lng: numeric('lng', { precision: 9, scale: 6 }).notNull(),
    phone: text('phone'),
    openTime: text('open_time'),
    closeTime: text('close_time'),
    hours: text('hours'), // "9 AM – 9 PM"
    services: jsonb('services').$type<string[]>().default([]).notNull(),
    rating: numeric('rating', { precision: 3, scale: 2 }).default('4.80'),
    reviewCount: integer('review_count').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    adminId: uuid('admin_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_stores_city').on(table.city),
    index('idx_stores_active').on(table.isActive),
  ]
);

// 5. Bookings Table
export const bookings = pgTable(
  'bookings',
  {
    id: text('id').primaryKey(), // 'FF-XXXXXX'
    trackingCode: text('tracking_code').notNull().unique(),
    userId: uuid('user_id').references(() => users.id), // Nullable for guest checkout
    storeId: text('store_id')
      .references(() => stores.id)
      .notNull(),
    assignedEmployeeId: uuid('assigned_employee_id').references(() => users.id),
    technicianId: uuid('technician_id').references(() => users.id),

    brand: text('brand').notNull(),
    deviceModel: text('device_model').notNull(),
    issueType: text('issue_type').notNull(),
    issueDescription: text('issue_description'),

    scheduledDate: text('scheduled_date').notNull(),
    scheduledTime: text('scheduled_time').notNull(),

    pickupLat: numeric('pickup_lat', { precision: 9, scale: 6 }),
    pickupLng: numeric('pickup_lng', { precision: 9, scale: 6 }),
    pickupAddress: text('pickup_address').notNull(),

    contactName: text('contact_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone').notNull(),

    status: bookingStatusEnum('status').default('PENDING').notNull(),
    estimatedCostPaise: integer('estimated_cost_paise'),
    finalCostPaise: integer('final_cost_paise'),
    paymentMethod: text('payment_method').default('QR'),
    paymentStatus: text('payment_status').default('UNPAID'),

    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bookings_user_id').on(table.userId),
    index('idx_bookings_store_id').on(table.storeId),
    index('idx_bookings_status').on(table.status),
    index('idx_bookings_assigned_emp').on(table.assignedEmployeeId),
    index('idx_bookings_created_at').on(table.createdAt),
  ]
);

// 6. Booking Trail Table (Immutable Audit Log)
export const bookingTrail = pgTable(
  'booking_trail',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: text('booking_id')
      .references(() => bookings.id, { onDelete: 'cascade' })
      .notNull(),
    fromStatus: bookingStatusEnum('from_status'),
    toStatus: bookingStatusEnum('to_status').notNull(),
    triggeredByUserId: uuid('triggered_by_user_id').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_trail_booking_id').on(table.bookingId),
    index('idx_trail_created_at').on(table.createdAt),
  ]
);

// 7. OTP Codes Table
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    phone: text('phone'),
    codeHash: text('code_hash').notNull(), // bcrypt hashed or crypto hash
    purpose: otpPurposeEnum('purpose').notNull(),
    bookingId: text('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    verified: boolean('verified').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_otp_email_purpose').on(table.email, table.purpose),
    index('idx_otp_booking_id').on(table.bookingId),
    index('idx_otp_expires_at').on(table.expiresAt),
  ]
);

// 8. Inventory Items Table (Skeleton)
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: text('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    partName: text('part_name').notNull(),
    sku: text('sku').unique(),
    compatibleWith: jsonb('compatible_with').$type<string[]>().default([]).notNull(),
    quantity: integer('quantity').default(0).notNull(),
    minThreshold: integer('min_threshold').default(5).notNull(),
    unitCostPaise: integer('unit_cost_paise'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_inventory_store_id').on(table.storeId),
    index('idx_inventory_sku').on(table.sku),
  ]
);

// 8b. Store Admins Table (Junction)
export const storeAdmins = pgTable(
  'store_admins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: text('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_store_admins_store_id').on(table.storeId),
    index('idx_store_admins_user_id').on(table.userId),
  ]
);

// 9. Drizzle ORM Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  savedAddresses: many(savedAddresses),
  bookings: many(bookings, { relationName: 'customerBookings' }),
  assignedJobs: many(bookings, { relationName: 'employeeBookings' }),
  technicianJobs: many(bookings, { relationName: 'technicianBookings' }),
  bookingTrails: many(bookingTrail),
  storeAdmins: many(storeAdmins),
  homeStore: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  admin: one(users, {
    fields: [stores.adminId],
    references: [users.id],
  }),
  bookings: many(bookings),
  inventoryItems: many(inventoryItems),
  storeAdmins: many(storeAdmins),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(users, {
    fields: [bookings.userId],
    references: [users.id],
    relationName: 'customerBookings',
  }),
  store: one(stores, {
    fields: [bookings.storeId],
    references: [stores.id],
  }),
  assignedEmployee: one(users, {
    fields: [bookings.assignedEmployeeId],
    references: [users.id],
    relationName: 'employeeBookings',
  }),
  technician: one(users, {
    fields: [bookings.technicianId],
    references: [users.id],
    relationName: 'technicianBookings',
  }),
  trail: many(bookingTrail),
  otpCodes: many(otpCodes),
}));

export const bookingTrailRelations = relations(bookingTrail, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingTrail.bookingId],
    references: [bookings.id],
  }),
  triggeredByUser: one(users, {
    fields: [bookingTrail.triggeredByUserId],
    references: [users.id],
  }),
}));

export const savedAddressesRelations = relations(savedAddresses, ({ one }) => ({
  user: one(users, {
    fields: [savedAddresses.userId],
    references: [users.id],
  }),
}));

export const otpCodesRelations = relations(otpCodes, ({ one }) => ({
  user: one(users, {
    fields: [otpCodes.userId],
    references: [users.id],
  }),
  booking: one(bookings, {
    fields: [otpCodes.bookingId],
    references: [bookings.id],
  }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  store: one(stores, {
    fields: [inventoryItems.storeId],
    references: [stores.id],
  }),
}));

export const storeAdminsRelations = relations(storeAdmins, ({ one }) => ({
  store: one(stores, {
    fields: [storeAdmins.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [storeAdmins.userId],
    references: [users.id],
  }),
}));

