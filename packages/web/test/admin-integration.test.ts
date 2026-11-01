import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  STORES,
  getDashboardStats,
  getBookingsList,
  assignStaffToBooking,
  updateBookingStatus,
  getBookingTrail,
  getTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  getInventory,
  updateInventoryStock,
  startPickupRoute,
  sendPickupOtp,
  verifyPickupOtp,
  sendCustodyOtp,
  verifyCustodyOtp,
  markRepairComplete,
  startReturnDelivery,
  completeDelivery,
} from "../src/components/admin/api.ts";
import { mapStatusToStep } from "../src/components/admin/BookingDetailModal.tsx";

test("Admin & Staff Panel Integration Suite (Milestone 2 / R2)", async (t) => {
  await t.test("Section 1: Store Hubs & Core API Constants", () => {
    assert.equal(STORES.length, 4, "Must define 4 designated Hyderabad hubs");
    const storeIds = STORES.map((s) => s.id);
    assert.ok(storeIds.includes("store-001"), "Must include store-001");
    assert.ok(storeIds.includes("store-002"), "Must include store-002");
    assert.ok(storeIds.includes("store-003"), "Must include store-003");
    assert.ok(storeIds.includes("store-004"), "Must include store-004");
  });

  await t.test("Section 2: Dashboard KPIs & Unassigned Order Telemetry", async () => {
    const stats = await getDashboardStats();
    assert.ok(stats.todayTotal > 0, "todayTotal must be positive");
    assert.ok(stats.pending >= 0, "pending must be non-negative");
    assert.ok(stats.inRepair >= 0, "inRepair must be non-negative");
    assert.ok(stats.delivered >= 0, "delivered must be non-negative");
    assert.ok(stats.unassignedCount >= 0, "unassignedCount must be non-negative");

    // Store specific filtering
    const store1Stats = await getDashboardStats("store-001");
    assert.ok(store1Stats.todayTotal <= stats.todayTotal, "Store total should be <= overall total");
  });

  await t.test("Section 3: Bookings Query, Multi-Field Search & Filter", async () => {
    const allBookings = await getBookingsList();
    assert.ok(allBookings.length >= 5, "Must have initial seed bookings");

    // Filter by store
    const store1Bookings = await getBookingsList({ storeId: "store-001" });
    assert.ok(store1Bookings.every((b) => b.storeId === "store-001"), "All bookings belong to store-001");

    // Filter by status
    const pendingBookings = await getBookingsList({ status: "PENDING" });
    assert.ok(pendingBookings.every((b) => b.status === "PENDING"), "All bookings have status PENDING");

    // Search by device brand / model
    const appleBookings = await getBookingsList({ search: "Apple" });
    assert.ok(appleBookings.length > 0, "Search by brand Apple returns results");
    assert.ok(appleBookings.every((b) => b.brand.toLowerCase().includes("apple") || b.deviceModel.toLowerCase().includes("apple")));

    // Search by ID
    const singleBooking = allBookings[0];
    const searchById = await getBookingsList({ search: singleBooking.id });
    assert.ok(searchById.some((b) => b.id === singleBooking.id), "Found booking by ID");
  });

  await t.test("Section 4: Staff Allocation Workflow", async () => {
    const all = await getBookingsList();
    const target = all.find((b) => b.status === "PENDING") || all[0];

    const success = await assignStaffToBooking(target.id, "emp-001", "emp-002");
    assert.equal(success, true, "assignStaffToBooking must return true");

    const updatedList = await getBookingsList();
    const updated = updatedList.find((b) => b.id === target.id);
    assert.equal(updated?.status, "CONFIRMED", "Status transitioned to CONFIRMED");
    assert.equal(updated?.assignedEmployeeId, "emp-001", "Assigned employee ID recorded");
    assert.equal(updated?.technicianId, "emp-002", "Assigned technician ID recorded");
  });

  await t.test("Section 5: 9-Step Repair Lifecycle Mapping & Status Override", async () => {
    assert.equal(mapStatusToStep("PENDING"), 1);
    assert.equal(mapStatusToStep("CONFIRMED"), 2);
    assert.equal(mapStatusToStep("PICKUP_EN_ROUTE"), 3);
    assert.equal(mapStatusToStep("PICKUP_OTP_SENT"), 3);
    assert.equal(mapStatusToStep("IN_TRANSIT"), 4);
    assert.equal(mapStatusToStep("CUSTODY_OTP_SENT"), 5);
    assert.equal(mapStatusToStep("IN_REPAIR"), 6);
    assert.equal(mapStatusToStep("REPAIR_COMPLETE"), 7);
    assert.equal(mapStatusToStep("RETURN_EN_ROUTE"), 8);
    assert.equal(mapStatusToStep("DELIVERED"), 9);

    const all = await getBookingsList();
    const target = all[0];
    await updateBookingStatus(target.id, "IN_REPAIR", "Admin diagnostic status override");
    const updatedList = await getBookingsList();
    const updated = updatedList.find((b) => b.id === target.id);
    assert.equal(updated?.status, "IN_REPAIR");

    const trail = await getBookingTrail(target.id);
    assert.ok(trail.length > 0, "Trail items must exist");
  });

  await t.test("Section 6: Two-Factor Handover Operations (Doorstep & Lab Custody)", async () => {
    const all = await getBookingsList();
    const testBooking = all[0];

    // 1. Start Pickup Route
    await startPickupRoute(testBooking.id);
    let current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "PICKUP_EN_ROUTE");

    // 2. Send Doorstep Pickup OTP
    const pickupOtpResult = await sendPickupOtp(testBooking.id);
    assert.equal(pickupOtpResult.success, true);
    assert.ok(pickupOtpResult.otp, "OTP was generated");
    current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "PICKUP_OTP_SENT");

    // 3. Verify Doorstep Pickup OTP
    const verifyPickupResult = await verifyPickupOtp(testBooking.id, pickupOtpResult.otp!);
    assert.equal(verifyPickupResult.success, true);
    current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "IN_TRANSIT");

    // 4. Send Lab Custody OTP upon arrival at service hub
    const custodyOtpResult = await sendCustodyOtp(testBooking.id);
    assert.equal(custodyOtpResult.success, true);
    assert.ok(custodyOtpResult.otp, "Custody OTP was generated");
    current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "CUSTODY_OTP_SENT");

    // 5. Verify Custody OTP by Lab Technician
    const verifyCustodyResult = await verifyCustodyOtp(testBooking.id, custodyOtpResult.otp!);
    assert.equal(verifyCustodyResult.success, true);
    current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "IN_REPAIR");

    // 6. Complete Repair
    await markRepairComplete(testBooking.id, 499900, "Display calibrated and QA approved");
    current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "REPAIR_COMPLETE");

    // 7. Start Return Delivery
    await startReturnDelivery(testBooking.id);
    current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "RETURN_EN_ROUTE");

    // 8. Complete Final Delivery
    await completeDelivery(testBooking.id);
    current = (await getBookingsList()).find((b) => b.id === testBooking.id);
    assert.equal(current?.status, "DELIVERED");
  });

  await t.test("Section 7: Team Directory & Role Management", async () => {
    const staff = await getTeamMembers();
    assert.ok(staff.length >= 4, "Must list all initial staff");

    const newStaff = await inviteTeamMember({
      name: "Deepika Rao",
      email: "deepika.rao@flashfix.in",
      role: "EMPLOYEE",
      storeId: "store-001",
    });
    assert.equal(newStaff.status, "INVITED");
    assert.equal(newStaff.name, "Deepika Rao");

    const updatedRole = await updateTeamMemberRole(newStaff.id, "ADMIN");
    assert.equal(updatedRole, true);
  });

  await t.test("Section 8: Parts Inventory & Reorder Thresholds", async () => {
    const items = await getInventory();
    assert.ok(items.length >= 4, "Must list inventory items");

    const targetItem = items[0];
    const updated = await updateInventoryStock(targetItem.id, 15);
    assert.equal(updated, true);

    const reloaded = (await getInventory()).find((i) => i.id === targetItem.id);
    assert.equal(reloaded?.quantity, 15);
  });

  await t.test("Section 9: Architecture & Layout Isolation Static Verification", () => {
    const appTsx = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");

    // Verify /admin route is mounted outside RootLayout
    assert.ok(appTsx.includes('path: "/admin"'), "App.tsx must define /admin route");
    assert.ok(appTsx.includes('path: "/flashfix/admin"'), "App.tsx must define /flashfix/admin redirect");
    assert.ok(appTsx.includes("AdminLayout"), "App.tsx must use AdminLayout");
    assert.ok(appTsx.includes("AdminPage"), "App.tsx must route to AdminPage");

    // Verify AdminLayout does NOT import or render consumer Navbar or SmoothScroll
    const adminLayoutTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/AdminLayout.tsx"),
      "utf8"
    );
    assert.ok(!adminLayoutTsx.includes("Navbar"), "AdminLayout must NOT import consumer Navbar");
    assert.ok(!adminLayoutTsx.includes("SmoothScroll"), "AdminLayout must NOT import SmoothScroll");
    assert.ok(adminLayoutTsx.includes("Outlet"), "AdminLayout must render Outlet");
  });

  await t.test("Section 10: Responsiveness & Touch Target Compliance (<= 480px)", () => {
    const deliveryTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/DeliveryPersonView.tsx"),
      "utf8"
    );
    assert.ok(deliveryTsx.includes("min-h-[44px]"), "Delivery view must enforce >= 44px touch targets");
    assert.ok(deliveryTsx.includes("tel:"), "Delivery view must provide 1-tap phone call link");
    assert.ok(deliveryTsx.includes("maps.google.com"), "Delivery view must provide 1-tap Google Maps navigation");

    const techTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/TechnicianView.tsx"),
      "utf8"
    );
    assert.ok(techTsx.includes("min-h-[44px]"), "Technician view must enforce >= 44px touch targets");

    const bookingsTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/BookingsView.tsx"),
      "utf8"
    );
    assert.ok(bookingsTsx.includes("hidden md:block"), "Bookings view must render high-density table on desktop");
    assert.ok(bookingsTsx.includes("md:hidden"), "Bookings view must render stacked cards on mobile");

    const navbarTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/AdminNavbar.tsx"),
      "utf8"
    );
    assert.ok(navbarTsx.includes("fixed bottom-0"), "AdminNavbar must include mobile sticky bottom navigation");
    assert.ok(navbarTsx.includes("min-h-[48px]"), "Mobile bottom navigation must have touch-friendly height");
  });
});
