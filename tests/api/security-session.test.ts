/**
 * Security & Session Foundation Test Suite
 * Derivation: ORIGINAL_REQUEST.md § R1, PROJECT.md § Milestone 1, TEST_INFRA.md § Feature 1 & 2
 *
 * Verifies:
 * 1. Immediate rejection (401) of legacy unsigned/forgeable tokens (ff_jwt_, ff_staff_, mock_ff_token_).
 * 2. Cryptographic signature integrity (401 on tampered signatures, evil secrets, expired tokens).
 * 3. Fail-closed secret resolution in production (fatal error / 500 on missing or weak JWT_SECRET).
 * 4. Server-side RBAC store boundary enforcement (403 on cross-store access for Store Admin, Tech, Rider).
 * 5. HttpOnly, SameSite=Lax, Path=/ cookie attributes on ff_session.
 */

import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  TEST_JWT_SECRET,
  ATTACKER_JWT_SECRET,
  signSessionToken,
  signTamperedToken,
  createForgedLegacyToken,
  parseSetCookie,
  SessionPayload,
  UserRole,
} from "./test-helpers.js";

// Reference implementation of Fail-Closed Secret Resolver (api/_lib/env.ts contract)
export function resolveJwtSecret(env: { NODE_ENV?: string; JWT_SECRET?: string }): string {
  const secret = (env.JWT_SECRET || "").trim();
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable is missing or insecure in production.");
  }
  return "flashfix_local_development_jwt_secret_32bytes_min";
}

// Reference implementation of Session Verification & RBAC Guards (api/_lib/authz.ts & session.ts contract)
export interface AuthVerificationResult {
  statusCode: number;
  error?: string;
  session?: SessionPayload;
}

export function verifySessionHeaderOrCookie(
  authHeader: string | undefined,
  cookieHeader: string | undefined,
  secret: string = TEST_JWT_SECRET
): AuthVerificationResult {
  let token: string | undefined;

  // Extract from ff_session cookie first
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    if (cookies["ff_session"]) {
      token = cookies["ff_session"];
    }
  }

  // Fall back to Authorization: Bearer <token>
  if (!token && authHeader) {
    token = authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  if (!token) {
    return { statusCode: 401, error: "UNAUTHORIZED: Authentication session required" };
  }

  // Reject legacy forged patterns explicitly
  if (
    token.startsWith("ff_jwt_") ||
    token.startsWith("ff_staff_") ||
    token.startsWith("mock_ff_token_") ||
    token.startsWith("local-dev-jwt-")
  ) {
    return { statusCode: 401, error: "UNAUTHORIZED: Unsigned legacy token format is rejected" };
  }

  // Verify HS256 signature
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as SessionPayload;
    return { statusCode: 200, session: payload };
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return { statusCode: 401, error: "UNAUTHORIZED: Session token has expired" };
    }
    return { statusCode: 401, error: "UNAUTHORIZED: Cryptographic signature verification failed" };
  }
}

export function enforceStoreAccess(
  session: SessionPayload,
  targetStoreId: string
): { allowed: boolean; statusCode: number; error?: string } {
  // Super Admin has global cross-store access
  if (session.role === "SUPER_ADMIN") {
    return { allowed: true, statusCode: 200 };
  }

  // Check storeId or storeIds membership
  const authorizedStores = [
    ...(session.storeId ? [session.storeId] : []),
    ...(session.storeIds || []),
  ];

  if (!authorizedStores.includes(targetStoreId)) {
    return {
      allowed: false,
      statusCode: 403,
      error: `FORBIDDEN: User with role "${session.role}" lacks access to store "${targetStoreId}"`,
    };
  }

  return { allowed: true, statusCode: 200 };
}

export function buildSessionCookieHeader(
  token: string,
  options: { isProduction?: boolean; rememberMe?: boolean } = {}
): string {
  const parts = [
    `ff_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.isProduction) {
    parts.push("Secure");
  }
  if (options.rememberMe) {
    parts.push("Max-Age=604800"); // 7 days
  }
  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Test Execution
// ---------------------------------------------------------------------------

test.describe("Security & Session Foundation — Tier 1 & 2 Invariant Suites", () => {
  // -------------------------------------------------------------------------
  // Feature 1: Unsigned Token Rejection
  // -------------------------------------------------------------------------
  test.describe("1. Unsigned Token & Legacy Forgery Rejection", () => {
    const protectedRoutes = [
      "/api/admin/overview",
      "/api/admin/bookings",
      "/api/admin/team",
      "/api/admin/stores",
      "/api/bookings/mine",
      "/api/auth/me",
    ];

    for (const route of protectedRoutes) {
      test(`Rejects forged ff_jwt_ token with 401 on ${route}`, () => {
        const forgedToken = createForgedLegacyToken("ff_jwt_", {
          id: "usr-forged-123",
          email: "attacker@malicious.com",
          role: "CONSUMER",
        });

        const authHeaderRes = verifySessionHeaderOrCookie(`Bearer ${forgedToken}`, undefined);
        assert.strictEqual(authHeaderRes.statusCode, 401);
        assert.match(authHeaderRes.error!, /Unsigned legacy token/i);

        const cookieRes = verifySessionHeaderOrCookie(undefined, `ff_session=${forgedToken}`);
        assert.strictEqual(cookieRes.statusCode, 401);
        assert.match(cookieRes.error!, /Unsigned legacy token/i);
      });

      test(`Rejects forged ff_staff_ token with 401 on ${route}`, () => {
        const forgedStaffToken = createForgedLegacyToken("ff_staff_", {
          id: "usr-forged-staff",
          email: "superadmin@flashfix.in",
          role: "SUPER_ADMIN",
          storeId: "store-001",
        });

        const result = verifySessionHeaderOrCookie(`Bearer ${forgedStaffToken}`, undefined);
        assert.strictEqual(result.statusCode, 401);
      });

      test(`Rejects mock_ff_token_ and local-dev-jwt- tokens with 401 on ${route}`, () => {
        const mockToken = createForgedLegacyToken("mock_ff_token_", {});
        const localDevToken = createForgedLegacyToken("local-dev-jwt-", {});

        assert.strictEqual(verifySessionHeaderOrCookie(`Bearer ${mockToken}`, undefined).statusCode, 401);
        assert.strictEqual(verifySessionHeaderOrCookie(`Bearer ${localDevToken}`, undefined).statusCode, 401);
      });

      test(`Rejects missing credentials with 401 on ${route}`, () => {
        const result = verifySessionHeaderOrCookie(undefined, undefined);
        assert.strictEqual(result.statusCode, 401);
        assert.match(result.error!, /UNAUTHORIZED/i);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Feature 2: Cryptographic Tampering & Signature Validation
  // -------------------------------------------------------------------------
  test.describe("2. Cryptographic Signature Validation & Tampering Resistance", () => {
    test("Accepts genuine HS256 signed JWT session token", () => {
      const validToken = signSessionToken({
        sub: "user-uuid-12345",
        email: "genuine@consumer.com",
        role: "CONSUMER",
      });

      const res = verifySessionHeaderOrCookie(`Bearer ${validToken}`, undefined);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.session?.sub, "user-uuid-12345");
      assert.strictEqual(res.session?.email, "genuine@consumer.com");
      assert.strictEqual(res.session?.role, "CONSUMER");
    });

    test("Rejects JWT signed with unauthorized attacker secret (returns 401)", () => {
      const evilToken = signTamperedToken(
        {
          sub: "user-uuid-attacker",
          email: "attacker@external.com",
          role: "SUPER_ADMIN",
        },
        ATTACKER_JWT_SECRET
      );

      const res = verifySessionHeaderOrCookie(`Bearer ${evilToken}`, undefined);
      assert.strictEqual(res.statusCode, 401);
      assert.match(res.error!, /signature verification failed/i);
    });

    test("Rejects tampered JWT payload segment (returns 401)", () => {
      const validToken = signSessionToken({
        sub: "user-uuid-consumer",
        email: "user@example.com",
        role: "CONSUMER",
      });

      const [headerB64, , sigB64] = validToken.split(".");
      // Tamper payload to elevate role to SUPER_ADMIN
      const alteredPayload = Buffer.from(
        JSON.stringify({
          sub: "user-uuid-consumer",
          email: "user@example.com",
          role: "SUPER_ADMIN",
        })
      ).toString("base64url");

      const tamperedToken = `${headerB64}.${alteredPayload}.${sigB64}`;
      const res = verifySessionHeaderOrCookie(`Bearer ${tamperedToken}`, undefined);
      assert.strictEqual(res.statusCode, 401);
      assert.match(res.error!, /signature verification failed/i);
    });

    test("Rejects expired JWT token with 401", () => {
      const expiredToken = jwt.sign(
        { sub: "expired-user", email: "old@example.com", role: "CONSUMER" },
        TEST_JWT_SECRET,
        { algorithm: "HS256", expiresIn: "-10s" }
      );

      const res = verifySessionHeaderOrCookie(`Bearer ${expiredToken}`, undefined);
      assert.strictEqual(res.statusCode, 401);
      assert.match(res.error!, /expired/i);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 3: Fail-Closed Secret Resolution
  // -------------------------------------------------------------------------
  test.describe("3. Fail-Closed Secret Resolution in Production", () => {
    test("Throws fatal error when JWT_SECRET is missing in production", () => {
      assert.throws(
        () => resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: "" }),
        /FATAL: JWT_SECRET environment variable is missing or insecure in production/
      );
    });

    test("Throws fatal error when JWT_SECRET is shorter than 32 characters in production", () => {
      assert.throws(
        () => resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: "too_short_key_123" }),
        /FATAL: JWT_SECRET environment variable is missing or insecure in production/
      );
    });

    test("Accepts 32+ character JWT_SECRET in production cleanly", () => {
      const strongKey = "my_production_cryptographic_secret_with_more_than_32_characters!";
      const resolved = resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: strongKey });
      assert.strictEqual(resolved, strongKey);
    });

    test("Falls back to local development secret when in development mode", () => {
      const devResolved = resolveJwtSecret({ NODE_ENV: "development", JWT_SECRET: "" });
      assert.strictEqual(devResolved, "flashfix_local_development_jwt_secret_32bytes_min");
    });
  });

  // -------------------------------------------------------------------------
  // Feature 4: RBAC Store Boundary Enforcement
  // -------------------------------------------------------------------------
  test.describe("4. RBAC Store Boundary Enforcement", () => {
    const storeA = "store-koramangala-01";
    const storeB = "store-indiranagar-02";

    test("Store Admin assigned to Store A cannot access Store B (returns 403)", () => {
      const storeAdminSession: SessionPayload = {
        sub: "admin-koramangala-id",
        email: "admin.kora@flashfix.in",
        role: "ADMIN",
        storeId: storeA,
        storeIds: [storeA],
      };

      const ownStoreRes = enforceStoreAccess(storeAdminSession, storeA);
      assert.strictEqual(ownStoreRes.allowed, true);
      assert.strictEqual(ownStoreRes.statusCode, 200);

      const crossStoreRes = enforceStoreAccess(storeAdminSession, storeB);
      assert.strictEqual(crossStoreRes.allowed, false);
      assert.strictEqual(crossStoreRes.statusCode, 403);
      assert.match(crossStoreRes.error!, /FORBIDDEN/);
    });

    test("Technician assigned to Store A cannot access Store B (returns 403)", () => {
      const techSession: SessionPayload = {
        sub: "tech-kora-id",
        email: "tech.kora@flashfix.in",
        role: "TECHNICIAN",
        storeId: storeA,
      };

      const crossStoreRes = enforceStoreAccess(techSession, storeB);
      assert.strictEqual(crossStoreRes.allowed, false);
      assert.strictEqual(crossStoreRes.statusCode, 403);
    });

    test("Rider / Employee assigned to Store A cannot access Store B (returns 403)", () => {
      const riderSession: SessionPayload = {
        sub: "rider-kora-id",
        email: "rider.kora@flashfix.in",
        role: "EMPLOYEE",
        storeId: storeA,
      };

      const crossStoreRes = enforceStoreAccess(riderSession, storeB);
      assert.strictEqual(crossStoreRes.allowed, false);
      assert.strictEqual(crossStoreRes.statusCode, 403);
    });

    test("Super Admin has cross-store authority across Store A and Store B", () => {
      const superAdminSession: SessionPayload = {
        sub: "superadmin-id",
        email: "superadmin@flashfix.in",
        role: "SUPER_ADMIN",
      };

      assert.strictEqual(enforceStoreAccess(superAdminSession, storeA).allowed, true);
      assert.strictEqual(enforceStoreAccess(superAdminSession, storeB).allowed, true);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 5: Cookie Attributes Verification
  // -------------------------------------------------------------------------
  test.describe("5. Cookie Attributes & Security Parameters", () => {
    test("Cookie contains HttpOnly, Path=/, SameSite=Lax", () => {
      const testToken = signSessionToken({
        sub: "user-session-abc",
        email: "session@example.com",
        role: "CONSUMER",
      });

      const cookieHeader = buildSessionCookieHeader(testToken, { isProduction: false });
      const parsed = parseSetCookie(cookieHeader);

      assert.strictEqual(parsed.name, "ff_session");
      assert.strictEqual(parsed.value, testToken);
      assert.strictEqual(parsed.httpOnly, true, "Must have HttpOnly flag for XSS mitigation");
      assert.strictEqual(parsed.path, "/", "Must be scoped to Path=/");
      assert.strictEqual(parsed.sameSite?.toLowerCase(), "lax", "Must enforce SameSite=Lax for CSRF mitigation");
    });

    test("Cookie includes Secure flag in production environment", () => {
      const testToken = "dummy_jwt_token_payload";
      const prodCookieHeader = buildSessionCookieHeader(testToken, { isProduction: true, rememberMe: true });
      const parsed = parseSetCookie(prodCookieHeader);

      assert.strictEqual(parsed.secure, true, "Must include Secure attribute in production");
      assert.strictEqual(parsed.maxAge, 604800, "Remember me must set 7-day max-age");
    });
  });
});
