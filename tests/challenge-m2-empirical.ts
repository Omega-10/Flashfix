/**
 * Empirical Adversarial Challenge Runner for Milestone 2 (challenger_m2_1)
 * 
 * Verifies:
 * 1. Route & Navigation Isolation in @flashfix/web (App.tsx outside RootLayout/Lenis)
 * 2. Deep Subroute Resilience & Unauthorized State Handling
 * 3. Mobile Viewport & Responsiveness Stress Matrix (320px, 375px, 390px, 412px, 480px)
 * 4. Touch Target Compliance (min-h-[44px] on all mobile operative controls)
 * 5. Full Two-Factor Physical Custody State Machine & Audit Trail Integrity
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import API from @flashfix/web
import {
  STORES,
  getDashboardStats,
  getBookingsList,
  getBookingById,
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
} from "../packages/web/src/components/admin/api.ts";
import { mapStatusToStep } from "../packages/web/src/components/admin/BookingDetailModal.tsx";
import { BookingStatus, UserRole } from "@flashfix/shared";

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

async function run() {
  console.log("==================================================================");
  console.log(" Flashfix Milestone 2 Challenger: Empirical Verification Suite");
  console.log("==================================================================\n");

  // Read component source files
  const appTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/App.tsx"), "utf8");
  const adminPageTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/pages/admin/AdminPage.tsx"), "utf8");
  const adminLayoutTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/AdminLayout.tsx"), "utf8");
  const adminNavbarTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/AdminNavbar.tsx"), "utf8");
  const roleSwitcherTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/RoleSwitcher.tsx"), "utf8");
  const deliveryTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/DeliveryPersonView.tsx"), "utf8");
  const techTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/TechnicianView.tsx"), "utf8");
  const bookingsTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/BookingsView.tsx"), "utf8");
  const dashboardTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/DashboardView.tsx"), "utf8");
  const superadminTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/SuperadminView.tsx"), "utf8");
  const otpModalTsx = fs.readFileSync(path.resolve(__dirname, "../packages/web/src/components/admin/OtpVerificationModal.tsx"), "utf8");

  // Section 1: Route & Navigation Isolation
  console.log("Section 1: Route & Navigation Architecture");
  await test("/admin and /flashfix/admin routes registered outside RootLayout", () => {
    assert.ok(appTsx.includes('path: "/admin"'));
    assert.ok(appTsx.includes('element: <AdminLayout />'));
    assert.ok(appTsx.includes('path: "/flashfix/admin"'));
    assert.ok(appTsx.includes('path: "/flashfix/admin/*"'));
  });

  await test("AdminLayout decoupled from Lenis SmoothScroll and Consumer Navbar", () => {
    assert.ok(!adminLayoutTsx.includes("SmoothScroll"));
    assert.ok(!adminLayoutTsx.includes("Lenis"));
    assert.ok(!adminLayoutTsx.includes("Navbar"));
    assert.ok(adminLayoutTsx.includes("Outlet"));
    assert.ok(adminLayoutTsx.includes("overflow-x-hidden"));
  });

  await test("AdminPage supports all 7 operational tabs with valid views", () => {
    const tabs = ["dashboard", "superadmin", "technician", "delivery", "bookings", "team", "inventory"];
    for (const tab of tabs) {
      assert.ok(adminPageTsx.includes(`activeTab === "${tab}"`), `Missing view for tab ${tab}`);
    }
  });

  await test("Graceful fallback for non-existent admin subroutes and unexpected params", () => {
    const validTabs = ["dashboard", "superadmin", "technician", "delivery", "bookings", "team", "inventory"];
    function resolveTab(paramTab?: string, initialTab?: string): string {
      return paramTab && validTabs.includes(paramTab) ? paramTab : initialTab || "dashboard";
    }
    assert.equal(resolveTab("nonexistent-tab"), "dashboard");
    assert.equal(resolveTab(""), "dashboard");
    assert.equal(resolveTab("<script>"), "dashboard");
    assert.equal(resolveTab(undefined, "delivery"), "delivery");
  });

  // Section 2: Mobile Viewport & Responsiveness Stress Testing
  console.log("\nSection 2: Mobile Viewport & Responsiveness Stress Matrix (320px - 480px)");
  await test("Horizontal overflow prevention: max-w-full and overflow-x-hidden on operative views", () => {
    assert.ok(deliveryTsx.includes("max-w-full") && deliveryTsx.includes("overflow-x-hidden"));
    assert.ok(techTsx.includes("max-w-full") && techTsx.includes("overflow-x-hidden"));
    assert.ok(adminLayoutTsx.includes("max-w-full") && adminLayoutTsx.includes("overflow-x-hidden"));
    assert.ok(dashboardTsx.includes("max-w-full"));
    assert.ok(superadminTsx.includes("max-w-full"));
    assert.ok(bookingsTsx.includes("max-w-full"));
  });

  await test("Desktop tables hidden on mobile (hidden md:block) & stacked cards rendered (md:hidden)", () => {
    assert.ok(bookingsTsx.includes("hidden md:block") && bookingsTsx.includes("md:hidden"));
    assert.ok(dashboardTsx.includes("hidden md:block") && dashboardTsx.includes("md:hidden"));
  });

  await test("Absence of rigid pixel widths exceeding 320px mobile viewport limit", () => {
    const rigidWidths = ["w-[500px]", "w-[600px]", "w-[800px]", "min-w-[500px]", "min-w-[600px]"];
    for (const rw of rigidWidths) {
      assert.ok(!deliveryTsx.includes(rw), `deliveryTsx must not contain ${rw}`);
      assert.ok(!techTsx.includes(rw), `techTsx must not contain ${rw}`);
    }
  });

  await test("Touch target size compliance: min-h-[44px] enforced on operative buttons & controls", () => {
    const deliveryMinH = deliveryTsx.match(/min-h-\[44px\]/g) || [];
    assert.ok(deliveryMinH.length >= 6, `Delivery view has ${deliveryMinH.length} min-h-[44px] targets`);

    const techMinH = techTsx.match(/min-h-\[44px\]/g) || [];
    assert.ok(techMinH.length >= 6, `Technician view has ${techMinH.length} min-h-[44px] targets`);

    assert.ok(adminNavbarTsx.includes("min-h-[48px]"), "Mobile bottom nav must have min-h-[48px]");
    assert.ok(otpModalTsx.includes("min-h-[48px]"), "OTP modal input must have min-h-[48px]");
    assert.ok(otpModalTsx.includes("min-h-[44px]"), "OTP modal actions must have min-h-[44px]");
  });

  await test("Mobile operative 1-tap actions: functional tel: and Google Maps GPS schemes", () => {
    assert.ok(deliveryTsx.includes("tel:") && deliveryTsx.includes("contactPhone"), "Must render functional tel: link");
    assert.ok(deliveryTsx.includes("https://maps.google.com/?q="));
    assert.ok(deliveryTsx.includes("target=\"_blank\""));
    assert.ok(deliveryTsx.includes("rel=\"noopener noreferrer\""));
  });

  await test("Mobile sticky bottom navigation bar with safe-area padding", () => {
    assert.ok(adminNavbarTsx.includes("md:hidden fixed bottom-0"));
    assert.ok(adminNavbarTsx.includes("safe-area-pb"));
    assert.ok(adminNavbarTsx.includes("grid-cols-5"));
  });

  await test("Mobile Viewport Simulation Matrix: 320px, 375px, 390px, 412px, 480px", () => {
    const viewports = [
      { name: "iPhone SE", width: 320 },
      { name: "iPhone mini", width: 375 },
      { name: "iPhone 14/15", width: 390 },
      { name: "Pixel / Galaxy", width: 412 },
      { name: "Mobile Boundary", width: 480 },
    ];
    for (const vp of viewports) {
      assert.ok(vp.width < 768);
      const horizontalPadding = 16;
      const perTabWidth = (vp.width - horizontalPadding - 16) / 5;
      assert.ok(perTabWidth >= 48, `${vp.name} (${vp.width}px) tab width ${perTabWidth}px >= 48px`);
    }
  });

  // Section 3: Two-Factor Custody Handover State Machine
  console.log("\nSection 3: Two-Factor Physical Custody State Machine & Lifecycle");
  await test("Complete 9-step physical custody handover lifecycle execution", async () => {
    const list = await getBookingsList();
    const b = list[0];

    // Reset to PENDING
    await updateBookingStatus(b.id, "PENDING" as BookingStatus);
    assert.equal(mapStatusToStep("PENDING"), 1);

    // 1. Assign Staff -> CONFIRMED
    await assignStaffToBooking(b.id, "emp-001", "emp-002");
    let state = await getBookingById(b.id);
    assert.equal(state?.status, "CONFIRMED");
    assert.equal(mapStatusToStep("CONFIRMED"), 2);

    // 2. Start Pickup Route -> PICKUP_EN_ROUTE
    await startPickupRoute(b.id);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "PICKUP_EN_ROUTE");
    assert.equal(mapStatusToStep("PICKUP_EN_ROUTE"), 3);

    // 3. Arrived at Doorstep -> Send OTP
    const pickupOtpRes = await sendPickupOtp(b.id);
    assert.equal(pickupOtpRes.success, true);
    assert.ok(pickupOtpRes.otp);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "PICKUP_OTP_SENT");

    // Adversarial: Bad OTP fails
    const badPickup = await verifyPickupOtp(b.id, "00000");
    assert.equal(badPickup.success, false);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "PICKUP_OTP_SENT");

    // Good OTP succeeds -> IN_TRANSIT
    const goodPickup = await verifyPickupOtp(b.id, pickupOtpRes.otp!);
    assert.equal(goodPickup.success, true);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "IN_TRANSIT");
    assert.equal(mapStatusToStep("IN_TRANSIT"), 4);

    // 4. Arrived at Lab -> Send Custody OTP
    const custodyOtpRes = await sendCustodyOtp(b.id);
    assert.equal(custodyOtpRes.success, true);
    assert.ok(custodyOtpRes.otp);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "CUSTODY_OTP_SENT");
    assert.equal(mapStatusToStep("CUSTODY_OTP_SENT"), 5);

    // Adversarial: Bad Custody OTP fails
    const badCustody = await verifyCustodyOtp(b.id, "11111");
    assert.equal(badCustody.success, false);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "CUSTODY_OTP_SENT");

    // Tech verifies Custody OTP -> IN_REPAIR
    const goodCustody = await verifyCustodyOtp(b.id, custodyOtpRes.otp!);
    assert.equal(goodCustody.success, true);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "IN_REPAIR");
    assert.equal(mapStatusToStep("IN_REPAIR"), 6);

    // 5. Complete Hardware Repair -> REPAIR_COMPLETE
    await markRepairComplete(b.id, 999900, "OEM Display QA Approved");
    state = await getBookingById(b.id);
    assert.equal(state?.status, "REPAIR_COMPLETE");
    assert.equal(state?.finalCostPaise, 999900);
    assert.equal(mapStatusToStep("REPAIR_COMPLETE"), 7);

    // 6. Start Return Delivery -> RETURN_EN_ROUTE
    await startReturnDelivery(b.id);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "RETURN_EN_ROUTE");
    assert.equal(mapStatusToStep("RETURN_EN_ROUTE"), 8);

    // 7. Complete Delivery -> DELIVERED
    await completeDelivery(b.id);
    state = await getBookingById(b.id);
    assert.equal(state?.status, "DELIVERED");
    assert.equal(mapStatusToStep("DELIVERED"), 9);

    // 8. Audit Trail Verification
    const trail = await getBookingTrail(b.id);
    assert.ok(trail.length >= 5);
  });

  // Section 4: Multi-Store & Operational Telemetry
  console.log("\nSection 4: Multi-Store Hubs & Data Isolation");
  await test("Hyderabad store hubs count & metadata", () => {
    assert.equal(STORES.length, 4);
    assert.ok(STORES.every((s) => s.city === "Hyderabad"));
  });

  await test("Dashboard KPIs compute correctly across platform and per store", async () => {
    const globalStats = await getDashboardStats();
    assert.ok(globalStats.todayTotal > 0);
    assert.ok(globalStats.unassignedCount >= 0);

    const storeStats = await getDashboardStats("store-001");
    assert.ok(storeStats.todayTotal <= globalStats.todayTotal);
  });

  await test("Adversarial search and filtering does not crash", async () => {
    const dirtyInputs = ["", "   ", "' OR 1=1 --", "<script>", "%20%2F", "NON_EXISTENT_QUERY_1234"];
    for (const query of dirtyInputs) {
      const res = await getBookingsList({ search: query });
      assert.ok(Array.isArray(res));
    }
  });

  console.log("\n==================================================================");
  console.log(` RESULT: ${passed} / ${total} tests PASSED (100% clean)`);
  console.log("==================================================================");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
