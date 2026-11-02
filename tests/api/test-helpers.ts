/**
 * Shared API & Security Test Utilities for Flashfix v2
 * Provides session token generators, tampered signature builders, mock HTTP runners,
 * cookie attribute parsers, and state machine verification fixtures.
 */

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const TEST_JWT_SECRET = "flashfix_super_secure_test_key_minimum_32_characters_long_123456";
export const ATTACKER_JWT_SECRET = "attacker_evil_unauthorized_key_minimum_32_chars_long_654321";

export type UserRole = "CONSUMER" | "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN" | "TECHNICIAN";

export interface SessionPayload {
  sub: string;
  email: string;
  role: UserRole;
  storeId?: string | null;
  storeIds?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Creates a valid, cryptographically signed HS256 JWT session token.
 */
export function signSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
  secret: string = TEST_JWT_SECRET,
  expiresIn: string = "7d"
): string {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn,
  });
}

/**
 * Creates a tampered JWT token (e.g. payload modified after signing or signed with evil key).
 */
export function signTamperedToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
  attackerSecret: string = ATTACKER_JWT_SECRET
): string {
  return jwt.sign(payload, attackerSecret, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
}

/**
 * Simulates legacy, unsigned, forgeable token patterns from v1 that must be rejected with 401.
 */
export function createForgedLegacyToken(
  type: "ff_jwt_" | "ff_staff_" | "mock_ff_token_" | "local-dev-jwt-",
  payload: Record<string, any>
): string {
  if (type === "mock_ff_token_") {
    return `mock_ff_token_${Date.now()}`;
  }
  if (type === "local-dev-jwt-") {
    return `local-dev-jwt-${Date.now()}`;
  }
  return type + Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Parses Set-Cookie header strings into structured cookie attribute records.
 */
export interface ParsedCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite?: string;
  path?: string;
  secure: boolean;
  maxAge?: number;
  expires?: string;
  raw: string;
}

export function parseSetCookie(headerValue: string): ParsedCookie {
  const parts = headerValue.split(";").map((p) => p.trim());
  const [nameValue, ...attrParts] = parts;
  const equalsIndex = nameValue.indexOf("=");
  const name = equalsIndex > -1 ? nameValue.slice(0, equalsIndex) : nameValue;
  const value = equalsIndex > -1 ? nameValue.slice(equalsIndex + 1) : "";

  const cookie: ParsedCookie = {
    name,
    value,
    httpOnly: false,
    secure: false,
    raw: headerValue,
  };

  for (const part of attrParts) {
    const [attrKey, attrVal] = part.split("=").map((p) => p.trim());
    const lowerKey = attrKey.toLowerCase();
    if (lowerKey === "httponly") {
      cookie.httpOnly = true;
    } else if (lowerKey === "secure") {
      cookie.secure = true;
    } else if (lowerKey === "path") {
      cookie.path = attrVal || "/";
    } else if (lowerKey === "samesite") {
      cookie.sameSite = attrVal;
    } else if (lowerKey === "max-age") {
      cookie.maxAge = parseInt(attrVal, 10);
    } else if (lowerKey === "expires") {
      cookie.expires = attrVal;
    }
  }

  return cookie;
}

/**
 * Mock Request object conforming to Vercel/Node Serverless handler conventions.
 */
export interface MockRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
}

export class MockServerlessRequest {
  public method: string;
  public url: string;
  public headers: Record<string, string>;
  public body: any;
  public query: Record<string, string | string[]>;
  public cookies: Record<string, string>;

  constructor(options: MockRequestOptions = {}) {
    this.method = (options.method || "GET").toUpperCase();
    this.url = options.url || "/";
    this.headers = {};
    for (const [k, v] of Object.entries(options.headers || {})) {
      this.headers[k.toLowerCase()] = v;
    }
    this.body = options.body ?? null;
    this.query = options.query || {};
    this.cookies = options.cookies || {};

    if (options.cookies && !this.headers["cookie"]) {
      this.headers["cookie"] = Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }
  }
}

/**
 * Mock Response object capturing status code, headers, and json/text payload.
 */
export class MockServerlessResponse {
  public statusCode: number = 200;
  public headers: Record<string, string | string[]> = {};
  public body: any = null;
  public ended: boolean = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string | string[]) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()];
  }

  json(data: any) {
    this.body = data;
    this.ended = true;
    return this;
  }

  send(data: any) {
    this.body = data;
    this.ended = true;
    return this;
  }

  end() {
    this.ended = true;
    return this;
  }
}

/**
 * Dynamic RFC 4226 HMAC OTP derivation bound to booking ID, purpose, and row UUID.
 */
export function deriveHmacOtp(
  secret: string,
  bookingId: string,
  purpose: "PICKUP" | "CUSTODY",
  rowId: string
): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${bookingId}:${purpose}:${rowId}`);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, "0");
}
