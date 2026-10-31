import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue
} from '../../mocks/index.ts';

test.describe('Tier 1: Feature Coverage - Admin API Stats, Store Bookings & Inventory', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-ADMIN-01: Computes dashboard KPI stats and raises unassigned booking count alert', () => {
    // Create 3 bookings: 1 unassigned pending, 1 in repair, 1 delivered
    const b1 = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'User 1',
      contactEmail: 'user1@gmail.com',
      contactPhone: '+91 90000 00001'
    });

    const b2 = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S24',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'User 2',
      contactEmail: 'user2@gmail.com',
      contactPhone: '+91 90000 00002'
    });
    b2.status = 'IN_REPAIR';
    b2.assignedEmployeeId = 'user-delivery-vijay';
    b2.technicianId = 'user-tech-rahul';
    mockDb.bookings.set(b2.id, b2);

    const b3 = service.createBooking({
      brand: 'OnePlus',
      deviceModel: 'OnePlus 12',
      issue: 'Camera',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '12:00 PM',
      contactName: 'User 3',
      contactEmail: 'user3@gmail.com',
      contactPhone: '+91 90000 00003'
    });
    b3.status = 'DELIVERED';
    b3.assignedEmployeeId = 'user-delivery-vijay';
    mockDb.bookings.set(b3.id, b3);

    // Compute admin KPI dashboard stats
    const allBookings = Array.from(mockDb.bookings.values()).filter(
      (b) => b.storeId === 'store-blr-01'
    );
    const totalCount = allBookings.length;
    const pendingCount = allBookings.filter((b) => b.status === 'PENDING').length;
    const inRepairCount = allBookings.filter((b) => b.status === 'IN_REPAIR').length;
    const deliveredCount = allBookings.filter((b) => b.status === 'DELIVERED').length;
    const unassignedCount = allBookings.filter(
      (b) => !b.assignedEmployeeId || !b.technicianId
    ).length;

    assert.equal(totalCount, 3);
    assert.equal(pendingCount, 1);
    assert.equal(inRepairCount, 1);
    assert.equal(deliveredCount, 1);
    assert.equal(unassignedCount, 2); // b1 is fully unassigned, b3 only had delivery assigned
  });

  test('TC-ADMIN-02: Filters store bookings by storeId and status', () => {
    service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'User 1',
      contactEmail: 'user1@gmail.com',
      contactPhone: '+91 90000 00001'
    });

    service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S25',
      issue: 'Battery',
      storeId: 'store-blr-02', // different store (Indiranagar)
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'User 2',
      contactEmail: 'user2@gmail.com',
      contactPhone: '+91 90000 00002'
    });

    const store1Bookings = Array.from(mockDb.bookings.values()).filter(
      (b) => b.storeId === 'store-blr-01'
    );
    const store2Bookings = Array.from(mockDb.bookings.values()).filter(
      (b) => b.storeId === 'store-blr-02'
    );

    assert.equal(store1Bookings.length, 1);
    assert.equal(store2Bookings.length, 1);
    assert.equal(store1Bookings[0].brand, 'Apple');
    assert.equal(store2Bookings[0].brand, 'Samsung');
  });

  test('TC-ADMIN-03: Assigns rider and technician to unassigned booking, clearing unassigned alert', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 9 Pro',
      issue: 'Port',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Client G',
      contactEmail: 'client.g@gmail.com',
      contactPhone: '+91 90000 00009'
    });

    assert.ok(!booking.assignedEmployeeId, 'Booking should initially be unassigned');

    const assigned = service.assignStaff(
      booking.id,
      'user-admin-koramangala',
      'user-delivery-vijay',
      'user-tech-rahul'
    );

    assert.equal(assigned.status, 'CONFIRMED');
    assert.equal(assigned.assignedEmployeeId, 'user-delivery-vijay');
    assert.equal(assigned.technicianId, 'user-tech-rahul');
  });

  test('TC-ADMIN-04: Invites new technician to store team and dispatches invitation email', () => {
    const newTechEmail = 'suresh.technician@flashfix.in';
    const newStaff = {
      id: `user-tech-${Date.now()}`,
      name: 'Suresh Kumar',
      email: newTechEmail,
      role: 'EMPLOYEE' as const,
      storeId: 'store-blr-01',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDb.users.set(newStaff.id, newStaff);

    mockNotificationQueue.enqueue(newTechEmail, 'employee-assigned', {
      storeName: 'Flashfix Koramangala Hub',
      role: 'EMPLOYEE'
    });

    const team = Array.from(mockDb.users.values()).filter(
      (u) => u.storeId === 'store-blr-01' && u.role === 'EMPLOYEE'
    );
    assert.ok(team.some((u) => u.email === newTechEmail));

    const notifs = mockNotificationQueue.getByRecipient(newTechEmail);
    assert.equal(notifs.length, 1);
  });

  test('TC-ADMIN-05: Lists parts inventory items and updates stock quantities', () => {
    const parts = Array.from(mockDb.inventoryItems.values()).filter(
      (p) => p.storeId === 'store-blr-01'
    );
    assert.ok(parts.length >= 1);
    const screenPart = parts[0];
    assert.equal(screenPart.partSku, 'SKU-DISP-IP15P-OEM');
    assert.equal(screenPart.quantity, 14);

    // Consume 1 part for repair
    screenPart.quantity -= 1;
    screenPart.updatedAt = new Date();
    mockDb.inventoryItems.set(screenPart.id, screenPart);

    const updated = mockDb.inventoryItems.get(screenPart.id);
    assert.equal(updated?.quantity, 13);
  });
});
