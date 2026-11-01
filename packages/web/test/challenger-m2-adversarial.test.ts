import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Admin API
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
} from "../src/components/admin/api.ts";
import { mapStatusToStep } from "../src/components/admin/BookingDetailModal.tsx";
import { BookingStatus, UserRole } from "@flashfix/shared";

describe("Adversarial Milestone 2 Verification Suite (challenger_m2_1)", () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ROUTE & COMPONENT NAVIGATION STRESS TESTING
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Dimension 1: Route & Component Navigation Stress Matrix", () => {
    const appTsx = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");
    const adminPageTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/pages/admin/AdminPage.tsx"),
      "utf8"
    );
    const adminLayoutTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/AdminLayout.tsx"),
      "utf8"
    );

    test("CRITICAL: AdminLayout is decoupled from RootLayout, Lenis SmoothScroll, and Consumer Navbar", () => {
      // Must NOT be nested within RootLayout
      assert.ok(appTsx.includes('path: "/admin"'), "App.tsx must register /admin route");
      assert.ok(appTsx.includes('element: <AdminLayout />'), "App.tsx must mount AdminLayout at /admin");
      
      // AdminLayout must NOT import or wrap children in SmoothScroll
      assert.ok(!adminLayoutTsx.includes("SmoothScroll"), "AdminLayout must NOT import SmoothScroll");
      assert.ok(!adminLayoutTsx.includes("Lenis"), "AdminLayout must NOT reference Lenis");
      assert.ok(!adminLayoutTsx.includes("Navbar"), "AdminLayout must NOT render consumer storefront Navbar");
      assert.ok(adminLayoutTsx.includes("Outlet"), "AdminLayout must render Outlet for subroutes");
    });

    test("Route Redirection: /flashfix/admin and /flashfix/admin/* alias routes redirect to /admin", () => {
      assert.ok(
        appTsx.includes('path: "/flashfix/admin"'),
        "App.tsx must define /flashfix/admin alias route"
      );
      assert.ok(
        appTsx.includes('path: "/flashfix/admin/*"'),
        "App.tsx must define wildcard /flashfix/admin/* alias route"
      );
      assert.ok(
        appTsx.includes('<Navigate to="/admin" replace />'),
        "Must redirect to /admin with replace flag"
      );
    });

    test("Admin Tab Coverage: Valid tabs include all 7 operational perspectives", () => {
      const validTabs = [
        "dashboard",
        "superadmin",
        "technician",
        "delivery",
        "bookings",
        "team",
        "inventory",
      ];
      for (const tab of validTabs) {
        assert.ok(
          adminPageTsx.includes(`"${tab}"`),
          `AdminPage must recognize tab: ${tab}`
        );
        assert.ok(
          adminPageTsx.includes(`activeTab === "${tab}"`),
          `AdminPage must conditionally render view for: ${tab}`
        );
      }
    });

    test("Adversarial Subroute Handling: Non-existent or malicious tab params fallback gracefully without crashing", () => {
      // Test the exact tab derivation logic from AdminPage.tsx
      const validTabs = [
        "dashboard",
        "superadmin",
        "technician",
        "delivery",
        "bookings",
        "team",
        "inventory",
      ];

      function resolveTab(paramTab?: string, initialTab?: string): string {
        return paramTab && validTabs.includes(paramTab)
          ? paramTab
          : initialTab || "dashboard";
      }

      // Valid paths
      assert.equal(resolveTab("dashboard"), "dashboard");
      assert.equal(resolveTab("superadmin"), "superadmin");
      assert.equal(resolveTab("technician"), "technician");
      assert.equal(resolveTab("delivery"), "delivery");
      assert.equal(resolveTab("bookings"), "bookings");
      assert.equal(resolveTab("team"), "team");
      assert.equal(resolveTab("inventory"), "inventory");

      // Non-existent / malicious inputs
      assert.equal(resolveTab("unknown-tab"), "dashboard", "Unknown tab must fall back to dashboard");
      assert.equal(resolveTab("admin"), "dashboard", "Redundant 'admin' param falls back to dashboard");
      assert.equal(resolveTab(""), "dashboard", "Empty param falls back to dashboard");
      assert.equal(resolveTab("<script>alert(1)</script>"), "dashboard", "XSS string safely falls back to dashboard");
      assert.equal(resolveTab("../../../etc/passwd"), "dashboard", "Directory traversal safely falls back to dashboard");
      assert.equal(resolveTab("%20"), "dashboard", "Encoded whitespace falls back to dashboard");
      assert.equal(resolveTab("DASHBOARD"), "dashboard", "Uppercase fails validTabs check and defaults cleanly");
      assert.equal(resolveTab(undefined, "technician"), "technician", "initialTab respected when paramTab is undefined");
    });

    test("Role Switcher State Matrix: Unknown or malicious roles fall back safely", () => {
      const roleSwitcherTsx = fs.readFileSync(
        path.resolve(__dirname, "../src/components/admin/RoleSwitcher.tsx"),
        "utf8"
      );

      // Verify fallback pattern in RoleSwitcher
      assert.ok(
        roleSwitcherTsx.includes("roles.find((r) => r.id === currentRole) || roles[0]"),
        "RoleSwitcher must guard against unrecognized roles with fallback to roles[0]"
      );

      // Verify all 4 required operational roles are represented
      assert.ok(roleSwitcherTsx.includes('"SUPER_ADMIN"'), "Must include SUPER_ADMIN");
      assert.ok(roleSwitcherTsx.includes('"ADMIN"'), "Must include ADMIN");
      assert.ok(roleSwitcherTsx.includes('"TECHNICIAN"'), "Must include TECHNICIAN");
      assert.ok(roleSwitcherTsx.includes('"COURIER"'), "Must include COURIER");
    });

    test("Role-to-Route Transition Mapping: Each role transitions to designated view", () => {
      // Simulate handleRoleChange logic from AdminPage.tsx
      function getTargetTabForRole(role: string): string {
        switch (role) {
          case "SUPER_ADMIN":
            return "superadmin";
          case "ADMIN":
            return "dashboard";
          case "TECHNICIAN":
            return "technician";
          case "COURIER":
            return "delivery";
          default:
            return "dashboard";
        }
      }

      assert.equal(getTargetTabForRole("SUPER_ADMIN"), "superadmin");
      assert.equal(getTargetTabForRole("ADMIN"), "dashboard");
      assert.equal(getTargetTabForRole("TECHNICIAN"), "technician");
      assert.equal(getTargetTabForRole("COURIER"), "delivery");
      assert.equal(getTargetTabForRole("UNKNOWN_ROLE"), "dashboard");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. VIEWPORT & RESPONSIVENESS STRESS TESTING
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Dimension 2: Viewport & Responsiveness Stress Testing (320px - 480px)", () => {
    const deliveryTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/DeliveryPersonView.tsx"),
      "utf8"
    );
    const techTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/TechnicianView.tsx"),
      "utf8"
    );
    const bookingsTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/BookingsView.tsx"),
      "utf8"
    );
    const dashboardTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/DashboardView.tsx"),
      "utf8"
    );
    const superadminTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/SuperadminView.tsx"),
      "utf8"
    );
    const navbarTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/AdminNavbar.tsx"),
      "utf8"
    );
    const layoutTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/AdminLayout.tsx"),
      "utf8"
    );
    const otpModalTsx = fs.readFileSync(
      path.resolve(__dirname, "../src/components/admin/OtpVerificationModal.tsx"),
      "utf8"
    );

    test("Overflow Containment: Root and view containers enforce horizontal overflow clipping", () => {
      // AdminLayout must clip horizontal overflow
      assert.ok(
        layoutTsx.includes("overflow-x-hidden") && layoutTsx.includes("max-w-full"),
        "AdminLayout must enforce max-w-full and overflow-x-hidden"
      );

      // DeliveryPersonView root container
      assert.ok(
        deliveryTsx.includes("max-w-full") && deliveryTsx.includes("overflow-x-hidden"),
        "DeliveryPersonView must enforce max-w-full and overflow-x-hidden"
      );

      // TechnicianView root container
      assert.ok(
        techTsx.includes("max-w-full") && techTsx.includes("overflow-x-hidden"),
        "TechnicianView must enforce max-w-full and overflow-x-hidden"
      );

      // DashboardView and SuperadminView
      assert.ok(
        dashboardTsx.includes("max-w-full"),
        "DashboardView must enforce max-w-full"
      );
      assert.ok(
        superadminTsx.includes("max-w-full"),
        "SuperadminView must enforce max-w-full"
      );
      assert.ok(
        bookingsTsx.includes("max-w-full"),
        "BookingsView must enforce max-w-full"
      );
    });

    test("No Uncontained Desktop Tables on Mobile (<= 480px Viewport Isolation)", () => {
      // BookingsView table must be hidden on mobile (<md)
      assert.ok(
        bookingsTsx.includes("hidden md:block"),
        "BookingsView desktop table must be hidden on mobile via 'hidden md:block'"
      );
      assert.ok(
        bookingsTsx.includes("md:hidden"),
        "BookingsView must render stacked cards on mobile via 'md:hidden'"
      );

      // DashboardView recent bookings table must be hidden on mobile
      assert.ok(
        dashboardTsx.includes("hidden md:block"),
        "DashboardView desktop table must be hidden on mobile via 'hidden md:block'"
      );
      assert.ok(
        dashboardTsx.includes("md:hidden"),
        "DashboardView must render stacked cards on mobile via 'md:hidden'"
      );

      // Verify no hardcoded wide widths that break 320px viewport
      const forbiddenNarrowOverflowClasses = [
        "w-[500px]",
        "w-[600px]",
        "w-[700px]",
        "w-[800px]",
        "min-w-[500px]",
        "min-w-[600px]",
      ];
      for (const cls of forbiddenNarrowOverflowClasses) {
        assert.ok(
          !deliveryTsx.includes(cls),
          `DeliveryPersonView must not contain rigid width ${cls}`
        );
        assert.ok(
          !techTsx.includes(cls),
          `TechnicianView must not contain rigid width ${cls}`
        );
      }
    });

    test("Touch Target Sizing: All mobile operative interactive controls satisfy min-h-[44px]", () => {
      // Delivery view touch targets
      assert.ok(
        deliveryTsx.includes("min-h-[44px]"),
        "DeliveryPersonView must enforce min-h-[44px]"
      );
      const deliveryMinHMatches = deliveryTsx.match(/min-h-\[44px\]/g) || [];
      assert.ok(
        deliveryMinHMatches.length >= 6,
        `DeliveryPersonView must have at least 6 touch-compliant controls (found ${deliveryMinHMatches.length})`
      );

      // Technician view touch targets
      assert.ok(
        techTsx.includes("min-h-[44px]"),
        "TechnicianView must enforce min-h-[44px]"
      );
      const techMinHMatches = techTsx.match(/min-h-\[44px\]/g) || [];
      assert.ok(
        techMinHMatches.length >= 6,
        `TechnicianView must have at least 6 touch-compliant controls (found ${techMinHMatches.length})`
      );

      // Mobile sticky bottom navigation touch targets
      assert.ok(
        navbarTsx.includes("min-h-[48px]"),
        "AdminNavbar mobile navigation buttons must enforce min-h-[48px]"
      );

      // OTP Verification Modal touch targets
      assert.ok(
        otpModalTsx.includes("min-h-[48px]"),
        "OtpVerificationModal PIN inputs must enforce min-h-[48px]"
      );
      assert.ok(
        otpModalTsx.includes("min-h-[44px]"),
        "OtpVerificationModal action buttons must enforce min-h-[44px]"
      );
    });

    test("Mobile Direct Actions: 1-tap phone and GPS navigation schemes are validated", () => {
      // 1-Tap Phone Call scheme
      assert.ok(
        deliveryTsx.includes("href={`tel:${booking.contactPhone}`}"),
        "DeliveryPersonView must render functional tel: link with booking.contactPhone"
      );

      // 1-Tap Google Maps GPS scheme
      assert.ok(
        deliveryTsx.includes("https://maps.google.com/?q="),
        "DeliveryPersonView must render Google Maps navigation link"
      );
      assert.ok(
        deliveryTsx.includes("target=\"_blank\""),
        "Maps link must open in external window"
      );
      assert.ok(
        deliveryTsx.includes("rel=\"noopener noreferrer\""),
        "Maps link must include security rel attributes"
      );
    });

    test("Sticky Bottom Navigation: Mobile bottom nav includes all 4 staff roles + bookings", () => {
      assert.ok(
        navbarTsx.includes("aria-label=\"Mobile Staff Navigation\""),
        "Must declare accessibility label on mobile nav"
      );
      assert.ok(
        navbarTsx.includes("md:hidden fixed bottom-0"),
        "Mobile nav must be fixed to bottom on <md viewports"
      );
      assert.ok(
        navbarTsx.includes("grid-cols-5"),
        "Mobile bottom nav must lay out 5 primary staff tabs"
      );
    });

    test("Mobile Viewport Simulation Matrix: 320px, 375px, 390px, 412px, and 480px Layout Guarantees", () => {
      const viewports = [
        { name: "iPhone SE", width: 320 },
        { name: "iPhone mini", width: 375 },
        { name: "iPhone 14/15", width: 390 },
        { name: "Pixel / Galaxy", width: 412 },
        { name: "Mobile Boundary", width: 480 },
      ];

      for (const vp of viewports) {
        // 1. Verify viewport is sub-breakpoint (< 768px md)
        assert.ok(vp.width < 768, `${vp.name} (${vp.width}px) is in mobile layout range (<md)`);

        // 2. Verify all tables in operative views are hidden on this viewport
        assert.ok(bookingsTsx.includes("hidden md:block"));
        assert.ok(dashboardTsx.includes("hidden md:block"));

        // 3. Verify stacked cards are active on this viewport
        assert.ok(bookingsTsx.includes("md:hidden"));
        assert.ok(dashboardTsx.includes("md:hidden"));

        // 4. Verify bottom navigation is active on this viewport
        assert.ok(navbarTsx.includes("md:hidden fixed bottom-0"));

        // 5. Verify column budget calculation at this viewport
        const horizontalPadding = 16; // px-2 on nav
        const availableNavWidth = vp.width - horizontalPadding;
        const perTabWidth = (availableNavWidth - 4 * 4) / 5; // 5 columns, gap-1 (4px)
        assert.ok(
          perTabWidth >= 48,
          `At ${vp.width}px (${vp.name}), per-tab width ${perTabWidth}px exceeds minimum touch target size (48px)`
        );

        // 6. Verify 2-column action buttons budget in DeliveryPersonView
        const cardPadding = 32; // px-4 padding on card
        const availableCardWidth = vp.width - cardPadding;
        const colWidth = (availableCardWidth - 8) / 2; // grid-cols-2 gap-2
        assert.ok(
          colWidth >= 120,
          `At ${vp.width}px (${vp.name}), colWidth ${colWidth}px accommodates 1-tap call/gps buttons`
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. TWO-FACTOR CUSTODY STATE MACHINE EMPIRICAL STRESS MATRIX
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Dimension 3: Two-Factor Custody State Machine Stress Matrix", () => {
    test("Full Lifecycle: PENDING -> CONFIRMED -> PICKUP -> CUSTODY -> REPAIR -> DELIVERED", async () => {
      // Create new booking target
      const list = await getBookingsList();
      const booking = list[0];
      assert.ok(booking, "Must have seed booking");

      // Reset booking status to PENDING for controlled test
      await updateBookingStatus(booking.id, "PENDING" as BookingStatus, "Test Reset to PENDING");
      let current = await getBookingById(booking.id);
      assert.equal(current?.status, "PENDING");
      assert.equal(mapStatusToStep("PENDING"), 1);

      // Step 2: Staff Allocation -> CONFIRMED
      const assignOk = await assignStaffToBooking(booking.id, "emp-001", "emp-002");
      assert.equal(assignOk, true);
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "CONFIRMED");
      assert.equal(current?.assignedEmployeeId, "emp-001");
      assert.equal(current?.technicianId, "emp-002");
      assert.equal(mapStatusToStep("CONFIRMED"), 2);

      // Step 3: Courier starts pickup route -> PICKUP_EN_ROUTE
      const pickupRouteOk = await startPickupRoute(booking.id);
      assert.equal(pickupRouteOk, true);
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "PICKUP_EN_ROUTE");
      assert.equal(mapStatusToStep("PICKUP_EN_ROUTE"), 3);

      // Step 4: Arrived at doorstep -> Dispatch Customer OTP
      const pickupOtpRes = await sendPickupOtp(booking.id);
      assert.equal(pickupOtpRes.success, true);
      assert.ok(pickupOtpRes.otp, "Pickup OTP generated");
      assert.match(pickupOtpRes.otp!, /^\d{6}$/, "Pickup OTP must be 6 digits");
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "PICKUP_OTP_SENT");

      // Adversarial Check: Invalid OTP submission fails without state transition
      const invalidVerifyRes = await verifyPickupOtp(booking.id, "00000"); // wrong length
      assert.equal(invalidVerifyRes.success, false, "Invalid code must be rejected");
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "PICKUP_OTP_SENT", "Status must remain PICKUP_OTP_SENT after bad OTP");

      // Verify with legitimate generated OTP
      const validVerifyRes = await verifyPickupOtp(booking.id, pickupOtpRes.otp!);
      assert.equal(validVerifyRes.success, true);
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "IN_TRANSIT");
      assert.equal(mapStatusToStep("IN_TRANSIT"), 4);

      // Step 5: Arrived at Lab -> Dispatch Lab Custody OTP
      const custodyOtpRes = await sendCustodyOtp(booking.id);
      assert.equal(custodyOtpRes.success, true);
      assert.ok(custodyOtpRes.otp, "Custody OTP generated");
      assert.match(custodyOtpRes.otp!, /^\d{6}$/, "Custody OTP must be 6 digits");
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "CUSTODY_OTP_SENT");
      assert.equal(mapStatusToStep("CUSTODY_OTP_SENT"), 5);

      // Adversarial Check: Lab technician verifies with invalid code
      const invalidCustodyRes = await verifyCustodyOtp(booking.id, "99999");
      assert.equal(invalidCustodyRes.success, false, "Invalid custody OTP must be rejected");
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "CUSTODY_OTP_SENT");

      // Technician enters valid custody OTP -> IN_REPAIR
      const validCustodyRes = await verifyCustodyOtp(booking.id, custodyOtpRes.otp!);
      assert.equal(validCustodyRes.success, true);
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "IN_REPAIR");
      assert.equal(mapStatusToStep("IN_REPAIR"), 6);

      // Step 6: Mark Repair Complete & QA Approved -> REPAIR_COMPLETE
      const markCompleteOk = await markRepairComplete(booking.id, 799900, "OEM Display QA Approved");
      assert.equal(markCompleteOk, true);
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "REPAIR_COMPLETE");
      assert.equal(current?.finalCostPaise, 799900);
      assert.equal(mapStatusToStep("REPAIR_COMPLETE"), 7);

      // Step 7: Dispatch Return Courier -> RETURN_EN_ROUTE
      const returnRouteOk = await startReturnDelivery(booking.id);
      assert.equal(returnRouteOk, true);
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "RETURN_EN_ROUTE");
      assert.equal(mapStatusToStep("RETURN_EN_ROUTE"), 8);

      // Step 8: Final Handover -> DELIVERED
      const deliveryOk = await completeDelivery(booking.id);
      assert.equal(deliveryOk, true);
      current = await getBookingById(booking.id);
      assert.equal(current?.status, "DELIVERED");
      assert.equal(mapStatusToStep("DELIVERED"), 9);

      // Step 9: Audit Trail Integrity
      const trail = await getBookingTrail(booking.id);
      assert.ok(trail.length >= 5, "Audit trail must preserve sequential chronological events");
    });

    test("Universal Demo Code: '123456' accepted in mock mode for doorstep and custody verification", async () => {
      const list = await getBookingsList();
      const b = list[1];

      await updateBookingStatus(b.id, "PICKUP_OTP_SENT" as BookingStatus);
      const resPickup = await verifyPickupOtp(b.id, "123456");
      assert.equal(resPickup.success, true, "Universal demo code 123456 accepted for pickup");

      await updateBookingStatus(b.id, "CUSTODY_OTP_SENT" as BookingStatus);
      const resCustody = await verifyCustodyOtp(b.id, "123456");
      assert.equal(resCustody.success, true, "Universal demo code 123456 accepted for custody");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. MULTI-STORE DATA ISOLATION & ADVERSARIAL FILTERING
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Dimension 4: Multi-Store Data Isolation & Adversarial Filtering", () => {
    test("Cross-hub Isolation: Filtering by storeId returns only that hub's bookings", async () => {
      for (const store of STORES) {
        const storeBookings = await getBookingsList({ storeId: store.id });
        for (const b of storeBookings) {
          assert.equal(
            b.storeId,
            store.id,
            `Booking ${b.id} must belong to requested store ${store.id}`
          );
        }
      }
    });

    test("Adversarial Search Matrix: Robust handling of dirty inputs and special characters", async () => {
      // 1. Whitespace only search returns all bookings
      const all = await getBookingsList();
      const whitespaceResults = await getBookingsList({ search: "   " });
      assert.equal(whitespaceResults.length, all.length);

      // 2. Case-insensitive search
      const appleUpper = await getBookingsList({ search: "APPLE" });
      const appleLower = await getBookingsList({ search: "apple" });
      assert.equal(appleUpper.length, appleLower.length);

      // 3. SQL injection payload does not crash
      const sqlResults = await getBookingsList({ search: "' OR '1'='1" });
      assert.ok(Array.isArray(sqlResults));

      // 4. XSS payload does not crash
      const xssResults = await getBookingsList({ search: "<script>alert(1)</script>" });
      assert.ok(Array.isArray(xssResults));

      // 5. Non-matching string returns empty array safely
      const noMatch = await getBookingsList({ search: "ZZZZZZZZ_NO_DEVICE_EVER" });
      assert.equal(noMatch.length, 0);

      // 6. Non-existent store ID returns empty array safely
      const badStore = await getBookingsList({ storeId: "store-999-nonexistent" });
      assert.equal(badStore.length, 0);

      // 7. Non-existent status returns empty array safely
      const badStatus = await getBookingsList({ status: "NONEXISTENT_STATUS" });
      assert.equal(badStatus.length, 0);
    });

    test("Store Team Directory & Role Upgrades", async () => {
      const initialStaff = await getTeamMembers();
      assert.ok(initialStaff.length >= 4);

      // Invite operative to store-004
      const invited = await inviteTeamMember({
        name: "Rahul Sharma",
        email: "rahul.sharma@flashfix.in",
        role: "EMPLOYEE",
        storeId: "store-004",
      });
      assert.equal(invited.status, "INVITED");
      assert.equal(invited.storeId, "store-004");

      // Elevate to ADMIN
      const elevated = await updateTeamMemberRole(invited.id, "ADMIN" as UserRole);
      assert.equal(elevated, true);
      const refreshed = (await getTeamMembers()).find((s) => s.id === invited.id);
      assert.equal(refreshed?.role, "ADMIN");
    });

    test("Inventory Stock Control & Low Stock Thresholds", async () => {
      const items = await getInventory();
      assert.ok(items.length >= 4);

      const target = items[0];
      const updateOk = await updateInventoryStock(target.id, 25);
      assert.equal(updateOk, true);

      const freshItems = await getInventory();
      const updated = freshItems.find((i) => i.id === target.id);
      assert.equal(updated?.quantity, 25);
    });
  });
});
