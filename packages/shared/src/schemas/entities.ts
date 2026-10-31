import { z } from 'zod';
import { USER_ROLES, BOOKING_STATUSES, OTP_PURPOSES } from '../constants/index.js';

// User Schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.enum(USER_ROLES),
  emailVerified: z.boolean().default(false),
  googleId: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  storeId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;

// Saved Address Schema
export const SavedAddressSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  label: z.string().nullable().optional(), // 'Home', 'Office', 'Other'
  address: z.string().min(5),
  landmark: z.string().nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isDefault: z.boolean().default(false),
  createdAt: z.coerce.date(),
});
export type SavedAddress = z.infer<typeof SavedAddressSchema>;

// OTP Code Record Schema
export const OtpCodeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  codeHash: z.string(),
  purpose: z.enum(OTP_PURPOSES),
  bookingId: z.string().nullable().optional(),
  expiresAt: z.coerce.date(),
  attempts: z.number().int().default(0),
  verified: z.boolean().default(false),
  createdAt: z.coerce.date(),
});
export type OtpCode = z.infer<typeof OtpCodeSchema>;

// Store Schema
export const StoreSchema = z.object({
  id: z.string(), // e.g. 'store-001'
  slug: z.string().optional(),
  name: z.string().min(2),
  address: z.string().min(5),
  city: z.string().min(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().nullable().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  hours: z.string().optional(), // '9 AM – 9 PM'
  services: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).default(4.8),
  reviewCount: z.number().int().default(0),
  isActive: z.boolean().default(true),
  adminId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
});
export type Store = z.infer<typeof StoreSchema>;

// Enriched Store with Geo Context Schema
export const NearbyStoreSchema = StoreSchema.extend({
  distanceKm: z.number(),
  tier: z.enum(['flash', 'next-day', 'out-of-range']),
  estimatedPickupMinutes: z.number().nullable().optional(),
  isFlashHero: z.boolean(),
});
export type NearbyStore = z.infer<typeof NearbyStoreSchema>;

// Booking Schema
export const BookingSchema = z.object({
  id: z.string(), // 'FF-XXXXXX'
  trackingCode: z.string(),
  userId: z.string().uuid().nullable().optional(),
  storeId: z.string(),
  assignedEmployeeId: z.string().uuid().nullable().optional(),
  technicianId: z.string().uuid().nullable().optional(),
  brand: z.string().min(1),
  deviceModel: z.string().min(1),
  issueType: z.string().min(1),
  issueDescription: z.string().nullable().optional(),
  scheduledDate: z.string(), // 'YYYY-MM-DD'
  scheduledTime: z.string(), // '10:00 AM'
  pickupLat: z.number().nullable().optional(),
  pickupLng: z.number().nullable().optional(),
  pickupAddress: z.string().min(5),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(10),
  status: z.enum(BOOKING_STATUSES),
  estimatedCostPaise: z.number().int().nullable().optional(),
  finalCostPaise: z.number().int().nullable().optional(),
  paymentMethod: z.enum(['QR', 'ONLINE', 'CASH']).default('QR'),
  paymentStatus: z.enum(['UNPAID', 'PAID', 'REFUNDED']).default('UNPAID'),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Booking = z.infer<typeof BookingSchema>;

// Booking Status Trail Schema (Audit log)
export const BookingTrailSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string(),
  fromStatus: z.enum(BOOKING_STATUSES).nullable().optional(),
  toStatus: z.enum(BOOKING_STATUSES),
  triggeredByUserId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type BookingTrail = z.infer<typeof BookingTrailSchema>;

// Inventory Item Schema
export const InventoryItemSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string(),
  partName: z.string().min(2),
  sku: z.string().nullable().optional(),
  compatibleWith: z.array(z.string()).default([]),
  quantity: z.number().int().min(0).default(0),
  minThreshold: z.number().int().min(0).default(5),
  unitCostPaise: z.number().int().min(0).nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
