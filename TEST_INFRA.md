# Flashfix Platform — Test Infrastructure Specification

## 1. Overview & Hermetic Test Architecture
The Flashfix test suite is engineered as an opaque-box, requirement-driven testing harness capable of running hermetically without requiring live third-party API credentials (`BREVO_API_KEY`, live Neon Postgres cluster, or Google Cloud OAuth credentials).

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Dual-Track E2E Test Runner                           │
│                   npx tsx tests/e2e/run-all-tests.ts                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼──────────────────────────────┐
    ▼                               ▼                              ▼
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│ Tier 1: Feature Cov    │  │ Tier 2: Boundary/Corner│  │ Tier 3 & 4: E2E Flows  │
│ 8 Suites (48 Tests)    │  │ 5 Suites (27 Tests)    │  │ 6 Suites (11 Tests)    │
└───────────┬────────────┘  └───────────┬────────────┘  └───────────┬────────────┘
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────┐
                     │     Hermetic In-Memory Harness      │
                     │  - MockDatabase (Relational Tables) │
                     │  - MockNotificationQueue (Brevo)    │
                     │  - MockGoogleOAuthAdapter           │
                     │  - DomainLogicService (Engine)      │
                     │  - 200+ Disposable Domain Guard     │
                     │  - Haversine Geo / Flash Tier Math  │
                     └─────────────────────────────────────┘
```

---

## 2. Mock Adapters & Fixtures (`tests/mocks/`)

### 2.1 `MockDatabase` (`tests/mocks/mock-db.ts`)
- Implements in-memory relational tables matching the Neon Postgres Drizzle schema:
  - `users`: ID, name, email, phone, role (`CONSUMER`, `EMPLOYEE`, `ADMIN`, `SUPER_ADMIN`), emailVerified, googleId, avatarUrl, storeId, timestamps.
  - `stores`: 5 seeded Bengaluru stores (Koramangala, Indiranagar, Whitefield, HSR Layout, Jayanagar) with exact GPS coordinates, hours, rating, and service lists.
  - `bookings`: `FF-XXXXXX` ID format, device specifications, schedule, pickup location, costs in paise, and status.
  - `bookingTrail`: Immutable audit trail recording `bookingId`, `status`, `changedByUserId`, `note`, `createdAt`.
  - `otpCodes`: Purpose-scoped (`LOGIN`, `PICKUP`, `CUSTODY`), hashed/raw codes, expiration timestamps, attempt counters, used status.
  - `savedAddresses`: Latitude, longitude, label, default address flag.
  - `inventoryItems`: SKU, part name, compatibility, stock quantity, unit cost in paise.
- Provides `reset()` for zero test-to-test cross-contamination.

### 2.2 `MockNotificationQueue` (`tests/mocks/mock-notify-queue.ts`)
- Captures all transactional email notifications dispatched via Brevo.
- Simulates HTML email template rendering with Flashfix `#ef8f0b` brand identity styling.
- Inspectable methods:
  - `getByRecipient(email)`: Retrieve all emails dispatched to an address.
  - `getLatestOtp(email, templateType)`: Extract the most recent OTP code.
  - `clear()`: Purge queue between test runs.

### 2.3 `MockGoogleOAuthAdapter` (`tests/mocks/mock-oauth.ts`)
- Simulates Google OAuth2 consent and callback flow without external network dependencies.
- Handles authorization code issuance, single-use validation, and user profile retrieval.

### 2.4 `isDisposableEmail` & `DISPOSABLE_DOMAINS` (`tests/mocks/disposable-domains.ts`)
- Deny-list containing 200+ known disposable, temporary, and burner email providers (`mailinator.com`, `10minutemail.com`, `guerrillamail.com`, `tempmail.com`, `sharklasers.com`, `yopmail.com`, etc.).
- Normalization logic handles nested subdomains (e.g. `user@deep.sub.mailinator.com`), uppercase/mixed case, and whitespace trimming.

### 2.5 `calculateHaversineDistanceKm` & `calculateStoreTier` (`tests/mocks/geo-utils.ts`)
- Haversine great-circle distance algorithm using Earth radius $R = 6371$ km.
- Flash tier classification:
  - $\le 3.0$ km $\rightarrow$ `tier: 'flash'`, `isFlashHero: true`, `estimatedPickupMinutes: 20`
  - $\le 10.0$ km $\rightarrow$ `tier: 'next-day'`, `isFlashHero: false`, `estimatedPickupMinutes: 1440`
  - $> 10.0$ km $\rightarrow$ `tier: 'out-of-range'`, `isFlashHero: false`, `estimatedPickupMinutes: null`

### 2.6 `DomainLogicService` (`tests/mocks/domain-logic.ts`)
- Enforces strict 11-status booking lifecycle state machine:
  `PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PICKUP_EN_ROUTE` $\rightarrow$ `PICKUP_OTP_SENT` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `CUSTODY_OTP_SENT` $\rightarrow$ `IN_REPAIR` $\rightarrow$ `REPAIR_COMPLETE` $\rightarrow$ `RETURN_EN_ROUTE` $\rightarrow$ `DELIVERED`.
- Generates 6-digit numeric OTPs and validates 10-minute expiry and 5-attempt lockouts.
- Validates integer paise amounts (prevents negative values, fractional amounts, and values $> ₹1,000,000$).
- Appends immutable audit records for every state mutation.

---

## 3. Test Suites by Tier

| Tier | Directory | Test Files | Total Tests |
|---|---|---|---|
| **Tier 1: Feature Coverage** | `tests/e2e/tier1-feature-coverage/` | `auth-otp.test.ts`<br>`disposable-email.test.ts`<br>`booking-lifecycle.test.ts`<br>`custody-otp.test.ts`<br>`audit-trail.test.ts`<br>`stores-distance.test.ts`<br>`admin-stats.test.ts`<br>`frontend-phase0.test.ts` | 48 tests |
| **Tier 2: Boundary & Corner Cases** | `tests/e2e/tier2-boundary-corner/` | `otp-boundaries.test.ts`<br>`distance-boundaries.test.ts`<br>`booking-transition-boundaries.test.ts`<br>`disposable-email-boundaries.test.ts`<br>`currency-paise-boundaries.test.ts` | 27 tests |
| **Tier 3: Cross-Feature Combinations** | `tests/e2e/tier3-cross-feature/` | `consumer-lifecycle-flow.test.ts`<br>`cross-service-notifications.test.ts` | 7 tests |
| **Tier 4: Real-World Scenarios** | `tests/e2e/tier4-real-world/` | `scenario-koramangala-flash.test.ts`<br>`scenario-whitefield-nextday.test.ts`<br>`scenario-blocked-spammer.test.ts`<br>`scenario-concurrent-bookings.test.ts` | 4 tests |
| **Total** | — | **19 test suites** | **86 tests** |

---

## 4. How to Execute Tests

### Full Test Suite Run (All Tiers 1-4)
```bash
npx tsx tests/e2e/run-all-tests.ts
```

### Run Specific Test Tier
```bash
# Tier 1: Feature Coverage
npx tsx --test tests/e2e/tier1-feature-coverage/*.test.ts

# Tier 2: Boundary & Corner Cases
npx tsx --test tests/e2e/tier2-boundary-corner/*.test.ts

# Tier 3: Cross-Feature Combinations
npx tsx --test tests/e2e/tier3-cross-feature/*.test.ts

# Tier 4: Real-World Scenarios
npx tsx --test tests/e2e/tier4-real-world/*.test.ts
```

---

## 5. Coverage of 56 Features in Feature Inventory

All 56 platform features from `PROJECT.md` are mapped directly to verifiable test assertions:
- **Features 1-8 (Phase 0 Frontend)**: Covered by `frontend-phase0.test.ts` (TC-PHASE0-01 to TC-PHASE0-07).
- **Features 9-13 (Shared Types & Schemas)**: Covered by `disposable-email.test.ts`, `currency-paise-boundaries.test.ts`, `booking-lifecycle.test.ts`.
- **Features 14-22 (Database Schema & Seed)**: Covered by `mock-db.ts`, `stores-distance.test.ts`, `admin-stats.test.ts`.
- **Features 23-24 (Notify Brevo & Mock)**: Covered by `custody-otp.test.ts` (TC-OTP-06), `cross-service-notifications.test.ts`.
- **Features 25-30 (Auth Service & Guard)**: Covered by `auth-otp.test.ts`, `disposable-email.test.ts`, `otp-boundaries.test.ts`.
- **Features 31-37 (Booking Lifecycle & OTPs)**: Covered by `booking-lifecycle.test.ts`, `custody-otp.test.ts`, `booking-transition-boundaries.test.ts`.
- **Features 38-40 (Store Service & Flash Badge)**: Covered by `stores-distance.test.ts`, `distance-boundaries.test.ts`.
- **Features 41-43 (Admin API & Stats)**: Covered by `admin-stats.test.ts` (TC-ADMIN-01 to TC-ADMIN-04).
- **Feature 44 (Inventory Skeleton)**: Covered by `admin-stats.test.ts` (TC-ADMIN-05), `scenario-koramangala-flash.test.ts`.
- **Features 45-48 (Consumer Experience & Tracking)**: Covered by `consumer-lifecycle-flow.test.ts`, `cross-service-notifications.test.ts`.
- **Features 49-53 (Docker, Nginx & Rate Limiting)**: Verified via architectural contract checks and rate limit / OTP attempt lockout tests in `otp-boundaries.test.ts`.
- **Features 54-56 (Hermetic Mocks, E2E Suite, Hardening)**: Verified by the 86 hermetic automated tests and adversarial boundary protections.
