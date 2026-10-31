import { z } from 'zod';
import {
  UserSchema,
  BookingSchema,
  BookingTrailSchema,
  NearbyStoreSchema,
  StoreSchema,
  InventoryItemSchema,
  SavedAddressSchema,
} from './entities.js';
import { USER_ROLES, BOOKING_STATUSES } from '../constants/index.js';

// Base API Error Schema
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// Base API Envelope
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
  });

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: ApiError;
};

// 1. Auth Service Schemas
export const SendOtpRequestSchema = z.object({
  email: z.string().email(),
});
export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;

export const VerifyOtpRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const AuthTokensResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
});
export type AuthTokensResponse = z.infer<typeof AuthTokensResponseSchema>;

export const UpdateProfileRequestSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const CreateSavedAddressRequestSchema = z.object({
  label: z.string().optional(),
  address: z.string().min(5),
  landmark: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isDefault: z.boolean().optional().default(false),
});
export type CreateSavedAddressRequest = z.infer<typeof CreateSavedAddressRequestSchema>;

export const AdminAssignRoleRequestSchema = z.object({
  role: z.enum(USER_ROLES),
});
export type AdminAssignRoleRequest = z.infer<typeof AdminAssignRoleRequestSchema>;

export const AdminAssignStoreRequestSchema = z.object({
  storeId: z.string(),
});
export type AdminAssignStoreRequest = z.infer<typeof AdminAssignStoreRequestSchema>;

export const AdminInviteEmployeeRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['EMPLOYEE', 'ADMIN']),
  storeId: z.string(),
});
export type AdminInviteEmployeeRequest = z.infer<typeof AdminInviteEmployeeRequestSchema>;

// 2. Booking Service Schemas
export const CreateBookingRequestSchema = z.object({
  brand: z.string().min(1),
  deviceModel: z.string().min(1),
  issueType: z.string().min(1),
  issueDescription: z.string().optional(),
  storeId: z.string(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  pickupAddress: z.string().min(5),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(10),
  saveAddress: z.boolean().optional(),
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const AdminAssignBookingRequestSchema = z.object({
  employeeId: z.string().uuid(),
  technicianId: z.string().uuid().optional(),
});
export type AdminAssignBookingRequest = z.infer<typeof AdminAssignBookingRequestSchema>;

export const VerifyPickupOtpRequestSchema = z.object({
  otp: z.string().length(6),
});
export type VerifyPickupOtpRequest = z.infer<typeof VerifyPickupOtpRequestSchema>;

export const VerifyCustodyOtpRequestSchema = z.object({
  otp: z.string().length(6),
});
export type VerifyCustodyOtpRequest = z.infer<typeof VerifyCustodyOtpRequestSchema>;

export const UpdateBookingStatusRequestSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
  note: z.string().optional(),
});
export type UpdateBookingStatusRequest = z.infer<typeof UpdateBookingStatusRequestSchema>;

export const BookingWithTrailSchema = BookingSchema.extend({
  trail: z.array(BookingTrailSchema).optional(),
});
export type BookingWithTrail = z.infer<typeof BookingWithTrailSchema>;

// 3. Store Service Schemas
export const NearbyStoresQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type NearbyStoresQuery = z.infer<typeof NearbyStoresQuerySchema>;

// 4. Notify Service Schemas (Internal)
export const NotifyOtpLoginSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});
export type NotifyOtpLogin = z.infer<typeof NotifyOtpLoginSchema>;

export const NotifyBookingConfirmedSchema = z.object({
  email: z.string().email(),
  bookingId: z.string(),
  customerName: z.string(),
  deviceModel: z.string(),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  storeName: z.string(),
});
export type NotifyBookingConfirmed = z.infer<typeof NotifyBookingConfirmedSchema>;

export const NotifyPickupOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  bookingId: z.string(),
  employeeName: z.string(),
});
export type NotifyPickupOtp = z.infer<typeof NotifyPickupOtpSchema>;

export const NotifyCustodyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  bookingId: z.string(),
  technicianName: z.string(),
});
export type NotifyCustodyOtp = z.infer<typeof NotifyCustodyOtpSchema>;

export const NotifyRepairCompleteSchema = z.object({
  email: z.string().email(),
  bookingId: z.string(),
  customerName: z.string(),
  deviceModel: z.string(),
});
export type NotifyRepairComplete = z.infer<typeof NotifyRepairCompleteSchema>;

export const NotifyEmployeeAssignedSchema = z.object({
  email: z.string().email(),
  bookingId: z.string(),
  customerName: z.string(),
  pickupAddress: z.string(),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
});
export type NotifyEmployeeAssigned = z.infer<typeof NotifyEmployeeAssignedSchema>;

// 5. Admin API Schemas
export const AdminDashboardStatsSchema = z.object({
  todayTotal: z.number().int(),
  pending: z.number().int(),
  inRepair: z.number().int(),
  delivered: z.number().int(),
  unassignedCount: z.number().int(),
});
export type AdminDashboardStats = z.infer<typeof AdminDashboardStatsSchema>;

export const AdminBookingsQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  storeId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminBookingsQuery = z.infer<typeof AdminBookingsQuerySchema>;

// 6. Inventory Service Schemas
export const CreateInventoryItemRequestSchema = z.object({
  storeId: z.string(),
  partName: z.string().min(2),
  sku: z.string().optional(),
  compatibleWith: z.array(z.string()).default([]),
  quantity: z.number().int().min(0).default(0),
  minThreshold: z.number().int().min(0).default(5),
  unitCostPaise: z.number().int().min(0).optional(),
});
export type CreateInventoryItemRequest = z.infer<typeof CreateInventoryItemRequestSchema>;

export const UpdateInventoryItemRequestSchema = z.object({
  partName: z.string().min(2).optional(),
  quantity: z.number().int().min(0).optional(),
  minThreshold: z.number().int().min(0).optional(),
  unitCostPaise: z.number().int().min(0).optional(),
  compatibleWith: z.array(z.string()).optional(),
});
export type UpdateInventoryItemRequest = z.infer<typeof UpdateInventoryItemRequestSchema>;
