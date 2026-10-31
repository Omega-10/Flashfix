import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { createDb } from './index.js';
import {
  users,
  stores,
  savedAddresses,
  bookings,
  bookingTrail,
  otpCodes,
  inventoryItems,
} from './schema.js';

dotenv.config();

export const SEED_DATA = {
  users: [
    {
      id: '00000000-0000-4000-a000-000000000001',
      name: 'Flashfix Platform Admin',
      email: 'superadmin@flashfix.in',
      phone: '+919999900001',
      role: 'SUPER_ADMIN' as const,
      emailVerified: true,
      storeId: null,
    },
    {
      id: '00000000-0000-4000-a000-000000000002',
      name: 'Koramangala Store Manager',
      email: 'admin.koramangala@flashfix.in',
      phone: '+919999900002',
      role: 'ADMIN' as const,
      emailVerified: true,
      storeId: 'store-001',
    },
    {
      id: '00000000-0000-4000-a000-000000000003',
      name: 'Indiranagar Store Manager',
      email: 'admin.indiranagar@flashfix.in',
      phone: '+919999900003',
      role: 'ADMIN' as const,
      emailVerified: true,
      storeId: 'store-002',
    },
    {
      id: '00000000-0000-4000-a000-000000000004',
      name: 'Rajesh Kumar',
      email: 'delivery.rajesh@flashfix.in',
      phone: '+919876500004',
      role: 'EMPLOYEE' as const,
      emailVerified: true,
      storeId: 'store-001',
    },
    {
      id: '00000000-0000-4000-a000-000000000005',
      name: 'Vikram Singh',
      email: 'tech.vikram@flashfix.in',
      phone: '+919876500005',
      role: 'EMPLOYEE' as const,
      emailVerified: true,
      storeId: 'store-001',
    },
    {
      id: '00000000-0000-4000-a000-000000000006',
      name: 'Rahul Sharma',
      email: 'rahul.sharma@example.com',
      phone: '+919876543210',
      role: 'CONSUMER' as const,
      emailVerified: true,
      storeId: null,
    },
  ],

  stores: [
    {
      id: 'store-001',
      slug: 'flashfix-koramangala',
      name: 'Flashfix — Koramangala',
      address: '12th Main, 4th Block, Koramangala',
      city: 'Bengaluru',
      lat: '12.935200',
      lng: '77.624500',
      phone: '+91 98765 43210',
      openTime: '09:00',
      closeTime: '21:00',
      hours: '9 AM – 9 PM',
      services: [
        'Screen Replacement',
        'Battery Replacement',
        'Water Damage',
        'Charging Port',
        'Camera Fix',
        'Back Glass',
      ],
      rating: '4.80',
      reviewCount: 342,
      isActive: true,
      adminId: '00000000-0000-4000-a000-000000000002',
    },
    {
      id: 'store-002',
      slug: 'flashfix-indiranagar',
      name: 'Flashfix — Indiranagar',
      address: '100 Feet Road, CMH Road, Indiranagar',
      city: 'Bengaluru',
      lat: '12.978400',
      lng: '77.640800',
      phone: '+91 98765 43211',
      openTime: '10:00',
      closeTime: '20:00',
      hours: '10 AM – 8 PM',
      services: [
        'Screen Replacement',
        'Battery Replacement',
        'Charging Port',
        'Software Fix',
      ],
      rating: '4.70',
      reviewCount: 218,
      isActive: true,
      adminId: '00000000-0000-4000-a000-000000000003',
    },
    {
      id: 'store-003',
      slug: 'flashfix-hsr-layout',
      name: 'Flashfix — HSR Layout',
      address: 'Sector 2, HSR Layout',
      city: 'Bengaluru',
      lat: '12.911600',
      lng: '77.638900',
      phone: '+91 98765 43212',
      openTime: '09:00',
      closeTime: '21:00',
      hours: '9 AM – 9 PM',
      services: [
        'Screen Replacement',
        'Battery Replacement',
        'Water Damage',
        'Back Glass',
        'Speaker Fix',
      ],
      rating: '4.90',
      reviewCount: 504,
      isActive: true,
      adminId: null,
    },
    {
      id: 'store-004',
      slug: 'flashfix-whitefield',
      name: 'Flashfix — Whitefield',
      address: 'EPIP Zone, Whitefield',
      city: 'Bengaluru',
      lat: '12.969800',
      lng: '77.749900',
      phone: '+91 98765 43213',
      openTime: '10:00',
      closeTime: '20:00',
      hours: '10 AM – 8 PM',
      services: [
        'Screen Replacement',
        'Battery Replacement',
        'Charging Port',
      ],
      rating: '4.60',
      reviewCount: 167,
      isActive: true,
      adminId: null,
    },
    {
      id: 'store-005',
      slug: 'flashfix-jayanagar',
      name: 'Flashfix — Jayanagar',
      address: '4th Block, Jayanagar',
      city: 'Bengaluru',
      lat: '12.925400',
      lng: '77.582200',
      phone: '+91 98765 43214',
      openTime: '09:00',
      closeTime: '20:00',
      hours: '9 AM – 8 PM',
      services: [
        'Screen Replacement',
        'Battery Replacement',
        'Water Damage',
        'Camera Fix',
      ],
      rating: '4.70',
      reviewCount: 289,
      isActive: true,
      adminId: null,
    },
  ],

  savedAddresses: [
    {
      id: '10000000-0000-4000-a000-000000000001',
      userId: '00000000-0000-4000-a000-000000000006',
      label: 'Home',
      address: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
      landmark: 'Near Central Mall',
      lat: '12.926000',
      lng: '77.676200',
      isDefault: true,
    },
    {
      id: '10000000-0000-4000-a000-000000000002',
      userId: '00000000-0000-4000-a000-000000000006',
      label: 'Office',
      address: 'Prestige Tech Park, Marathahalli, Bengaluru',
      landmark: 'Building Jupiter',
      lat: '12.937200',
      lng: '77.693400',
      isDefault: false,
    },
  ],

  bookings: [
    {
      id: 'FF-001001',
      trackingCode: 'TRK-001001-A1',
      userId: '00000000-0000-4000-a000-000000000006',
      storeId: 'store-001',
      assignedEmployeeId: null,
      technicianId: null,
      brand: 'Apple',
      deviceModel: 'iPhone 16 Pro Max',
      issueType: 'Screen Replacement',
      issueDescription: 'Cracked front glass after drop, touch working intermittently',
      scheduledDate: '2026-11-01',
      scheduledTime: '10:00 AM',
      pickupLat: '12.926000',
      pickupLng: '77.676200',
      pickupAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul.sharma@example.com',
      contactPhone: '+919876543210',
      status: 'PENDING' as const,
      estimatedCostPaise: 1899900, // Rs 18,999.00
      finalCostPaise: null,
      paymentMethod: 'QR',
      paymentStatus: 'UNPAID',
      notes: 'Customer requested genuine OLED panel',
    },
    {
      id: 'FF-001002',
      trackingCode: 'TRK-001002-B2',
      userId: '00000000-0000-4000-a000-000000000006',
      storeId: 'store-001',
      assignedEmployeeId: '00000000-0000-4000-a000-000000000004',
      technicianId: '00000000-0000-4000-a000-000000000005',
      brand: 'Samsung',
      deviceModel: 'Galaxy S25 Ultra',
      issueType: 'Battery Replacement',
      issueDescription: 'Battery drains in 3 hours',
      scheduledDate: '2026-11-01',
      scheduledTime: '11:30 AM',
      pickupLat: '12.926000',
      pickupLng: '77.676200',
      pickupAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul.sharma@example.com',
      contactPhone: '+919876543210',
      status: 'CONFIRMED' as const,
      estimatedCostPaise: 449900, // Rs 4,499.00
      finalCostPaise: null,
      paymentMethod: 'QR',
      paymentStatus: 'UNPAID',
      notes: 'Assigned to Rajesh for pickup',
    },
    {
      id: 'FF-001003',
      trackingCode: 'TRK-001003-C3',
      userId: '00000000-0000-4000-a000-000000000006',
      storeId: 'store-001',
      assignedEmployeeId: '00000000-0000-4000-a000-000000000004',
      technicianId: '00000000-0000-4000-a000-000000000005',
      brand: 'Google',
      deviceModel: 'Pixel 9 Pro XL',
      issueType: 'Camera Fix',
      issueDescription: 'Main sensor blurry and shaking',
      scheduledDate: '2026-10-31',
      scheduledTime: '02:00 PM',
      pickupLat: '12.937200',
      pickupLng: '77.693400',
      pickupAddress: 'Prestige Tech Park, Marathahalli, Bengaluru',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul.sharma@example.com',
      contactPhone: '+919876543210',
      status: 'IN_TRANSIT' as const,
      estimatedCostPaise: 799900,
      finalCostPaise: null,
      paymentMethod: 'QR',
      paymentStatus: 'UNPAID',
      notes: 'Pickup OTP verified by Rajesh Kumar',
    },
    {
      id: 'FF-001004',
      trackingCode: 'TRK-001004-D4',
      userId: '00000000-0000-4000-a000-000000000006',
      storeId: 'store-001',
      assignedEmployeeId: '00000000-0000-4000-a000-000000000004',
      technicianId: '00000000-0000-4000-a000-000000000005',
      brand: 'OnePlus',
      deviceModel: 'OnePlus 13',
      issueType: 'Charging Port',
      issueDescription: 'Warp charge not engaging, loose cable fit',
      scheduledDate: '2026-10-31',
      scheduledTime: '09:00 AM',
      pickupLat: '12.926000',
      pickupLng: '77.676200',
      pickupAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul.sharma@example.com',
      contactPhone: '+919876543210',
      status: 'IN_REPAIR' as const,
      estimatedCostPaise: 299900,
      finalCostPaise: null,
      paymentMethod: 'ONLINE',
      paymentStatus: 'UNPAID',
      notes: 'Vikram Singh actively repairing sub-board',
    },
    {
      id: 'FF-001005',
      trackingCode: 'TRK-001005-E5',
      userId: '00000000-0000-4000-a000-000000000006',
      storeId: 'store-001',
      assignedEmployeeId: '00000000-0000-4000-a000-000000000004',
      technicianId: '00000000-0000-4000-a000-000000000005',
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issueType: 'Back Glass',
      issueDescription: 'Shattered rear glass panel',
      scheduledDate: '2026-10-30',
      scheduledTime: '04:00 PM',
      pickupLat: '12.926000',
      pickupLng: '77.676200',
      pickupAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul.sharma@example.com',
      contactPhone: '+919876543210',
      status: 'REPAIR_COMPLETE' as const,
      estimatedCostPaise: 899900,
      finalCostPaise: 899900,
      paymentMethod: 'QR',
      paymentStatus: 'UNPAID',
      notes: 'QC passed, laser back glass replacement complete',
    },
    {
      id: 'FF-001006',
      trackingCode: 'TRK-001006-F6',
      userId: '00000000-0000-4000-a000-000000000006',
      storeId: 'store-001',
      assignedEmployeeId: '00000000-0000-4000-a000-000000000004',
      technicianId: '00000000-0000-4000-a000-000000000005',
      brand: 'Samsung',
      deviceModel: 'Galaxy S24 Ultra',
      issueType: 'Screen Replacement',
      issueDescription: 'Green vertical line on display',
      scheduledDate: '2026-10-29',
      scheduledTime: '11:00 AM',
      pickupLat: '12.926000',
      pickupLng: '77.676200',
      pickupAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul.sharma@example.com',
      contactPhone: '+919876543210',
      status: 'DELIVERED' as const,
      estimatedCostPaise: 1649900,
      finalCostPaise: 1649900,
      paymentMethod: 'QR',
      paymentStatus: 'PAID',
      notes: 'Delivered and payment collected via QR code',
    },
  ],

  bookingTrails: [
    {
      id: '20000000-0000-4000-a000-000000000001',
      bookingId: 'FF-001001',
      fromStatus: null,
      toStatus: 'PENDING' as const,
      triggeredByUserId: '00000000-0000-4000-a000-000000000006',
      notes: 'Booking created by consumer',
    },
    {
      id: '20000000-0000-4000-a000-000000000002',
      bookingId: 'FF-001002',
      fromStatus: 'PENDING' as const,
      toStatus: 'CONFIRMED' as const,
      triggeredByUserId: '00000000-0000-4000-a000-000000000002',
      notes: 'Admin assigned Rajesh Kumar and Vikram Singh',
    },
    {
      id: '20000000-0000-4000-a000-000000000003',
      bookingId: 'FF-001003',
      fromStatus: 'CONFIRMED' as const,
      toStatus: 'PICKUP_EN_ROUTE' as const,
      triggeredByUserId: '00000000-0000-4000-a000-000000000004',
      notes: 'Delivery hero started journey to customer',
    },
    {
      id: '20000000-0000-4000-a000-000000000004',
      bookingId: 'FF-001003',
      fromStatus: 'PICKUP_EN_ROUTE' as const,
      toStatus: 'IN_TRANSIT' as const,
      triggeredByUserId: '00000000-0000-4000-a000-000000000004',
      notes: 'Pickup OTP verified, device securely collected',
    },
    {
      id: '20000000-0000-4000-a000-000000000005',
      bookingId: 'FF-001004',
      fromStatus: 'IN_TRANSIT' as const,
      toStatus: 'IN_REPAIR' as const,
      triggeredByUserId: '00000000-0000-4000-a000-000000000005',
      notes: 'Custody OTP verified, device received by Vikram',
    },
    {
      id: '20000000-0000-4000-a000-000000000006',
      bookingId: 'FF-001005',
      fromStatus: 'IN_REPAIR' as const,
      toStatus: 'REPAIR_COMPLETE' as const,
      triggeredByUserId: '00000000-0000-4000-a000-000000000005',
      notes: 'Repair finished, tested and ready for return',
    },
    {
      id: '20000000-0000-4000-a000-000000000007',
      bookingId: 'FF-001006',
      fromStatus: 'RETURN_EN_ROUTE' as const,
      toStatus: 'DELIVERED' as const,
      triggeredByUserId: '00000000-0000-4000-a000-000000000004',
      notes: 'Device returned to consumer, payment collected',
    },
  ],

  inventoryItems: [
    {
      id: '30000000-0000-4000-a000-000000000001',
      storeId: 'store-001',
      partName: 'iPhone 16 Pro Max OLED Screen Assembly',
      sku: 'SKU-IP16PM-SCR',
      compatibleWith: ['Apple iPhone 16 Pro Max'],
      quantity: 12,
      minThreshold: 5,
      unitCostPaise: 1250000, // Rs 12,500.00
    },
    {
      id: '30000000-0000-4000-a000-000000000002',
      storeId: 'store-001',
      partName: 'Galaxy S25 Ultra 5000mAh Battery',
      sku: 'SKU-S25U-BAT',
      compatibleWith: ['Samsung Galaxy S25 Ultra'],
      quantity: 20,
      minThreshold: 5,
      unitCostPaise: 220000, // Rs 2,200.00
    },
    {
      id: '30000000-0000-4000-a000-000000000003',
      storeId: 'store-001',
      partName: 'Pixel 9 Pro XL Main Camera Module',
      sku: 'SKU-PX9P-CAM',
      compatibleWith: ['Google Pixel 9 Pro XL'],
      quantity: 8,
      minThreshold: 3,
      unitCostPaise: 450000, // Rs 4,500.00
    },
    {
      id: '30000000-0000-4000-a000-000000000004',
      storeId: 'store-001',
      partName: 'OnePlus 13 Sub-Board & Charging Port',
      sku: 'SKU-OP13-CHG',
      compatibleWith: ['OnePlus 13'],
      quantity: 15,
      minThreshold: 5,
      unitCostPaise: 140000, // Rs 1,400.00
    },
    {
      id: '30000000-0000-4000-a000-000000000005',
      storeId: 'store-002',
      partName: 'iPhone 15 Pro Laser Back Glass Panel',
      sku: 'SKU-IP15P-BG',
      compatibleWith: ['Apple iPhone 15 Pro'],
      quantity: 10,
      minThreshold: 4,
      unitCostPaise: 380000, // Rs 3,800.00
    },
  ],
};

export async function seed() {
  console.log('Seeding Neon Postgres with Flashfix initial data...');
  const db = createDb();

  // 1. Seed Stores
  console.log(`Inserting ${SEED_DATA.stores.length} stores...`);
  for (const s of SEED_DATA.stores) {
    await db.insert(stores).values(s).onConflictDoNothing();
  }

  // 2. Seed Users
  console.log(`Inserting ${SEED_DATA.users.length} users...`);
  for (const u of SEED_DATA.users) {
    await db.insert(users).values(u).onConflictDoNothing();
  }

  // Update store admin foreign keys now that users exist
  for (const s of SEED_DATA.stores) {
    if (s.adminId) {
      await db.update(stores).set({ adminId: s.adminId }).where(eq(stores.id, s.id));
    }
  }

  // 3. Seed Saved Addresses
  console.log(`Inserting ${SEED_DATA.savedAddresses.length} saved addresses...`);
  for (const a of SEED_DATA.savedAddresses) {
    await db.insert(savedAddresses).values(a).onConflictDoNothing();
  }

  // 4. Seed Bookings
  console.log(`Inserting ${SEED_DATA.bookings.length} bookings...`);
  for (const b of SEED_DATA.bookings) {
    await db.insert(bookings).values(b).onConflictDoNothing();
  }

  // 5. Seed Booking Trails
  console.log(`Inserting ${SEED_DATA.bookingTrails.length} booking trails...`);
  for (const t of SEED_DATA.bookingTrails) {
    await db.insert(bookingTrail).values(t).onConflictDoNothing();
  }

  // 6. Seed Inventory Items
  console.log(`Inserting ${SEED_DATA.inventoryItems.length} inventory items...`);
  for (const item of SEED_DATA.inventoryItems) {
    await db.insert(inventoryItems).values(item).onConflictDoNothing();
  }

  console.log('Seed completed successfully.');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
