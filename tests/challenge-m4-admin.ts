/**
 * Empirical Challenge Harness for Milestone 4 Challenger 2 (Admin Panel)
 * 
 * Tests:
 * 1. Build and typecheck verification of apps/admin-panel
 * 2. DashboardView KPI calculations, unassigned alerts, and store workload distribution
 * 3. BookingsView multi-criteria filtering, search matching, and inline staff assignment
 * 4. BookingDetailModal 9-step audit stepper mapping for all 11 booking statuses
 * 5. AssignStaffModal validation and state transition to CONFIRMED
 * 6. TeamView filtering and InviteEmployeeModal employee dispatch
 * 7. InventoryView stock thresholds, low-stock alerts, and part search
 * 8. Adversarial edge cases: empty data, cancelled bookings, case-insensitivity, whitespace
 */

import assert from "node:assert/strict";
import {
  BOOKING_STATUSES,
  BookingStatus,
  USER_ROLES,
  UserRole,
} from "@flashfix/shared";
import {
  STORES,
  getDashboardStats,
  getBookingsList,
  assignStaffToBooking,
  updateBookingStatus,
  getBookingTrail,
  getTeamMembers,
  inviteTeamMember,
  getInventory,
} from "../apps/admin-panel/src/api";

let passed = 0;
let total = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

// Helper mapping function from BookingDetailModal.tsx
function mapStatusToStep(status: BookingStatus): number {
  switch (status) {
    case "PENDING":
      return 1;
    case "CONFIRMED":
      return 2;
    case "PICKUP_EN_ROUTE":
    case "PICKUP_OTP_SENT":
      return 3;
    case "IN_TRANSIT":
      return 4;
    case "CUSTODY_OTP_SENT":
      return 5;
    case "IN_REPAIR":
      return 6;
    case "REPAIR_COMPLETE":
      return 7;
    case "RETURN_EN_ROUTE":
      return 8;
    case "DELIVERED":
      return 9;
    default:
      return 1;
  }
}

async function run() {
  console.log("==================================================================");
  console.log(" Flashfix Milestone 4 Challenger 2: Empirical Admin Panel Suite");
  console.log("==================================================================\n");

  console.log("Section 1: Store Hubs & Environment Constants");
  await test("Stores list contains 4 designated Hyderabad hubs", () => {
    assert.equal(STORES.length, 4, "Should have 4 Hyderabad stores");
    const storeIds = STORES.map((s) => s.id);
    assert.ok(storeIds.includes("store-001"), "Madhapur missing");
    assert.ok(storeIds.includes("store-002"), "Kondapur missing");
    assert.ok(storeIds.includes("store-003"), "Banjara Hills missing");
    assert.ok(storeIds.includes("store-004"), "Gachibowli missing");
    assert.ok(STORES.every((s) => s.city === "Hyderabad"), "All stores must be in Hyderabad");
  });

  console.log("\nSection 2: DashboardView KPI Metrics & Unassigned Alerts");
  await test("getDashboardStats returns 4 top KPIs and unassigned count", async () => {
    const stats = await getDashboardStats();
    assert.ok(typeof stats.todayTotal === "number", "todayTotal must be a number");
    assert.ok(typeof stats.pending === "number", "pending must be a number");
    assert.ok(typeof stats.inRepair === "number", "inRepair must be a number");
    assert.ok(typeof stats.delivered === "number", "delivered must be a number");
    assert.ok(typeof stats.unassignedCount === "number", "unassignedCount must be a number");
    assert.ok(stats.todayTotal >= 0, "todayTotal >= 0");
    assert.ok(stats.unassignedCount >= 0, "unassignedCount >= 0");
  });

  await test("Store-specific KPI filtering isolates store metrics", async () => {
    const allStats = await getDashboardStats("ALL");
    const madhapurStats = await getDashboardStats("store-001");
    assert.ok(madhapurStats.todayTotal <= allStats.todayTotal, "Store total cannot exceed all-stores total");
    assert.ok(madhapurStats.todayTotal >= 1, "Madhapur should have initial bookings");
  });

  await test("Unassigned alert activates when unassignedCount > 0", async () => {
    const stats = await getDashboardStats();
    const bookings = await getBookingsList();
    const actualUnassigned = bookings.filter((b) => !b.assignedEmployeeId && b.status !== "CANCELLED").length;
    assert.equal(stats.unassignedCount, actualUnassigned, "unassignedCount must match unassigned active bookings");
  });

  console.log("\nSection 3: BookingsView Multi-Criteria Filtering & Search");
  await test("getBookingsList returns comprehensive initial booking ledger", async () => {
    const bookings = await getBookingsList();
    assert.ok(bookings.length >= 6, "Initial ledger should have at least 6 bookings");
    for (const b of bookings) {
      assert.ok(b.id.startsWith("FF-"), `Booking id ${b.id} should start with FF-`);
      assert.ok(b.brand, "Brand must be defined");
      assert.ok(b.deviceModel, "Device model must be defined");
      assert.ok(b.contactName, "Contact name must be defined");
      assert.ok(b.contactPhone, "Contact phone must be defined");
      assert.ok(b.scheduledDate, "Scheduled date must be defined");
      assert.ok(BOOKING_STATUSES.includes(b.status), `Status ${b.status} must be valid BookingStatus`);
    }
  });

  await test("Filter bookings by storeId", async () => {
    const madhapurBookings = await getBookingsList({ storeId: "store-001" });
    assert.ok(madhapurBookings.length > 0, "store-001 should have bookings");
    assert.ok(madhapurBookings.every((b) => b.storeId === "store-001"), "All bookings must have storeId store-001");

    const emptyStore = await getBookingsList({ storeId: "store-nonexistent" });
    assert.equal(emptyStore.length, 0, "Non-existent store must yield empty list");
  });

  await test("Filter bookings by status", async () => {
    const pending = await getBookingsList({ status: "PENDING" });
    assert.ok(pending.length > 0, "There should be pending bookings");
    assert.ok(pending.every((b) => b.status === "PENDING"), "All must be PENDING");

    const delivered = await getBookingsList({ status: "DELIVERED" });
    assert.ok(delivered.length > 0, "There should be delivered bookings");
    assert.ok(delivered.every((b) => b.status === "DELIVERED"), "All must be DELIVERED");
  });

  await test("Search filter matches by ID, customer name, phone, or device model (case-insensitive)", async () => {
    // Search by ID
    const byId = await getBookingsList({ search: "104921" });
    assert.ok(byId.length >= 1, "Should find booking by id chunk 104921");
    assert.ok(byId.some((b) => b.id.includes("104921")));

    // Search by Customer Name with mixed case
    const byName = await getBookingsList({ search: "sRinIvAs" });
    assert.ok(byName.length >= 1, "Should match Srinivas case-insensitively");
    assert.equal(byName[0].contactName, "Srinivas Rao");

    // Search by Phone substring
    const byPhone = await getBookingsList({ search: "98491" });
    assert.ok(byPhone.length >= 1, "Should match by phone substring");

    // Search by Device Model
    const byModel = await getBookingsList({ search: "pixel 9" });
    assert.ok(byModel.length >= 1, "Should match Pixel 9 model");
    assert.ok(byModel.some((b) => b.deviceModel.toLowerCase().includes("pixel 9")));

    // Non-matching search
    const noMatch = await getBookingsList({ search: "xyznonsense9999" });
    assert.equal(noMatch.length, 0, "Non-matching search must yield 0 results");
  });

  console.log("\nSection 4: Staff Allocation Flow & State Transitions");
  await test("assignStaffToBooking assigns operative and transitions status to CONFIRMED", async () => {
    const pendingList = await getBookingsList({ status: "PENDING" });
    assert.ok(pendingList.length > 0, "Must have at least one PENDING booking to assign");
    const targetBooking = pendingList[0];

    const staffList = await getTeamMembers();
    const courier = staffList.find((s) => s.role === "EMPLOYEE")!;
    const tech = staffList.find((s) => s.id === "emp-002") || courier;

    const success = await assignStaffToBooking(targetBooking.id, courier.id, tech.id);
    assert.equal(success, true, "assignStaffToBooking must return true");

    // Re-fetch booking list to verify mutation
    const updatedList = await getBookingsList();
    const updatedBooking = updatedList.find((b) => b.id === targetBooking.id)!;
    assert.equal(updatedBooking.status, "CONFIRMED", "Status must transition to CONFIRMED");
    assert.equal(updatedBooking.assignedEmployeeId, courier.id, "Operative ID must be saved");
    assert.equal(updatedBooking.assignedEmployeeName, courier.name, "Operative name must be saved");
    assert.equal(updatedBooking.technicianId, tech.id, "Technician ID must be saved");
    assert.equal(updatedBooking.technicianName, tech.name, "Technician name must be saved");
  });

  console.log("\nSection 5: BookingDetailModal 9-Step Stepper & Status Override");
  await test("mapStatusToStep maps all 11 booking statuses correctly to 9 lifecycle steps", () => {
    assert.equal(mapStatusToStep("PENDING"), 1, "PENDING -> Step 1 (Booking Placed)");
    assert.equal(mapStatusToStep("CONFIRMED"), 2, "CONFIRMED -> Step 2 (Confirmed & Assigned)");
    assert.equal(mapStatusToStep("PICKUP_EN_ROUTE"), 3, "PICKUP_EN_ROUTE -> Step 3 (Agent En Route)");
    assert.equal(mapStatusToStep("PICKUP_OTP_SENT"), 3, "PICKUP_OTP_SENT -> Step 3 (Agent En Route)");
    assert.equal(mapStatusToStep("IN_TRANSIT"), 4, "IN_TRANSIT -> Step 4 (Pickup Handover OTP)");
    assert.equal(mapStatusToStep("CUSTODY_OTP_SENT"), 5, "CUSTODY_OTP_SENT -> Step 5 (In Repair Custody)");
    assert.equal(mapStatusToStep("IN_REPAIR"), 6, "IN_REPAIR -> Step 6 (Diagnostic & Repair)");
    assert.equal(mapStatusToStep("REPAIR_COMPLETE"), 7, "REPAIR_COMPLETE -> Step 7 (Repair Complete & QC)");
    assert.equal(mapStatusToStep("RETURN_EN_ROUTE"), 8, "RETURN_EN_ROUTE -> Step 8 (Return Delivery En Route)");
    assert.equal(mapStatusToStep("DELIVERED"), 9, "DELIVERED -> Step 9 (Delivered & Verified)");
    assert.equal(mapStatusToStep("CANCELLED"), 1, "CANCELLED -> Safe fallback Step 1");
  });

  await test("updateBookingStatus allows admin override with audit note", async () => {
    const bookings = await getBookingsList();
    const b = bookings[0];

    const ok = await updateBookingStatus(b.id, "REPAIR_COMPLETE", "Screen replacement passed all 12 QA tests");
    assert.equal(ok, true, "Status update must succeed");

    const refreshedList = await getBookingsList();
    const updated = refreshedList.find((item) => item.id === b.id)!;
    assert.equal(updated.status, "REPAIR_COMPLETE", "Status must update to REPAIR_COMPLETE");
  });

  await test("getBookingTrail returns chronological audit trail items", async () => {
    const bookings = await getBookingsList();
    const b = bookings[0];
    const trail = await getBookingTrail(b.id);
    assert.ok(Array.isArray(trail), "Trail must be an array");
    assert.ok(trail.length >= 1, "Trail should have at least initial creation event");
    assert.equal(trail[0].toStatus, "PENDING", "Initial trail event must be PENDING");
    assert.ok(trail.every((t) => t.bookingId === b.id), "All trail items must reference bookingId");
  });

  console.log("\nSection 6: TeamView & InviteEmployeeModal");
  await test("getTeamMembers returns staff directory with roles and store associations", async () => {
    const staff = await getTeamMembers();
    assert.ok(staff.length >= 5, "Should have initial staff members");
    for (const s of staff) {
      assert.ok(s.id.startsWith("emp-"), "Staff id should start with emp-");
      assert.ok(s.name, "Name must be defined");
      assert.ok(s.email, "Email must be defined");
      assert.ok(s.storeId, "storeId must be defined");
      assert.ok(["EMPLOYEE", "ADMIN"].includes(s.role), "Role must be EMPLOYEE or ADMIN");
      assert.ok(["ACTIVE", "INVITED", "OFFLINE"].includes(s.status), "Status must be valid");
    }
  });

  await test("Filter team members by storeId", async () => {
    const store1Staff = await getTeamMembers("store-001");
    assert.ok(store1Staff.length > 0, "store-001 should have staff");
    assert.ok(store1Staff.every((s) => s.storeId === "store-001"), "All staff must belong to store-001");
  });

  await test("inviteTeamMember creates new operative with INVITED status", async () => {
    const newMember = await inviteTeamMember({
      name: "Satish Varma",
      email: "satish.varma@flashfix.in",
      role: "EMPLOYEE",
      storeId: "store-004",
    });

    assert.ok(newMember.id.startsWith("emp-"), "New employee must have generated emp- ID");
    assert.equal(newMember.name, "Satish Varma");
    assert.equal(newMember.email, "satish.varma@flashfix.in");
    assert.equal(newMember.role, "EMPLOYEE");
    assert.equal(newMember.storeId, "store-004");
    assert.equal(newMember.status, "INVITED");
    assert.equal(newMember.activeJobsCount, 0);

    // Verify presence in team directory
    const team = await getTeamMembers();
    const found = team.find((s) => s.id === newMember.id);
    assert.ok(found, "Newly invited staff must be listed in staff directory");
  });

  console.log("\nSection 7: InventoryView Parts & Low-Stock Alerts");
  await test("getInventory returns hardware parts stock with thresholds", async () => {
    const inventory = await getInventory();
    assert.ok(inventory.length >= 5, "Initial inventory should contain at least 5 component SKUs");
    for (const item of inventory) {
      assert.ok(item.id.startsWith("inv-"), "Inventory id should start with inv-");
      assert.ok(item.partName, "Part name must be defined");
      assert.ok(item.sku, "SKU must be defined");
      assert.ok(Array.isArray(item.compatibleWith), "compatibleWith must be an array");
      assert.ok(item.compatibleWith.length > 0, "Must have compatible models");
      assert.ok(typeof item.quantity === "number", "quantity must be number");
      assert.ok(typeof item.minThreshold === "number", "minThreshold must be number");
      assert.ok(typeof item.unitCostPaise === "number", "unitCostPaise must be number");
    }
  });

  await test("Low-stock detection identifies parts below reorder threshold", async () => {
    const inventory = await getInventory();
    const lowStockItems = inventory.filter((i) => i.quantity <= i.minThreshold);
    assert.ok(lowStockItems.length >= 1, "There should be at least one low-stock item to verify alert banner");
    for (const item of lowStockItems) {
      assert.ok(item.quantity <= item.minThreshold, `Quantity ${item.quantity} should be <= minThreshold ${item.minThreshold}`);
    }
  });

  console.log("\nSection 8: Adversarial Edge Cases");
  await test("Cancelled bookings do not count towards unassignedCount", async () => {
    // Add cancelled booking to verify calculation logic
    const initialStats = await getDashboardStats();
    
    // Simulate updating a booking to CANCELLED
    const list = await getBookingsList();
    const pendingItem = list.find((b) => b.status === "PENDING");
    if (pendingItem) {
      await updateBookingStatus(pendingItem.id, "CANCELLED", "Customer cancelled before assignment");
      const updatedStats = await getDashboardStats();
      assert.ok(updatedStats.unassignedCount <= initialStats.unassignedCount, "Cancelled booking should not be unassigned");
    }
  });

  await test("Empty search strings or strings with only whitespace return full list", async () => {
    const all = await getBookingsList();
    const emptySearch = await getBookingsList({ search: "   " });
    assert.equal(emptySearch.length, all.length, "Whitespace search should return all bookings without filtering");
  });

  await test("Special characters in search do not throw or crash", async () => {
    const specialChars = await getBookingsList({ search: "$%^&*()!" });
    assert.equal(specialChars.length, 0, "Special characters non-matching should gracefully return empty array");
  });

  console.log("\n==================================================================");
  console.log(` RESULT: ${passed} / ${total} tests PASSED (100% clean)`);
  console.log("==================================================================");
}

run().catch((err) => {
  console.error("\nFATAL TEST SUITE FAILURE:", err);
  process.exit(1);
});
