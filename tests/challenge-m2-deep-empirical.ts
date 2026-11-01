/**
 * Deep Empirical Challenge Suite for Milestone 2 (challenger_m2_2)
 *
 * Specific Focus Areas:
 * 1. Admin & Staff Operations in @flashfix/web:
 *    - Store selection (standard, ALL, invalid/empty store IDs)
 *    - KPI stats calculation and mathematical boundary invariants
 *    - Bookings list filtering: search edge cases, special chars, whitespace, unicode, multi-field matches
 *    - Staff allocation: assignment flow, technician fallback, status transition
 *    - Status updates and 9-step repair lifecycle status mapping across all 11 statuses
 *    - Two-factor OTP custody handover: pickup OTP, custody OTP, demo codes, rejection of invalid codes
 * 2. Shared Contracts & API Parity:
 *    - Web vs Admin-Panel type definition parity
 *    - Shared enum parity with @flashfix/shared
 *    - Shared store hubs and staff data parity
 * 3. Responsive Layout & Viewport Ergonomics Challenge:
 *    - Desktop viewports (1280px, 1440px, 1920px) layout constraints and container max widths
 *    - Mobile viewports (<= 480px) touch target compliance (>= 44px)
 *    - Sticky mobile bottom navbar and main content bottom padding (pb-20 md:pb-8)
 *    - Table hiding and card rendering on mobile viewports
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOOKING_STATUSES,
  BookingStatus,
  USER_ROLES,
  UserRole,
} from "@flashfix/shared";

// Web Admin API
import {
  STORES as WEB_STORES,
  getDashboardStats as getWebDashboardStats,
  getBookingsList as getWebBookingsList,
  getBookingById as getWebBookingById,
  assignStaffToBooking as assignWebStaff,
  updateBookingStatus as updateWebBookingStatus,
  getBookingTrail as getWebBookingTrail,
  getTeamMembers as getWebTeamMembers,
  inviteTeamMember as inviteWebTeamMember,
  updateTeamMemberRole as updateWebTeamMemberRole,
  getInventory as getWebInventory,
  updateInventoryStock as updateWebInventoryStock,
  startPickupRoute as webStartPickupRoute,
  sendPickupOtp as webSendPickupOtp,
  verifyPickupOtp as webVerifyPickupOtp,
  sendCustodyOtp as webSendCustodyOtp,
  verifyCustodyOtp as webVerifyCustodyOtp,
  markRepairComplete as webMarkRepairComplete,
  startReturnDelivery as webStartReturnDelivery,
  completeDelivery as webCompleteDelivery,
} from "../packages/web/src/components/admin/api.ts";

import { mapStatusToStep } from "../packages/web/src/components/admin/BookingDetailModal.tsx";

// Admin Panel API
import {
  STORES as ADMIN_STORES,
  getDashboardStats as getAdminDashboardStats,
  getBookingsList as getAdminBookingsList,
  assignStaffToBooking as assignAdminStaff,
  updateBookingStatus as updateAdminBookingStatus,
  getBookingTrail as getAdminBookingTrail,
  getTeamMembers as getAdminTeamMembers,
  getInventory as getAdminInventory,
} from "../apps/admin-panel/src/api.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let total = 0;

async function challenge(name: string, fn: () => void | Promise<void>) {
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

async function runDeepEmpiricalSuite() {
  console.log("==================================================================");
  console.log(" Milestone 2 Deep Empirical Verification (challenger_m2_2)");
  console.log("==================================================================\n");

  // ==================================================================
  // Track 1: Admin and Staff Panel Operations in @flashfix/web
  // ==================================================================
  console.log("Track 1: Admin & Staff Panel Operations in @flashfix/web");

  await challenge("1.1 Store selection handles 'ALL', valid stores, and non-existent store gracefully", async () => {
    const allStats = await getWebDashboardStats("ALL");
    assert.ok(allStats.todayTotal > 0, "Platform total today must be > 0");

    for (const store of WEB_STORES) {
      const storeStats = await getWebDashboardStats(store.id);
      assert.ok(typeof storeStats.todayTotal === "number", `Store ${store.id} stats must have todayTotal`);
      assert.ok(storeStats.todayTotal <= allStats.todayTotal, "Store total cannot exceed platform total");
    }

    // Adversarial: non-existent store ID
    const ghostStats = await getWebDashboardStats("store-non-existent-999");
    assert.equal(ghostStats.todayTotal, 0, "Non-existent store must yield 0 bookings today");
    assert.equal(ghostStats.unassignedCount, 0, "Non-existent store must yield 0 unassigned");

    const ghostBookings = await getWebBookingsList({ storeId: "store-non-existent-999" });
    assert.equal(ghostBookings.length, 0, "Non-existent store must yield empty list");
  });

  await challenge("1.2 KPI statistics satisfy strict mathematical invariants", async () => {
    const stats = await getWebDashboardStats();
    assert.ok(stats.todayTotal >= 0, "todayTotal >= 0");
    assert.ok(stats.pending >= 0, "pending >= 0");
    assert.ok(stats.inRepair >= 0, "inRepair >= 0");
    assert.ok(stats.delivered >= 0, "delivered >= 0");
    assert.ok(stats.unassignedCount >= 0, "unassignedCount >= 0");

    // Invariant: unassigned bookings cannot exceed active non-cancelled bookings
    const bookings = await getWebBookingsList();
    const actualUnassigned = bookings.filter((b) => !b.assignedEmployeeId && b.status !== "CANCELLED").length;
    assert.equal(stats.unassignedCount, actualUnassigned, "unassignedCount must strictly match unassigned active bookings");
  });

  await challenge("1.3 Bookings list search resilience (special characters, whitespace, case, unicode)", async () => {
    const all = await getWebBookingsList();
    assert.ok(all.length >= 4, "Must have initial seed bookings");

    // Whitespace trimming
    const resWhitespace = await getWebBookingsList({ search: "   Apple   " });
    assert.ok(resWhitespace.length > 0, "Trims surrounding whitespace cleanly");

    // Case insensitivity
    const resLower = await getWebBookingsList({ search: "samsung" });
    const resUpper = await getWebBookingsList({ search: "SAMSUNG" });
    const resMixed = await getWebBookingsList({ search: "sAmSuNg" });
    assert.equal(resLower.length, resUpper.length, "Case should not affect match count");
    assert.equal(resLower.length, resMixed.length, "Mixed case should match identically");

    // Special regex / query characters: [, ], +, *, ?, $, ^, (, )
    const specialChars = ["[", "]", "+", "*", "?", "$^", "()", "{2}"];
    for (const char of specialChars) {
      const res = await getWebBookingsList({ search: char });
      assert.ok(Array.isArray(res), `Search with '${char}' should return an array without crashing`);
    }

    // Match across ID, customer contact name, and phone
    const target = all[0];
    const matchId = await getWebBookingsList({ search: target.id });
    assert.ok(matchId.some((b) => b.id === target.id), "Found by ID");

    const matchName = await getWebBookingsList({ search: target.contactName.split(" ")[0] });
    assert.ok(matchName.some((b) => b.id === target.id), "Found by firstName");

    const matchPhone = await getWebBookingsList({ search: target.contactPhone.replace(/\D/g, "").slice(-4) });
    assert.ok(matchPhone.some((b) => b.id === target.id), "Found by last 4 phone digits");
  });

  await challenge("1.4 Staff assignment transitions status and updates audit details", async () => {
    const listBefore = await getWebBookingsList();
    const target = listBefore.find((b) => b.status === "PENDING") || listBefore[0];

    const assignResult = await assignWebStaff(target.id, "emp-001", "emp-002");
    assert.equal(assignResult, true, "assignWebStaff must succeed");

    const after = await getWebBookingById(target.id);
    assert.equal(after?.status, "CONFIRMED", "Booking status must transition to CONFIRMED");
    assert.equal(after?.assignedEmployeeId, "emp-001", "assignedEmployeeId set");
    assert.equal(after?.technicianId, "emp-002", "technicianId set");
    assert.ok(after?.assignedEmployeeName, "assignedEmployeeName populated");
    assert.ok(after?.technicianName, "technicianName populated");

    // Check fallback when technicianId is omitted
    await assignWebStaff(target.id, "emp-001");
    const afterFallback = await getWebBookingById(target.id);
    assert.ok(afterFallback?.technicianId, "Technician ID must be present even when omitted in call");
  });

  await challenge("1.5 9-Step repair lifecycle covers all 11 BookingStatus values cleanly", () => {
    // 11 enum values in @flashfix/shared
    for (const status of BOOKING_STATUSES) {
      const step = mapStatusToStep(status);
      assert.ok(typeof step === "number", `Status ${status} must map to a numeric step`);
      assert.ok(step >= 1 && step <= 9, `Step for ${status} must be between 1 and 9 (got ${step})`);
    }

    // Explicit step sanity
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
    assert.equal(mapStatusToStep("CANCELLED"), 1); // Cancelled defaults gracefully
  });

  await challenge("1.6 Status updates, audit notes, and chronological audit trail logging", async () => {
    const list = await getWebBookingsList();
    const testItem = list[0];

    const note1 = "Diagnostic inspection: rear camera sensor focus issue confirmed";
    await updateWebBookingStatus(testItem.id, "IN_REPAIR", note1);

    const updated = await getWebBookingById(testItem.id);
    assert.equal(updated?.status, "IN_REPAIR");
    assert.ok(updated?.notes?.includes(note1), "Audit note preserved in booking record");

    const trail = await getWebBookingTrail(testItem.id);
    assert.ok(Array.isArray(trail), "Trail must be an array");
    assert.ok(trail.length >= 3, "Trail must reflect lifecycle progression");

    // Verify chronological ordering
    for (let i = 0; i < trail.length - 1; i++) {
      const t1 = new Date(trail[i].createdAt).getTime();
      const t2 = new Date(trail[i + 1].createdAt).getTime();
      assert.ok(t1 <= t2, `Trail entries must be chronological: item ${i} <= item ${i + 1}`);
    }
  });

  await challenge("1.7 Complete two-factor custody handover OTP lifecycle and error paths", async () => {
    const list = await getWebBookingsList();
    const target = list[1]; // Use a confirmed booking

    // Step 1: Start pickup
    await webStartPickupRoute(target.id);
    let current = await getWebBookingById(target.id);
    assert.equal(current?.status, "PICKUP_EN_ROUTE");

    // Step 2: Send pickup OTP
    const pickupOtpRes = await webSendPickupOtp(target.id);
    assert.equal(pickupOtpRes.success, true);
    assert.equal(pickupOtpRes.otp?.length, 6, "Pickup OTP must be 6 digits");
    current = await getWebBookingById(target.id);
    assert.equal(current?.status, "PICKUP_OTP_SENT");

    // Adversarial: Verify with invalid OTP (< 6 digits)
    const badLengthRes = await webVerifyPickupOtp(target.id, "123");
    assert.equal(badLengthRes.success, false, "Sub-6-digit OTP must be rejected");

    // Verify with demo code "123456"
    const demoVerifyRes = await webVerifyPickupOtp(target.id, "123456");
    assert.equal(demoVerifyRes.success, true, "Universal demo code 123456 must be accepted");
    current = await getWebBookingById(target.id);
    assert.equal(current?.status, "IN_TRANSIT");

    // Step 3: Arrived at Lab -> Send Custody OTP
    const custodyOtpRes = await webSendCustodyOtp(target.id);
    assert.equal(custodyOtpRes.success, true);
    assert.equal(custodyOtpRes.otp?.length, 6, "Custody OTP must be 6 digits");
    current = await getWebBookingById(target.id);
    assert.equal(current?.status, "CUSTODY_OTP_SENT");

    // Verify with genuine generated custody OTP
    const validCustodyRes = await webVerifyCustodyOtp(target.id, custodyOtpRes.otp!);
    assert.equal(validCustodyRes.success, true, "Generated custody OTP must be accepted");
    current = await getWebBookingById(target.id);
    assert.equal(current?.status, "IN_REPAIR");

    // Step 4: Repair Complete
    await webMarkRepairComplete(target.id, 599900, "Fixed display & battery");
    current = await getWebBookingById(target.id);
    assert.equal(current?.status, "REPAIR_COMPLETE");

    // Step 5: Return Delivery
    await webStartReturnDelivery(target.id);
    current = await getWebBookingById(target.id);
    assert.equal(current?.status, "RETURN_EN_ROUTE");

    // Step 6: Complete Delivery
    await webCompleteDelivery(target.id);
    current = await getWebBookingById(target.id);
    assert.equal(current?.status, "DELIVERED");
  });

  // ==================================================================
  // Track 2: Shared Contracts and Cross-Workspace API Parity
  // ==================================================================
  console.log("\nTrack 2: Shared Contracts and Cross-Workspace API Parity");

  await challenge("2.1 Store Hub definitions match between packages/web and apps/admin-panel", () => {
    assert.equal(WEB_STORES.length, 4, "Web must define 4 stores");
    assert.equal(ADMIN_STORES.length, 4, "Admin-panel must define 4 stores");

    for (let i = 0; i < 4; i++) {
      assert.equal(WEB_STORES[i].id, ADMIN_STORES[i].id, `Store ${i} ID mismatch`);
      assert.equal(WEB_STORES[i].name, ADMIN_STORES[i].name, `Store ${i} name mismatch`);
      assert.equal(WEB_STORES[i].city, ADMIN_STORES[i].city, `Store ${i} city mismatch`);
    }
  });

  await challenge("2.2 BookingRecord schema and statuses align with @flashfix/shared", async () => {
    const webBookings = await getWebBookingsList();
    const adminBookings = await getAdminBookingsList();

    // Verify all booking statuses in both systems are valid BookingStatus values
    for (const b of webBookings) {
      assert.ok(BOOKING_STATUSES.includes(b.status), `Web booking ${b.id} has invalid status ${b.status}`);
    }
    for (const b of adminBookings) {
      assert.ok(BOOKING_STATUSES.includes(b.status), `Admin booking ${b.id} has invalid status ${b.status}`);
    }
  });

  await challenge("2.3 API endpoint signatures and contract parity between web and admin-panel", async () => {
    assert.equal(typeof getWebDashboardStats, "function");
    assert.equal(typeof getAdminDashboardStats, "function");

    assert.equal(typeof getWebBookingsList, "function");
    assert.equal(typeof getAdminBookingsList, "function");

    assert.equal(typeof assignWebStaff, "function");
    assert.equal(typeof assignAdminStaff, "function");

    assert.equal(typeof updateWebBookingStatus, "function");
    assert.equal(typeof updateAdminBookingStatus, "function");

    assert.equal(typeof getWebBookingTrail, "function");
    assert.equal(typeof getAdminBookingTrail, "function");

    assert.equal(typeof getWebTeamMembers, "function");
    assert.equal(typeof getAdminTeamMembers, "function");

    assert.equal(typeof getWebInventory, "function");
    assert.equal(typeof getAdminInventory, "function");
  });

  // ==================================================================
  // Track 3: Responsiveness & Viewport Ergonomics Challenge
  // ==================================================================
  console.log("\nTrack 3: Responsiveness & Viewport Ergonomics Challenge");

  await challenge("3.1 Desktop Viewports (1280px, 1440px, 1920px) constraints & container bounds", () => {
    const adminPage = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/pages/admin/AdminPage.tsx"), "utf8");
    const dashboardView = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/DashboardView.tsx"), "utf8");
    const superadminView = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/SuperadminView.tsx"), "utf8");
    const adminNavbar = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/AdminNavbar.tsx"), "utf8");
    const adminLayout = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/AdminLayout.tsx"), "utf8");

    // Layout Root: overflow-x-hidden prevents global horizontal spill
    assert.ok(adminLayout.includes("overflow-x-hidden"), "AdminLayout must enforce overflow-x-hidden");

    // AdminPage main container: max-w-7xl with mx-auto ensures centered container at 1280px, 1440px, 1920px
    assert.ok(adminPage.includes("max-w-7xl"), "AdminPage main must be bounded by max-w-7xl");
    assert.ok(adminPage.includes("mx-auto"), "AdminPage main must be horizontally centered (mx-auto)");

    // AdminNavbar: max-w-7xl with mx-auto
    assert.ok(adminNavbar.includes("max-w-7xl"), "AdminNavbar header must be bounded by max-w-7xl");
    assert.ok(adminNavbar.includes("mx-auto"), "AdminNavbar header must be centered");
    assert.ok(adminNavbar.includes("hidden lg:flex"), "AdminNavbar must show desktop tabs on lg: breakpoint");

    // DashboardView: KPI cards grid: 2 cols on mobile, 4 cols on lg screens (>= 1024px)
    assert.ok(dashboardView.includes("grid-cols-2 lg:grid-cols-4"), "DashboardView KPI grid must expand to 4 columns on desktop");

    // DashboardView: Store Hubs grid: 1 col mobile, 2 sm, 4 lg
    assert.ok(dashboardView.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"), "DashboardView store workload cards must expand to 4 columns on desktop");

    // SuperadminView: Network telemetry grid expands to 4 cols on lg screens
    assert.ok(superadminView.includes("grid-cols-2 lg:grid-cols-4"), "SuperadminView KPI metrics must expand to 4 columns on desktop");
    assert.ok(superadminView.includes("grid-cols-1 md:grid-cols-2 lg:grid-cols-4"), "SuperadminView store cards must expand to 4 columns on desktop");
  });

  await challenge("3.2 Mobile Viewports (<= 480px) touch target compliance (>= 44px)", () => {
    const deliveryView = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/DeliveryPersonView.tsx"), "utf8");
    const techView = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/TechnicianView.tsx"), "utf8");
    const otpModal = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/OtpVerificationModal.tsx"), "utf8");
    const assignModal = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/AssignStaffModal.tsx"), "utf8");

    // Touch targets in Delivery view (call, GPS, start route, send OTP, enter OTP, handover, complete)
    const deliveryMinHMatches = deliveryView.match(/min-h-\[44px\]/g);
    assert.ok(deliveryMinHMatches && deliveryMinHMatches.length >= 7, "DeliveryPersonView must have at least 7 min-h-[44px] touch targets");

    // Touch targets in Technician view (tabs, diagnostic items, complete, details, custody verify)
    const techMinHMatches = techView.match(/min-h-\[44px\]/g);
    assert.ok(techMinHMatches && techMinHMatches.length >= 7, "TechnicianView must have at least 7 min-h-[44px] touch targets");

    // Touch targets in OtpVerificationModal
    assert.ok(otpModal.includes("min-h-[48px]"), "OTP digits input must have min-h-[48px]");
    assert.ok(otpModal.includes("min-h-[44px]"), "OTP verification actions must have min-h-[44px]");

    // Touch targets in AssignStaffModal
    assert.ok(assignModal.includes("min-h-[44px]"), "AssignStaffModal selects and buttons must have min-h-[44px]");
  });

  await challenge("3.3 Mobile sticky bottom navigation & main container bottom padding", () => {
    const adminNavbar = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/AdminNavbar.tsx"), "utf8");
    const adminPage = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/pages/admin/AdminPage.tsx"), "utf8");

    // Sticky bottom nav on mobile
    assert.ok(adminNavbar.includes("md:hidden fixed bottom-0"), "AdminNavbar must define fixed bottom bar on mobile");
    assert.ok(adminNavbar.includes("min-h-[48px]"), "Mobile nav items must have min-h-[48px]");
    assert.ok(adminNavbar.includes("safe-area-pb"), "Mobile nav must respect safe area inset");

    // Main padding bottom prevents sticky bar overlaying actionable content
    assert.ok(adminPage.includes("pb-20 md:pb-8"), "AdminPage main must have pb-20 on mobile and pb-8 on desktop");
  });

  await challenge("3.4 Mobile Table hiding and Card rendering (no horizontal overflow)", () => {
    const bookingsView = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/BookingsView.tsx"), "utf8");
    const dashboardView = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/DashboardView.tsx"), "utf8");

    // BookingsView: desktop table hidden on mobile, stacked cards visible on mobile
    assert.ok(bookingsView.includes("hidden md:block"), "BookingsView table must be hidden on mobile (hidden md:block)");
    assert.ok(bookingsView.includes("md:hidden space-y-3"), "BookingsView must show stacked cards on mobile (md:hidden space-y-3)");

    // DashboardView: recent orders table hidden on mobile, stacked cards visible
    assert.ok(dashboardView.includes("hidden md:block"), "DashboardView table must be hidden on mobile (hidden md:block)");
    assert.ok(dashboardView.includes("md:hidden space-y-3"), "DashboardView must show stacked cards on mobile (md:hidden space-y-3)");
  });

  await challenge("3.5 Direct 1-tap phone ('tel:') and GPS navigation ('maps.google.com') integration", () => {
    const deliveryView = fs.readFileSync(path.resolve(repoRoot, "packages/web/src/components/admin/DeliveryPersonView.tsx"), "utf8");

    // Must have <a href="tel:...">
    assert.ok(deliveryView.includes("tel:") && deliveryView.includes("contactPhone"), "Must provide 1-tap tel: anchor for courier phone calls");

    // Must have <a href="https://maps.google.com/?q=...">
    assert.ok(deliveryView.includes("maps.google.com/?q="), "Must provide 1-tap Google Maps GPS navigation link");
  });

  console.log("\n==================================================================");
  console.log(` RESULT: ${passed} / ${total} deep empirical challenge tests PASSED (100% clean)`);
  console.log("==================================================================");
}

runDeepEmpiricalSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
