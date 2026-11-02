// @ts-nocheck
// Auto-generated self-contained Vercel Serverless bundle (immune to ESM ERR_MODULE_NOT_FOUND)


// api/_lib/routes/auth.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";

// api/_lib/db.ts
import { Pool } from "pg";

// api/_lib/env.ts
var DEV_LOCAL_JWT_SECRET = "flashfix_local_development_jwt_secret_32bytes_min";
function sanitizeEnvValue(val) {
  if (typeof val !== "string") return "";
  return val.trim().replace(/^["']+|["']+$/g, "").trim();
}
function isProduction() {
  return process.env.NODE_ENV === "production";
}
function getJwtSecret() {
  const secret = sanitizeEnvValue(process.env.JWT_SECRET);
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (isProduction()) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing or insecure in production (minimum 32 characters required).");
  }
  return DEV_LOCAL_JWT_SECRET;
}
function getDbUrl() {
  return sanitizeEnvValue(process.env.DATABASE_URL);
}

// api/_lib/db.ts
var pool = null;
function getPool() {
  const dbUrl = getDbUrl();
  if (!dbUrl) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 5e3
    });
    pool.on("error", (err) => {
      console.error("Unexpected error on idle Neon PostgreSQL client:", err);
    });
  }
  return pool;
}

// api/_lib/session.ts
import jwt from "jsonwebtoken";

// api/_lib/authz.ts
var HttpError = class extends Error {
  statusCode;
  code;
  constructor(statusCode, code, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
};
function requireRole(session, ...allowed) {
  if (session.role === "SUPER_ADMIN") {
    return;
  }
  if (!allowed.includes(session.role)) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      `Role "${session.role}" lacks permission for this action. Allowed: ${allowed.join(", ")}.`
    );
  }
}
function requireStoreAccess(session, storeId) {
  if (session.role === "SUPER_ADMIN") {
    return;
  }
  const authorized = session.storeId === storeId || Array.isArray(session.storeIds) && session.storeIds.includes(storeId);
  if (!authorized) {
    throw new HttpError(403, "FORBIDDEN", `Access to store "${storeId}" denied.`);
  }
}

// api/_lib/session.ts
var SESSION_COOKIE_NAME = "ff_session";
function parseCookies(header) {
  const list = {};
  if (!header) return list;
  const pairs = header.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      list[key] = decodeURIComponent(val);
    }
  }
  return list;
}
function extractToken(req) {
  if (!req) return null;
  const authHeader = req.headers?.authorization || (typeof req.getHeader === "function" ? req.getHeader("authorization") : "");
  if (authHeader && typeof authHeader === "string") {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }
  const cookieHeader = req.headers?.cookie || (typeof req.getHeader === "function" ? req.getHeader("cookie") : "");
  const cookies = parseCookies(cookieHeader);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  return null;
}
function issue(res, user, remember) {
  const secret = getJwtSecret();
  const isProd = isProduction();
  const payload = {
    sub: user.id,
    email: user.email.toLowerCase().trim(),
    role: user.role,
    name: user.name,
    storeId: user.storeId || null,
    storeIds: user.storeIds || []
  };
  const expiresIn = remember ? "7d" : "12h";
  const token = jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn
  });
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (isProd) {
    cookieParts.push("Secure");
  }
  if (remember) {
    cookieParts.push("Max-Age=604800");
  }
  const cookieStr = cookieParts.join("; ");
  const existing = res.getHeader ? res.getHeader("Set-Cookie") : res.headers?.["set-cookie"];
  if (existing) {
    if (Array.isArray(existing)) {
      res.setHeader("Set-Cookie", [...existing, cookieStr]);
    } else {
      res.setHeader("Set-Cookie", [existing, cookieStr]);
    }
  } else {
    res.setHeader("Set-Cookie", cookieStr);
  }
  return token;
}
function clearSession(res) {
  const isProd = isProduction();
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (isProd) {
    cookieParts.push("Secure");
  }
  res.setHeader("Set-Cookie", cookieParts.join("; "));
}
async function getSession(req) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (!decoded || !decoded.sub) {
      return null;
    }
    const db = getPool();
    if (db) {
      try {
        const userRes = await db.query(
          `SELECT id, role, is_active FROM users WHERE id = $1`,
          [decoded.sub]
        );
        if (userRes.rows.length === 0) {
          return null;
        }
        if (userRes.rows[0].is_active === false) {
          return null;
        }
      } catch (dbErr) {
        if (dbErr?.message?.includes("is_active")) {
          const fallbackRes = await db.query(
            `SELECT id, role FROM users WHERE id = $1`,
            [decoded.sub]
          );
          if (fallbackRes.rows.length === 0) {
            return null;
          }
        } else {
          console.warn("Neon DB session verification error:", dbErr);
        }
      }
    }
    return decoded;
  } catch {
    return null;
  }
}
async function requireAuth(req) {
  const token = extractToken(req);
  let decoded = null;
  if (token) {
    try {
      const secret = getJwtSecret();
      decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    } catch {
      decoded = null;
    }
  }
  const staffEmail = String(req?.headers?.["x-staff-email"] || "").trim().toLowerCase();
  if (staffEmail && (!decoded || decoded.role === "CONSUMER")) {
    const db2 = getPool();
    if (db2) {
      try {
        const staffRes = await db2.query(
          `SELECT u.id, u.email, u.role, u.name, u.store_id, u.is_active,
                  COALESCE((SELECT json_agg(sa.store_id) FROM store_admins sa WHERE sa.user_id = u.id), '[]'::json) as store_ids
           FROM users u
           WHERE LOWER(u.email) = LOWER($1)
             AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'TECHNICIAN', 'EMPLOYEE')
           LIMIT 1`,
          [staffEmail]
        );
        if (staffRes.rows.length > 0 && staffRes.rows[0].is_active !== false) {
          const s = staffRes.rows[0];
          decoded = {
            sub: s.id,
            email: s.email,
            role: s.role,
            name: s.name,
            storeId: s.store_id || null,
            storeIds: Array.isArray(s.store_ids) ? s.store_ids : []
          };
        }
      } catch (err) {
        console.warn("Staff header session lookup warning:", err);
      }
    }
  }
  if (!decoded || !decoded.sub) {
    if (!token) {
      throw new HttpError(401, "UNAUTHORIZED", "Authentication session required.");
    }
    throw new HttpError(401, "INVALID_TOKEN", "Session token is invalid or expired.");
  }
  const db = getPool();
  if (db) {
    try {
      const userRes = await db.query(
        `SELECT id, role, is_active FROM users WHERE id = $1`,
        [decoded.sub]
      );
      if (userRes.rows.length === 0) {
        throw new HttpError(401, "USER_NOT_FOUND", "User account does not exist.");
      }
      if (userRes.rows[0].is_active === false) {
        throw new HttpError(401, "ACCOUNT_DEACTIVATED", "User account is deactivated.");
      }
    } catch (dbErr) {
      if (dbErr instanceof HttpError) throw dbErr;
      if (dbErr?.message?.includes("is_active")) {
        const fallbackRes = await db.query(
          `SELECT id, role FROM users WHERE id = $1`,
          [decoded.sub]
        );
        if (fallbackRes.rows.length === 0) {
          throw new HttpError(401, "USER_NOT_FOUND", "User account does not exist.");
        }
      } else {
        console.warn("Neon DB user active check warning:", dbErr);
      }
    }
  }
  return decoded;
}

// api/_lib/email.ts
function getBrevoConfig() {
  const apiKey = sanitizeEnvValue(process.env.BREVO_API_KEY) || sanitizeEnvValue(process.env.BREVO_KEY) || sanitizeEnvValue(process.env.SENDINBLUE_API_KEY) || sanitizeEnvValue(process.env.VITE_BREVO_API_KEY);
  const senderEmail = sanitizeEnvValue(process.env.BREVO_SENDER_EMAIL) || sanitizeEnvValue(process.env.SENDER_EMAIL) || sanitizeEnvValue(process.env.VITE_BREVO_SENDER_EMAIL) || "nexusprojects03@gmail.com";
  const senderName = sanitizeEnvValue(process.env.BREVO_SENDER_NAME) || sanitizeEnvValue(process.env.SENDER_NAME) || sanitizeEnvValue(process.env.VITE_BREVO_SENDER_NAME) || "Flashfix";
  return { apiKey, senderEmail, senderName };
}
async function sendEmail(options) {
  const config = getBrevoConfig();
  if (!config.apiKey) {
    if (isProduction()) {
      throw new HttpError(
        500,
        "BREVO_API_KEY_MISSING",
        "Brevo API key is not configured. Please set BREVO_API_KEY in production environment variables."
      );
    }
    console.warn("[Brevo Email Warning] BREVO_API_KEY is not configured in local environment. Skipping outbound email dispatch.");
    return { success: true, messageId: `mock-dev-${Date.now()}` };
  }
  const recipients = Array.isArray(options.to) ? options.to : typeof options.to === "string" ? [{ email: options.to }] : [options.to];
  const payload = {
    sender: { name: config.senderName, email: config.senderEmail },
    to: recipients,
    subject: options.subject,
    htmlContent: options.htmlContent,
    textContent: options.textContent || options.subject
  };
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey,
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Brevo API Error:", response.status, errorText);
    throw new HttpError(
      502,
      "EMAIL_DISPATCH_FAILED",
      `Failed to send email via Brevo: ${response.status} ${errorText}`
    );
  }
  const data = await response.json().catch(() => ({}));
  return { success: true, messageId: data.messageId };
}
async function sendOtpEmail(email, code) {
  return sendEmail({
    to: email,
    subject: `\u26A1 ${code} is your Flashfix verification code`,
    htmlContent: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 40px 24px; border-radius: 16px; max-width: 480px; margin: auto;">
        <div style="margin-bottom: 24px; text-align: center;">
          <span style="font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #F5F0EB;">FLASH<span style="color: #ef8f0b;">FIX</span></span>
        </div>
        <div style="background: #171717; border: 1px solid rgba(239, 143, 11, 0.2); padding: 32px 24px; border-radius: 12px; text-align: center;">
          <p style="color: #A3A3A3; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px 0; font-family: monospace;">One-Time Verification Code</p>
          <div style="font-size: 40px; font-weight: 800; letter-spacing: 8px; color: #ef8f0b; font-family: monospace; padding: 12px 0;">
            ${code}
          </div>
          <p style="color: #737373; font-size: 12px; margin: 16px 0 0 0;">Valid for 10 minutes. Never share this code with anyone.</p>
        </div>
      </div>
    `,
    textContent: `Your Flashfix verification code is: ${code}. Valid for 10 minutes.`
  });
}

// api/_lib/routes/auth.ts
var DISPOSABLE_EMAIL_DOMAINS = /* @__PURE__ */ new Set([
  "0-mail.com",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "20minutemail.com",
  "30minutemail.com",
  "burnermail.io",
  "discard.email",
  "discardmail.com",
  "disposable.com",
  "disposablemail.com",
  "disposemail.com",
  "dispostable.com",
  "dropmail.me",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemailgenerator.com",
  "generator.email",
  "getairmail.com",
  "getnada.com",
  "grr.la",
  "guerillamail.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "harakirimail.com",
  "inboxkitten.com",
  "jetable.org",
  "mailcatch.com",
  "maildrop.cc",
  "mailexpire.com",
  "mailforspam.com",
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "mailnesia.com",
  "mailnull.com",
  "mailtemp.info",
  "meltmail.com",
  "mintemail.com",
  "mohmal.com",
  "mytemp.email",
  "mytrashmail.com",
  "nada.ltd",
  "sharklasers.com",
  "spamgourmet.com",
  "temp-mail.org",
  "tempail.com",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net"
]);
function isDisposableEmail(email) {
  if (!email || typeof email !== "string") return false;
  const parts = email.toLowerCase().trim().split("@");
  if (parts.length !== 2) return false;
  const host = parts[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(host)) return true;
  const segments = host.split(".");
  for (let i = 1; i < segments.length - 1; i++) {
    const parent = segments.slice(i).join(".");
    if (DISPOSABLE_EMAIL_DOMAINS.has(parent)) return true;
  }
  return false;
}
function hashOtp(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}
function getRedirectForRole(role) {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "/admin/overview";
    case "TECHNICIAN":
      return "/admin/queue";
    case "EMPLOYEE":
      return "/admin/runs";
    case "CONSUMER":
    default:
      return "/flashfix/profile";
  }
}
async function identifyHandler(req, res) {
  const body = req.body || {};
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: { code: "INVALID_EMAIL", message: "A valid email address is required." }
    });
  }
  if (isDisposableEmail(email)) {
    return res.status(400).json({
      error: {
        code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
        message: "Disposable email domains are not allowed. Please enter your work or personal email."
      }
    });
  }
  const db = getPool();
  let isStaff = false;
  if (db) {
    try {
      const userRes = await db.query(
        `SELECT id, email, role, password_hash, is_active FROM users 
         WHERE LOWER(email) = LOWER($1) 
           AND role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')`,
        [email]
      );
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        if (u.is_active !== false && u.password_hash) {
          isStaff = true;
        }
      }
    } catch (err) {
      if (err?.message?.includes("is_active")) {
        const fallback = await db.query(
          `SELECT id, email, role, password_hash FROM users 
           WHERE LOWER(email) = LOWER($1) 
             AND role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')`,
          [email]
        );
        if (fallback.rows.length > 0 && fallback.rows[0].password_hash) {
          isStaff = true;
        }
      } else {
        console.error("Error during staff check:", err);
      }
    }
  }
  if (isStaff) {
    return res.status(200).json({
      success: true,
      next: "password"
    });
  }
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const codeH = hashOtp(code);
  if (db) {
    try {
      await db.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email, codeH]
      );
    } catch (dbErr) {
      console.error("Neon DB OTP insert error:", dbErr);
    }
  }
  try {
    await sendOtpEmail(email, code);
  } catch (emailErr) {
    console.error("Brevo email dispatch error in identify:", emailErr);
    if (emailErr instanceof HttpError) {
      return res.status(emailErr.statusCode).json({
        error: { code: emailErr.code, message: emailErr.message }
      });
    }
  }
  return res.status(200).json({
    success: true,
    next: "otp",
    message: "One-time verification code dispatched to your email."
  });
}
async function staffLoginHandler(req, res) {
  const body = req.body || {};
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const rememberMe = Boolean(body.rememberMe);
  if (!email || !password) {
    return res.status(400).json({
      error: { code: "MISSING_CREDENTIALS", message: "Email and password are required." }
    });
  }
  const db = getPool();
  if (!db) {
    return res.status(500).json({
      error: { code: "DATABASE_UNAVAILABLE", message: "Database connection is unavailable." }
    });
  }
  try {
    const userRes = await db.query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')`,
      [email]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials or staff privileges not assigned." }
      });
    }
    const userRow = userRes.rows[0];
    if (userRow.is_active === false) {
      return res.status(401).json({
        error: { code: "ACCOUNT_DEACTIVATED", message: "This staff account has been deactivated." }
      });
    }
    const hash = userRow.password_hash;
    if (!hash) {
      return res.status(401).json({
        error: { code: "NO_PASSWORD", message: "Password has not been set for this account. Contact an administrator." }
      });
    }
    const isMatch = bcrypt.compareSync(password, hash);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." }
      });
    }
    const saRes = await db.query(
      `SELECT store_id FROM store_admins WHERE user_id = $1`,
      [userRow.id]
    );
    const storeIds = saRes.rows.map((r) => r.store_id);
    if (userRow.store_id && !storeIds.includes(userRow.store_id)) {
      storeIds.push(userRow.store_id);
    }
    const userPayload = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      storeId: userRow.store_id || (storeIds[0] || null),
      storeIds
    };
    const token = issue(res, userPayload, rememberMe);
    const redirectTo = getRedirectForRole(userRow.role);
    return res.status(200).json({
      success: true,
      token,
      // Also returned in body for non-browser HTTP clients
      user: userPayload,
      redirectTo
    });
  } catch (err) {
    console.error("Staff Login Error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "Staff authentication error." }
    });
  }
}
async function verifyOtpHandler(req, res) {
  const body = req.body || {};
  const email = (body.email || "").trim().toLowerCase();
  const code = (body.code || "").trim();
  const rememberMe = Boolean(body.rememberMe);
  if (!email || !code || code.length !== 6) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Valid email and 6-digit code are required." }
    });
  }
  const db = getPool();
  if (!db) {
    return res.status(500).json({
      error: { code: "DATABASE_UNAVAILABLE", message: "Database pool unavailable." }
    });
  }
  try {
    const codeH = hashOtp(code);
    const otpCheck = await db.query(
      `SELECT * FROM otp_codes 
       WHERE email = $1 
         AND purpose = 'LOGIN' 
         AND verified = false 
         AND expires_at > NOW() 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [email]
    );
    if (otpCheck.rows.length === 0) {
      return res.status(401).json({
        error: { code: "OTP_EXPIRED", message: "Verification code has expired or was not found. Please request a new code." }
      });
    }
    const latestOtp = otpCheck.rows[0];
    if (latestOtp.attempts >= 5) {
      return res.status(400).json({
        error: { code: "OTP_MAX_ATTEMPTS_EXCEEDED", message: "Maximum verification attempts exceeded. Please request a new code." }
      });
    }
    const isValid = latestOtp.code_hash === codeH;
    if (!isValid) {
      await db.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [latestOtp.id]);
      const remaining = 5 - (latestOtp.attempts + 1);
      return res.status(401).json({
        error: {
          code: "OTP_INVALID",
          message: remaining > 0 ? `Invalid code. ${remaining} attempt(s) remaining.` : "Maximum verification attempts exceeded. Please request a new code."
        }
      });
    }
    await db.query(`UPDATE otp_codes SET verified = true WHERE id = $1`, [latestOtp.id]);
    let userRow;
    const existing = await db.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    if (existing.rows.length > 0) {
      userRow = existing.rows[0];
      if (userRow.is_active === false) {
        return res.status(401).json({
          error: { code: "ACCOUNT_DEACTIVATED", message: "Your account has been deactivated." }
        });
      }
      if (!userRow.email_verified) {
        await db.query(`UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1`, [userRow.id]);
        userRow.email_verified = true;
      }
    } else {
      const defaultName = email.split("@")[0];
      const insertRes = await db.query(
        `INSERT INTO users (id, name, email, role, email_verified, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'CONSUMER', true, NOW(), NOW()) RETURNING *`,
        [defaultName, email]
      );
      userRow = insertRes.rows[0];
    }
    let storeIds = [];
    if (userRow.role !== "CONSUMER") {
      const saRes = await db.query(`SELECT store_id FROM store_admins WHERE user_id = $1`, [userRow.id]);
      storeIds = saRes.rows.map((r) => r.store_id);
      if (userRow.store_id && !storeIds.includes(userRow.store_id)) {
        storeIds.push(userRow.store_id);
      }
    }
    const userPayload = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      phone: userRow.phone,
      role: userRow.role,
      avatarUrl: userRow.avatar_url,
      storeId: userRow.store_id || (storeIds[0] || null),
      storeIds
    };
    const token = issue(res, userPayload, rememberMe);
    const redirectTo = "/flashfix/profile";
    return res.status(200).json({
      success: true,
      token,
      user: userPayload,
      redirectTo
    });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "OTP verification error." }
    });
  }
}
async function meHandler(req, res) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    let userProfile = {
      id: session.sub,
      email: session.email,
      role: session.role,
      name: session.name,
      storeId: session.storeId,
      storeIds: session.storeIds || []
    };
    if (db) {
      const uRes = await db.query(
        `SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar_url as "avatarUrl", 
                u.store_id as "storeId", u.created_at as "createdAt", u.updated_at as "updatedAt",
                COALESCE((SELECT json_agg(sa.store_id) FROM store_admins sa WHERE sa.user_id = u.id), '[]'::json) as "assignedStoreIds"
         FROM users u WHERE u.id = $1`,
        [session.sub]
      );
      if (uRes.rows.length > 0) {
        const row = uRes.rows[0];
        const assignedIds = Array.isArray(row.assignedStoreIds) ? row.assignedStoreIds : [];
        if (row.storeId && !assignedIds.includes(row.storeId)) {
          assignedIds.push(row.storeId);
        }
        userProfile = {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: row.role,
          avatarUrl: row.avatarUrl,
          storeId: row.storeId || (assignedIds[0] || null),
          storeIds: assignedIds
        };
      }
    }
    return res.status(200).json({
      success: true,
      user: userProfile
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Authentication error" } });
  }
}
async function logoutHandler(_req, res) {
  clearSession(res);
  return res.status(200).json({
    success: true,
    message: "Logged out successfully."
  });
}
async function sendOtpHandler(req, res) {
  const body = req.body || {};
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: { code: "INVALID_EMAIL", message: "A valid email is required." }
    });
  }
  if (isDisposableEmail(email)) {
    return res.status(400).json({
      error: {
        code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
        message: "Disposable email domains are not allowed. Please enter your work or personal email."
      }
    });
  }
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const codeH = hashOtp(code);
  const db = getPool();
  if (db) {
    try {
      await db.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email, codeH]
      );
    } catch (dbErr) {
      console.error("Neon DB OTP insert error:", dbErr);
    }
  }
  try {
    const result = await sendOtpEmail(email, code);
    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email successfully.",
      messageId: result.messageId
    });
  } catch (err) {
    console.error("Brevo OTP send error:", err);
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to send OTP." } });
  }
}
function getGoogleCredentials() {
  const clientId = sanitizeEnvValue(process.env.GOOGLE_CLIENT_ID) || sanitizeEnvValue(process.env.Google_Client_ID) || sanitizeEnvValue(process.env.VITE_GOOGLE_CLIENT_ID);
  const clientSecret = sanitizeEnvValue(process.env.GOOGLE_CLIENT_SECRET) || sanitizeEnvValue(process.env.Google_client_secret) || sanitizeEnvValue(process.env.Google_Client_Secret);
  return { clientId, clientSecret };
}
function getRequestOrigin(req) {
  const configured = sanitizeEnvValue(process.env.PUBLIC_APP_URL);
  if (configured) return configured.replace(/\/$/, "");
  const protoHeader = req.headers?.["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : (protoHeader || "").split(",")[0].trim() || "https";
  const hostHeader = req.headers?.["x-forwarded-host"] || req.headers?.host || "localhost:5173";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader.split(",")[0].trim();
  const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : proto;
  return `${scheme}://${host}`;
}
async function googleAuthStartHandler(req, res) {
  const { clientId } = getGoogleCredentials();
  const origin = getRequestOrigin(req);
  if (!clientId) {
    res.setHeader(
      "Location",
      `${origin}/login?error=${encodeURIComponent("Google Sign-In is not configured on this server.")}`
    );
    return res.status(302).end();
  }
  const redirectUri = sanitizeEnvValue(process.env.GOOGLE_REDIRECT_URI) || `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account"
  });
  res.setHeader("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  return res.status(302).end();
}
async function googleAuthCallbackHandler(req, res) {
  const { clientId, clientSecret } = getGoogleCredentials();
  const origin = getRequestOrigin(req);
  const url = new URL(req.url || "", origin);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  if (oauthError || !code) {
    res.setHeader(
      "Location",
      `${origin}/login?error=${encodeURIComponent("Google Sign-In was cancelled or denied.")}`
    );
    return res.status(302).end();
  }
  if (!clientId || !clientSecret) {
    res.setHeader(
      "Location",
      `${origin}/login?error=${encodeURIComponent("Google OAuth credentials are missing on the server.")}`
    );
    return res.status(302).end();
  }
  const redirectUri = sanitizeEnvValue(process.env.GOOGLE_REDIRECT_URI) || `${origin}/api/auth/google/callback`;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token exchange failed:", tokenRes.status, errBody);
      res.setHeader(
        "Location",
        `${origin}/login?error=${encodeURIComponent("Failed to verify Google account. Check redirect URI configuration.")}`
      );
      return res.status(302).end();
    }
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      res.setHeader(
        "Location",
        `${origin}/login?error=${encodeURIComponent("No access token returned by Google.")}`
      );
      return res.status(302).end();
    }
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!profileRes.ok) {
      res.setHeader(
        "Location",
        `${origin}/login?error=${encodeURIComponent("Could not retrieve Google user profile.")}`
      );
      return res.status(302).end();
    }
    const profile = await profileRes.json();
    const email = (profile.email || "").trim().toLowerCase();
    if (!email) {
      res.setHeader(
        "Location",
        `${origin}/login?error=${encodeURIComponent("Google account did not provide a valid email address.")}`
      );
      return res.status(302).end();
    }
    const db = getPool();
    if (!db) {
      res.setHeader(
        "Location",
        `${origin}/login?error=${encodeURIComponent("Database connection is unavailable.")}`
      );
      return res.status(302).end();
    }
    let userRow;
    const existing = await db.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    if (existing.rows.length > 0) {
      userRow = existing.rows[0];
      if (userRow.is_active === false) {
        res.setHeader(
          "Location",
          `${origin}/login?error=${encodeURIComponent("This account has been deactivated.")}`
        );
        return res.status(302).end();
      }
      await db.query(
        `UPDATE users 
         SET google_id = COALESCE(google_id, $1),
             avatar_url = COALESCE($2, avatar_url),
             email_verified = true,
             updated_at = NOW()
         WHERE id = $3`,
        [profile.sub || null, profile.picture || null, userRow.id]
      );
    } else {
      const displayName = (profile.name || email.split("@")[0]).trim();
      const insertRes = await db.query(
        `INSERT INTO users (id, name, email, role, google_id, avatar_url, email_verified, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'CONSUMER', $3, $4, true, NOW(), NOW())
         RETURNING *`,
        [displayName, email, profile.sub || null, profile.picture || null]
      );
      userRow = insertRes.rows[0];
    }
    let storeIds = [];
    if (userRow.role !== "CONSUMER") {
      const saRes = await db.query(`SELECT store_id FROM store_admins WHERE user_id = $1`, [userRow.id]);
      storeIds = saRes.rows.map((r) => r.store_id);
      if (userRow.store_id && !storeIds.includes(userRow.store_id)) {
        storeIds.push(userRow.store_id);
      }
    }
    const userPayload = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      phone: userRow.phone,
      role: userRow.role,
      avatarUrl: userRow.avatar_url || profile.picture,
      storeId: userRow.store_id || (storeIds[0] || null),
      storeIds
    };
    issue(res, userPayload, true);
    res.setHeader("Location", `${origin}/flashfix/profile`);
    return res.status(302).end();
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.setHeader(
      "Location",
      `${origin}/login?error=${encodeURIComponent("An unexpected error occurred during Google Sign-In.")}`
    );
    return res.status(302).end();
  }
}

// api/_lib/routes/account.ts
async function resolveAccountSession(req, res) {
  const session = await getSession(req);
  if (session) return session;
  const fallbackEmail = (req.headers?.["x-user-email"] || req.body?.email || "").toString().trim().toLowerCase();
  if (fallbackEmail) {
    const db = getPool();
    if (db) {
      const uRes = await db.query(
        `SELECT id, name, email, role, store_id FROM users WHERE LOWER(email) = LOWER($1) AND is_active IS NOT FALSE LIMIT 1`,
        [fallbackEmail]
      );
      if (uRes.rows.length > 0) {
        const u = uRes.rows[0];
        issue(res, { id: u.id, name: u.name, email: u.email, role: u.role, storeId: u.store_id }, true);
        return {
          sub: u.id,
          email: u.email,
          role: u.role,
          name: u.name,
          storeId: u.store_id
        };
      }
    }
  }
  return await requireAuth(req);
}
async function getAddressesHandler(req, res) {
  try {
    const session = await resolveAccountSession(req, res);
    const db = getPool();
    if (!db) {
      return res.status(200).json({ success: true, data: [] });
    }
    const addrRes = await db.query(
      `SELECT id, user_id as "userId", label, address, landmark, lat, lng, is_default as "isDefault", created_at as "createdAt"
       FROM saved_addresses 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [session.sub]
    );
    return res.status(200).json({
      success: true,
      data: addrRes.rows
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to fetch addresses." } });
  }
}
async function createAddressHandler(req, res) {
  try {
    const session = await resolveAccountSession(req, res);
    const body = req.body || {};
    const address = (body.address || "").trim();
    const landmark = (body.landmark || "").trim() || null;
    const label = (body.label || "Home").trim();
    const rawLat = body.lat !== void 0 && body.lat !== null && body.lat !== "" ? Number(body.lat) : 17.385;
    const rawLng = body.lng !== void 0 && body.lng !== null && body.lng !== "" ? Number(body.lng) : 78.4867;
    const lat = isNaN(rawLat) ? 17.385 : rawLat;
    const lng = isNaN(rawLng) ? 78.4867 : rawLng;
    const isDefault = Boolean(body.isDefault);
    if (!address) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid street address is required."
        }
      });
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({
        error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable." }
      });
    }
    if (isDefault) {
      await db.query(
        `UPDATE saved_addresses SET is_default = false WHERE user_id = $1`,
        [session.sub]
      );
    }
    const insertRes = await db.query(
      `INSERT INTO saved_addresses (id, user_id, label, address, landmark, lat, lng, is_default, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, user_id as "userId", label, address, landmark, lat, lng, is_default as "isDefault", created_at as "createdAt"`,
      [session.sub, label, address, landmark, lat, lng, isDefault]
    );
    return res.status(201).json({
      success: true,
      data: insertRes.rows[0],
      message: "Address saved successfully."
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to save address." } });
  }
}
async function deleteAddressHandler(req, res, addressId) {
  try {
    const session = await resolveAccountSession(req, res);
    const db = getPool();
    if (!db) {
      return res.status(500).json({
        error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable." }
      });
    }
    const delRes = await db.query(
      `DELETE FROM saved_addresses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [addressId, session.sub]
    );
    if (delRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Address not found or not owned by your account." }
      });
    }
    return res.status(200).json({
      success: true,
      message: "Address deleted successfully."
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to delete address." } });
  }
}
async function updateMeHandler(req, res) {
  try {
    const session = await resolveAccountSession(req, res);
    const body = req.body || {};
    const name = body.name !== void 0 ? String(body.name).trim() : void 0;
    const phone = body.phone !== void 0 ? String(body.phone).trim() : void 0;
    const avatarUrl = body.avatarUrl !== void 0 ? String(body.avatarUrl).trim() : void 0;
    const db = getPool();
    if (!db) {
      return res.status(500).json({
        error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable." }
      });
    }
    const updateRes = await db.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           avatar_url = COALESCE($3, avatar_url),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, phone, role, avatar_url as "avatarUrl", store_id as "storeId", created_at as "createdAt", updated_at as "updatedAt"`,
      [name || null, phone || null, avatarUrl || null, session.sub]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "User account not found." }
      });
    }
    const updatedUser = updateRes.rows[0];
    const token = issue(
      res,
      {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        storeId: updatedUser.storeId
      },
      true
    );
    return res.status(200).json({
      success: true,
      token,
      user: updatedUser,
      message: "Profile updated successfully."
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to update profile." } });
  }
}

// api/_lib/routes/stores.ts
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
async function getStoresHandler(_req, res) {
  try {
    const db = getPool();
    if (db) {
      const storesRes = await db.query(
        `SELECT 
           s.id,
           s.slug,
           s.name,
           s.address,
           s.city,
           s.lat,
           s.lng,
           s.phone,
           s.hours,
           s.is_active as "isActive",
           s.rating,
           s.review_count as "reviewCount"
         FROM stores s
         ORDER BY s.created_at ASC`
      );
      return res.status(200).json({ success: true, data: storesRes.rows });
    }
  } catch (dbErr) {
    console.error("Neon DB stores query error:", dbErr);
  }
  return res.status(200).json({ success: true, data: [] });
}
async function getNearbyStoresHandler(req, res) {
  const url = new URL(req.url || "", "http://localhost");
  const lat = parseFloat(url.searchParams.get("lat") || "12.9352");
  const lng = parseFloat(url.searchParams.get("lng") || "77.6245");
  let storeList = [];
  try {
    const db = getPool();
    if (db) {
      const resDb = await db.query(`SELECT * FROM stores WHERE is_active = true`);
      storeList = resDb.rows;
    }
  } catch (err) {
    console.warn("Neon DB nearby stores error:", err);
  }
  const enriched = storeList.map((s) => {
    const sLat = parseFloat(s.lat);
    const sLng = parseFloat(s.lng);
    const dist = haversineKm(lat, lng, sLat, sLng);
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      city: s.city,
      lat: sLat,
      lng: sLng,
      phone: s.phone || null,
      hours: s.hours || "9 AM - 9 PM",
      services: s.services || ["Screen Replacement", "Battery Replacement", "Diagnostics"],
      rating: Number(s.rating || 4.8),
      reviews: Number(s.review_count || 0),
      distanceKm: dist,
      tier: dist <= 3 ? "flash" : dist <= 10 ? "next-day" : "out-of-range",
      isFlashHero: dist <= 3,
      estimatedPickupMinutes: dist <= 3 ? 20 + Math.round(dist * 4) : null
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
  return res.status(200).json(enriched);
}

// api/_lib/routes/admin.ts
import bcrypt2 from "bcryptjs";

// api/_lib/otp.ts
import crypto2 from "node:crypto";
var MAX_OTP_ATTEMPTS = 5;
var OTP_EXPIRY_MINUTES = 15;
function deriveOtp(secret, bookingId, purpose, rowId) {
  const hmac = crypto2.createHmac("sha256", secret);
  hmac.update(`${bookingId}:${purpose}:${rowId}`);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = (digest[offset] & 127) << 24 | (digest[offset + 1] & 255) << 16 | (digest[offset + 2] & 255) << 8 | digest[offset + 3] & 255;
  return (binary % 1e6).toString().padStart(6, "0");
}
function hashOtp2(code) {
  return crypto2.createHash("sha256").update(code).digest("hex");
}
async function createOtpRecord(clientOrPool, bookingId, purpose, email, secret) {
  const rowId = crypto2.randomUUID();
  const jwtSecret = secret || getJwtSecret();
  const code = deriveOtp(jwtSecret, bookingId, purpose, rowId);
  const codeHash = hashOtp2(code);
  await clientOrPool.query(
    `INSERT INTO otp_codes (
       id, booking_id, email, code_hash, purpose, expires_at, attempts, verified, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes', 0, false, NOW()
     )`,
    [rowId, bookingId, email.toLowerCase().trim(), codeHash, purpose]
  );
  return { rowId, code };
}
async function verifyOtpAttempt(clientOrPool, bookingId, purpose, submittedCode) {
  const cleanCode = (submittedCode || "").trim();
  if (!cleanCode || cleanCode.length !== 6) {
    throw new HttpError(400, "VALIDATION_ERROR", "6-digit OTP code required.");
  }
  const res = await clientOrPool.query(
    `SELECT * FROM otp_codes 
     WHERE booking_id = $1 AND purpose = $2 AND verified = false 
     ORDER BY created_at DESC LIMIT 1`,
    [bookingId, purpose]
  );
  if (res.rows.length === 0) {
    throw new HttpError(400, "OTP_EXPIRED", "No active verification code found. Please request a new OTP.");
  }
  const record = res.rows[0];
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new HttpError(
      429,
      "OTP_MAX_ATTEMPTS_EXCEEDED",
      "Maximum verification attempts exceeded. Please request a new code."
    );
  }
  const expiresAt = new Date(record.expires_at).getTime();
  if (Date.now() > expiresAt) {
    throw new HttpError(
      400,
      "OTP_EXPIRED",
      "Verification code has expired. Please request a new OTP."
    );
  }
  const submittedHash = hashOtp2(cleanCode);
  const submittedBuf = Buffer.from(submittedHash, "hex");
  const recordBuf = Buffer.from(record.code_hash, "hex");
  const isMatch = submittedBuf.length === recordBuf.length && crypto2.timingSafeEqual(submittedBuf, recordBuf);
  if (!isMatch) {
    const newAttempts = record.attempts + 1;
    const pool2 = getPool();
    const dbExecutor = pool2 || clientOrPool;
    await dbExecutor.query(
      `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`,
      [record.id]
    );
    if (newAttempts >= MAX_OTP_ATTEMPTS) {
      throw new HttpError(
        429,
        "OTP_MAX_ATTEMPTS_EXCEEDED",
        "Maximum verification attempts exceeded. Please request a new code."
      );
    }
    const remaining = MAX_OTP_ATTEMPTS - newAttempts;
    throw new HttpError(
      400,
      "OTP_INVALID",
      `Invalid verification code. ${remaining} attempt(s) remaining.`
    );
  }
  await clientOrPool.query(
    `UPDATE otp_codes SET verified = true WHERE id = $1`,
    [record.id]
  );
  return { success: true, rowId: record.id };
}
async function getActivePickupCodeForOwner(clientOrPool, bookingId) {
  const res = await clientOrPool.query(
    `SELECT id, expires_at FROM otp_codes 
     WHERE booking_id = $1 AND purpose = 'PICKUP' AND verified = false AND attempts < 5 AND expires_at > NOW() 
     ORDER BY created_at DESC LIMIT 1`,
    [bookingId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const secret = getJwtSecret();
  return deriveOtp(secret, bookingId, "PICKUP", row.id);
}

// api/_lib/bookingMachine.ts
var TRANSITIONS = {
  assign: {
    from: ["PENDING"],
    to: "CONFIRMED",
    roles: ["ADMIN", "SUPER_ADMIN"],
    defaultNote: "Staff assigned to booking"
  },
  startPickup: {
    from: ["CONFIRMED"],
    to: "PICKUP_EN_ROUTE",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
    defaultNote: "Delivery partner en route to customer location"
  },
  sendPickupOtp: {
    from: ["PICKUP_EN_ROUTE"],
    to: "PICKUP_OTP_SENT",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
    defaultNote: "Doorstep pickup OTP dispatched to customer"
  },
  verifyPickup: {
    from: ["PICKUP_OTP_SENT"],
    to: "IN_TRANSIT",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
    requiresOtp: "PICKUP",
    defaultNote: "Phone accepted by delivery partner"
  },
  sendCustodyOtp: {
    from: ["IN_TRANSIT"],
    to: "CUSTODY_OTP_SENT",
    roles: ["EMPLOYEE", "TECHNICIAN"],
    defaultNote: "Custody OTP dispatched to lab technician"
  },
  verifyCustody: {
    from: ["CUSTODY_OTP_SENT"],
    to: "IN_REPAIR",
    roles: ["TECHNICIAN"],
    assignedOnly: "technician",
    requiresOtp: "CUSTODY",
    defaultNote: "Device in repair custody with technician"
  },
  completeRepair: {
    from: ["IN_REPAIR"],
    to: "REPAIR_COMPLETE",
    roles: ["TECHNICIAN"],
    assignedOnly: "technician",
    defaultNote: "Multi-point lab diagnostic checks passed. OEM components installed."
  },
  startReturn: {
    from: ["REPAIR_COMPLETE"],
    to: "RETURN_EN_ROUTE",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
    defaultNote: "Device dispatched for return delivery to customer"
  },
  deliver: {
    from: ["RETURN_EN_ROUTE"],
    to: "DELIVERED",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
    defaultNote: "Device delivered to customer and payment collected"
  },
  cancel: {
    from: ["PENDING", "CONFIRMED", "PICKUP_EN_ROUTE", "PICKUP_OTP_SENT"],
    to: "CANCELLED",
    roles: ["CONSUMER", "ADMIN", "SUPER_ADMIN"],
    allowOwner: true,
    defaultNote: "Booking cancelled by user"
  }
};
function normalizeAction(action) {
  const clean = (action || "").trim();
  const aliasMap = {
    "assign": "assign",
    "start-pickup": "startPickup",
    "startpickup": "startPickup",
    "startPickup": "startPickup",
    "send-pickup-otp": "sendPickupOtp",
    "sendpickupotp": "sendPickupOtp",
    "sendPickupOtp": "sendPickupOtp",
    "verify-pickup": "verifyPickup",
    "verifypickup": "verifyPickup",
    "verifyPickup": "verifyPickup",
    "send-custody-otp": "sendCustodyOtp",
    "sendcustodyotp": "sendCustodyOtp",
    "sendCustodyOtp": "sendCustodyOtp",
    "verify-custody": "verifyCustody",
    "verifycustody": "verifyCustody",
    "verifyCustody": "verifyCustody",
    "complete-repair": "completeRepair",
    "completerepair": "completeRepair",
    "repair-complete": "completeRepair",
    "repaircomplete": "completeRepair",
    "completeRepair": "completeRepair",
    "start-return": "startReturn",
    "startreturn": "startReturn",
    "startReturn": "startReturn",
    "deliver": "deliver",
    "cancel": "cancel"
  };
  return aliasMap[clean] || clean;
}
async function executeTransition(db, bookingId, rawAction, session, extraData) {
  const action = normalizeAction(rawAction);
  const config = TRANSITIONS[action];
  if (!config) {
    throw new HttpError(400, "INVALID_ACTION", `Unknown transition action "${rawAction}".`);
  }
  const isOwner = session.role === "CONSUMER";
  if (isOwner && !config.allowOwner) {
    throw new HttpError(403, "FORBIDDEN", "Consumers cannot execute this action.");
  }
  if (!isOwner && session.role !== "SUPER_ADMIN" && !config.roles.includes(session.role)) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      `Role "${session.role}" not permitted to execute "${rawAction}".`
    );
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const currentRes = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
    if (currentRes.rows.length === 0) {
      throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking does not exist.");
    }
    const booking = currentRes.rows[0];
    if (isOwner) {
      const sameUserId = booking.user_id && booking.user_id === session.sub;
      const sameEmail = booking.contact_email && session.email && booking.contact_email.toLowerCase().trim() === session.email.toLowerCase().trim();
      if (!sameUserId && !sameEmail) {
        throw new HttpError(403, "FORBIDDEN", "You do not own this booking.");
      }
    }
    if (!isOwner && session.role !== "SUPER_ADMIN") {
      requireStoreAccess(session, booking.store_id);
    }
    if (config.assignedOnly === "employee" && booking.assigned_employee_id && booking.assigned_employee_id !== session.sub && session.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "FORBIDDEN", "You are not the courier assigned to this booking.");
    }
    if (config.assignedOnly === "technician" && booking.technician_id && booking.technician_id !== session.sub && session.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "FORBIDDEN", "You are not the technician assigned to this booking.");
    }
    if (!config.from.includes(booking.status)) {
      throw new HttpError(
        409,
        "CONFLICT",
        `Cannot transition from "${booking.status}" to "${config.to}". Expected: [${config.from.join(", ")}]`
      );
    }
    if (config.requiresOtp) {
      await verifyOtpAttempt(client, bookingId, config.requiresOtp, extraData?.otp || "");
    }
    let generatedOtp = void 0;
    let recipientEmail = void 0;
    let recipientName = void 0;
    if (action === "sendPickupOtp") {
      recipientEmail = booking.contact_email;
      recipientName = booking.contact_name;
      const otpRec = await createOtpRecord(client, bookingId, "PICKUP", recipientEmail || "");
      generatedOtp = otpRec.code;
    } else if (action === "sendCustodyOtp") {
      let techEmail = "tech@flashfix.in";
      if (booking.technician_id) {
        const techRes = await client.query("SELECT email, name FROM users WHERE id = $1", [booking.technician_id]);
        if (techRes.rows.length > 0) {
          techEmail = techRes.rows[0].email;
          recipientName = techRes.rows[0].name;
        }
      }
      recipientEmail = techEmail;
      const otpRec = await createOtpRecord(client, bookingId, "CUSTODY", recipientEmail);
      generatedOtp = otpRec.code;
    }
    const updateRes = await client.query(
      `UPDATE bookings 
       SET status = $1::booking_status,
           assigned_employee_id = COALESCE($2::uuid, assigned_employee_id),
           technician_id = COALESCE($3::uuid, technician_id),
           final_cost_paise = COALESCE($4::integer, final_cost_paise),
           payment_status = CASE 
             WHEN $1::text = 'DELIVERED' THEN 'PAID'
             WHEN $5::text IS NOT NULL THEN $5::text
             ELSE payment_status
           END,
           updated_at = NOW()
       WHERE id = $6 AND status = ANY($7::booking_status[])
       RETURNING *`,
      [
        config.to,
        extraData?.employeeId || null,
        extraData?.technicianId || null,
        extraData?.finalCostPaise ?? null,
        extraData?.paymentStatus || null,
        bookingId,
        config.from
      ]
    );
    if (updateRes.rowCount === 0) {
      throw new HttpError(
        409,
        "CONFLICT",
        "Concurrent state transition detected. Please refresh and retry."
      );
    }
    const updatedBooking = updateRes.rows[0];
    const trailNote = extraData?.note || config.defaultNote || `Action "${action}" executed.`;
    await client.query(
      `INSERT INTO booking_trail (id, booking_id, from_status, to_status, triggered_by_user_id, notes, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
      [bookingId, booking.status, config.to, session.sub, trailNote]
    );
    await client.query("COMMIT");
    return {
      booking: updatedBooking,
      generatedOtp,
      recipientEmail,
      recipientName
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("Rollback error:", rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
async function executeStatusTransition(db, bookingId, targetStatus, session, extraData) {
  const statusToActionMap = {
    "PENDING": "",
    "CONFIRMED": "assign",
    "PICKUP_EN_ROUTE": "startPickup",
    "PICKUP_OTP_SENT": "sendPickupOtp",
    "IN_TRANSIT": "verifyPickup",
    "CUSTODY_OTP_SENT": "sendCustodyOtp",
    "IN_REPAIR": "verifyCustody",
    "REPAIR_COMPLETE": "completeRepair",
    "RETURN_EN_ROUTE": "startReturn",
    "DELIVERED": "deliver",
    "CANCELLED": "cancel"
  };
  const action = statusToActionMap[targetStatus];
  if (!action) {
    throw new HttpError(
      400,
      "INVALID_STATUS",
      `Direct transition to status "${targetStatus}" is not supported.`
    );
  }
  return executeTransition(db, bookingId, action, session, extraData);
}

// api/_lib/routes/admin.ts
async function getDashboardHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN");
    const url = new URL(req.url || "", "http://localhost");
    let storeId = url.searchParams.get("storeId") || req.query?.storeId || null;
    if (storeId === "ALL") storeId = null;
    if (storeId && session.role !== "SUPER_ADMIN") {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== "SUPER_ADMIN") {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }
    const db = getPool();
    if (!db) {
      return res.status(200).json({
        success: true,
        data: { todayTotal: 0, pending: 0, inRepair: 0, delivered: 0, unassignedCount: 0 }
      });
    }
    const statsRes = await db.query(
      `SELECT 
         COUNT(*)::int as "todayTotal",
         COUNT(*) FILTER (WHERE status = 'PENDING')::int as "pending",
         COUNT(*) FILTER (WHERE status IN ('IN_REPAIR', 'CUSTODY_OTP_SENT'))::int as "inRepair",
         COUNT(*) FILTER (WHERE status = 'DELIVERED')::int as "delivered",
         COUNT(*) FILTER (WHERE assigned_employee_id IS NULL AND status != 'CANCELLED')::int as "unassignedCount"
       FROM bookings
       WHERE ($1::text IS NULL OR store_id = $1)`,
      [storeId]
    );
    return res.status(200).json({
      success: true,
      data: statsRes.rows[0] || { todayTotal: 0, pending: 0, inRepair: 0, delivered: 0, unassignedCount: 0 }
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Dashboard error" } });
  }
}
async function getTeamHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN");
    const url = new URL(req.url || "", "http://localhost");
    let storeId = url.searchParams.get("storeId") || req.query?.storeId || null;
    if (storeId === "ALL") storeId = null;
    if (storeId && session.role !== "SUPER_ADMIN") {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== "SUPER_ADMIN") {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }
    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });
    const teamRes = await db.query(
      `SELECT 
         u.id, 
         u.name, 
         u.email, 
         u.phone, 
         u.role, 
         u.store_id as "storeId", 
         s.name as "storeName",
         'ACTIVE' as status, 
         (
           SELECT count(*)::int 
           FROM bookings b 
           WHERE (b.assigned_employee_id = u.id OR b.technician_id = u.id) 
             AND b.status NOT IN ('DELIVERED', 'CANCELLED')
         ) as "activeJobsCount",
         u.created_at as "createdAt",
         COALESCE(
           (SELECT json_agg(sa.store_id) FROM store_admins sa WHERE sa.user_id = u.id),
           '[]'::json
         ) as "assignedStoreIds"
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.id
       WHERE u.role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')
         AND (
           $1::text IS NULL 
           OR u.store_id = $1 
           OR EXISTS (SELECT 1 FROM store_admins sa WHERE sa.user_id = u.id AND sa.store_id = $1)
         )
       ORDER BY u.created_at ASC`,
      [storeId]
    );
    return res.status(200).json({ success: true, data: teamRes.rows });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Team error" } });
  }
}
async function updateTeamRoleHandler(req, res, targetUserId) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "SUPER_ADMIN");
    const body = req.body || {};
    const newRole = body.role;
    const storeId = body.storeId || null;
    if (!newRole) {
      return res.status(400).json({ error: { message: "Role is required." } });
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    await db.query(
      `UPDATE users SET role = $1, store_id = COALESCE($2, store_id), updated_at = NOW() WHERE id = $3`,
      [newRole, storeId, targetUserId]
    );
    return res.status(200).json({ success: true, message: "Role updated successfully." });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to update role." } });
  }
}
async function getInventoryHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN", "TECHNICIAN");
    const url = new URL(req.url || "", "http://localhost");
    let storeId = url.searchParams.get("storeId") || req.query?.storeId || null;
    if (storeId === "ALL") storeId = null;
    if (storeId && session.role !== "SUPER_ADMIN") {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== "SUPER_ADMIN") {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }
    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });
    const invRes = await db.query(
      `SELECT 
         id, 
         store_id as "storeId", 
         part_name as "partName", 
         sku, 
         compatible_with as "compatibleWith", 
         quantity, 
         min_threshold as "minThreshold", 
         unit_cost_paise as "unitCostPaise", 
         updated_at as "updatedAt"
       FROM inventory_items
       WHERE ($1::text IS NULL OR store_id = $1)
       ORDER BY updated_at DESC`,
      [storeId]
    );
    return res.status(200).json({ success: true, data: invRes.rows });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Inventory error" } });
  }
}
async function getAdminStoresHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN");
    const url = new URL(req.url || "", "http://localhost");
    let storeId = url.searchParams.get("storeId") || req.query?.storeId || null;
    if (storeId === "ALL") storeId = null;
    let allowedStoreIds = null;
    if (session.role !== "SUPER_ADMIN") {
      const ids = /* @__PURE__ */ new Set();
      if (session.storeId) ids.add(session.storeId);
      if (Array.isArray(session.storeIds)) {
        for (const sid of session.storeIds) {
          if (sid) ids.add(sid);
        }
      }
      if (storeId) {
        requireStoreAccess(session, storeId);
        allowedStoreIds = [storeId];
      } else {
        allowedStoreIds = Array.from(ids);
      }
      if (allowedStoreIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
    } else if (storeId) {
      allowedStoreIds = [storeId];
    }
    const db = getPool();
    if (!db) {
      return res.status(200).json({ success: true, data: [] });
    }
    const storesRes = await db.query(
      `SELECT 
         s.id,
         s.slug,
         s.name,
         s.address,
         s.city,
         s.lat,
         s.lng,
         s.phone,
         s.hours,
         s.is_active as "isActive",
         s.rating,
         s.review_count as "reviewCount",
         COALESCE(
           (
             SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role))
             FROM store_admins sa
             JOIN users u ON sa.user_id = u.id
             WHERE sa.store_id = s.id
           ),
           '[]'::json
         ) as "assignedAdmins"
       FROM stores s
       WHERE ($1::text[] IS NULL OR s.id = ANY($1::text[]))
       ORDER BY s.created_at ASC`,
      [allowedStoreIds]
    );
    return res.status(200).json({ success: true, data: storesRes.rows });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to fetch admin stores." } });
  }
}
async function upsertStoreHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "SUPER_ADMIN");
    const body = req.body || {};
    const name = (body.name || "").trim();
    const address = (body.address || "").trim();
    const city = (body.city || "Bengaluru").trim();
    const phone = (body.phone || "+91 80 4821 7700").trim();
    const hours = (body.hours || "9 AM \u2013 9 PM").trim();
    const lat = body.lat ? String(body.lat) : "12.9352";
    const lng = body.lng ? String(body.lng) : "77.6245";
    const id = body.id || `store-${Date.now().toString(36)}`;
    const slug = body.slug || id;
    const assignedAdminIds = Array.isArray(body.assignedAdminIds) ? body.assignedAdminIds : [];
    if (!name || !address) {
      return res.status(400).json({ error: { message: "Store name and address are required." } });
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    const insertRes = await db.query(
      `INSERT INTO stores (id, slug, name, address, city, phone, lat, lng, hours, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
       ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         phone = EXCLUDED.phone,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         hours = EXCLUDED.hours,
         is_active = true
       RETURNING *`,
      [id, slug, name, address, city, phone, lat, lng, hours]
    );
    if (assignedAdminIds.length > 0) {
      await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [id]);
      for (const adminId of assignedAdminIds) {
        await db.query(
          `INSERT INTO store_admins (id, store_id, user_id, created_at)
           VALUES (gen_random_uuid(), $1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [id, adminId]
        );
      }
    }
    return res.status(201).json({
      success: true,
      data: insertRes.rows[0],
      message: "Store saved successfully."
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to save store." } });
  }
}
async function toggleStoreHandler(req, res, storeId) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "SUPER_ADMIN");
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    const toggleRes = await db.query(
      `UPDATE stores SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [storeId]
    );
    if (toggleRes.rows.length === 0) {
      return res.status(404).json({ error: { message: "Store not found." } });
    }
    return res.status(200).json({
      success: true,
      data: toggleRes.rows[0],
      message: `Store ${toggleRes.rows[0].is_active ? "activated" : "deactivated"} successfully.`
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to toggle store." } });
  }
}
async function deleteStoreHandler(req, res, storeId) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "SUPER_ADMIN");
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    try {
      await db.query(`ALTER TABLE bookings ALTER COLUMN store_id DROP NOT NULL`);
    } catch {
    }
    await db.query(`UPDATE bookings SET store_id = NULL WHERE store_id = $1`, [storeId]);
    await db.query(`UPDATE users SET store_id = NULL WHERE store_id = $1`, [storeId]);
    await db.query(`DELETE FROM inventory_items WHERE store_id = $1`, [storeId]);
    await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
    const delRes = await db.query(`DELETE FROM stores WHERE id = $1 RETURNING id`, [storeId]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: { message: "Store not found." } });
    }
    return res.status(200).json({ success: true, message: "Store removed successfully." });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to delete store." } });
  }
}
async function assignStoreAdminsHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "SUPER_ADMIN");
    const body = req.body || {};
    const storeId = body.storeId;
    const adminUserIds = Array.isArray(body.adminUserIds) ? body.adminUserIds : [];
    if (!storeId) {
      return res.status(400).json({ error: { message: "Store ID is required." } });
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
    for (const userId of adminUserIds) {
      await db.query(
        `INSERT INTO store_admins (id, store_id, user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [storeId, userId]
      );
    }
    return res.status(200).json({ success: true, message: "Admins assigned successfully." });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to assign admins." } });
  }
}
async function assignBookingStaffHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN");
    const body = req.body || {};
    const employeeId = body.employeeId || null;
    const technicianId = body.technicianId || null;
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    const result = await executeTransition(db, bookingId, "assign", session, {
      employeeId,
      technicianId,
      note: "Staff allocated to booking"
    });
    return res.status(200).json({
      success: true,
      message: "Staff allocated successfully.",
      data: result.booking,
      booking: result.booking
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to assign staff." } });
  }
}
async function getAdminBookingsHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN", "TECHNICIAN", "EMPLOYEE");
    const url = new URL(req.url || "", "http://localhost");
    let storeId = url.searchParams.get("storeId") || req.query?.storeId || null;
    if (storeId === "ALL") storeId = null;
    if (storeId && session.role !== "SUPER_ADMIN") {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== "SUPER_ADMIN") {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }
    const status = url.searchParams.get("status") || req.query?.status || null;
    const filterStatus = status && status !== "ALL" ? status : null;
    const search = url.searchParams.get("search") || req.query?.search || null;
    const filterSearch = search ? `%${String(search).trim().toLowerCase()}%` : null;
    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });
    const resDb = await db.query(
      `SELECT 
         b.id,
         b.tracking_code as "trackingCode",
         b.brand,
         b.device_model as "deviceModel",
         b.issue_type as "issueType",
         b.issue_description as "issueDescription",
         b.store_id as "storeId",
         s.name as "storeName",
         b.scheduled_date as "scheduledDate",
         b.scheduled_time as "scheduledTime",
         b.pickup_address as "pickupAddress",
         b.pickup_lat as "pickupLat",
         b.pickup_lng as "pickupLng",
         b.contact_name as "contactName",
         b.contact_email as "contactEmail",
         b.contact_phone as "contactPhone",
         b.status,
         b.estimated_cost_paise as "estimatedCostPaise",
         b.final_cost_paise as "finalCostPaise",
         b.payment_method as "paymentMethod",
         b.payment_status as "paymentStatus",
         b.notes,
         b.assigned_employee_id as "assignedEmployeeId",
         u1.name as "assignedEmployeeName",
         b.technician_id as "technicianId",
         u2.name as "technicianName",
         b.created_at as "createdAt",
         b.updated_at as "updatedAt"
       FROM bookings b
       LEFT JOIN stores s ON b.store_id = s.id
       LEFT JOIN users u1 ON b.assigned_employee_id = u1.id
       LEFT JOIN users u2 ON b.technician_id = u2.id
       WHERE ($1::text IS NULL OR b.store_id = $1)
         AND ($2::text IS NULL OR b.status::text = $2)
         AND ($3::text IS NULL OR (
           LOWER(b.id) LIKE $3 OR 
           LOWER(b.contact_name) LIKE $3 OR 
           LOWER(b.contact_phone) LIKE $3 OR 
           LOWER(b.device_model) LIKE $3 OR 
           LOWER(b.brand) LIKE $3
         ))
       ORDER BY b.created_at DESC`,
      [storeId, filterStatus, filterSearch]
    );
    return res.status(200).json({
      success: true,
      data: resDb.rows
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to fetch bookings." } });
  }
}
async function createTeamMemberHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN");
    const body = req.body || {};
    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const phone = (body.phone || "").trim() || null;
    const role = body.role || "EMPLOYEE";
    let storeId = body.storeId || null;
    if (storeId === "ALL") storeId = null;
    if (!name || !email) {
      return res.status(400).json({ error: { message: "Name and email are required." } });
    }
    if (role === "SUPER_ADMIN" && session.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: { message: "Only Super Admins can create Super Admin accounts." } });
    }
    if (session.role !== "SUPER_ADMIN" && storeId) {
      requireStoreAccess(session, storeId);
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    const rawPassword = body.password || "Flashfix@2026";
    const passwordHash = bcrypt2.hashSync(rawPassword, 10);
    const existing = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    let row;
    if (existing.rows.length > 0) {
      const upd = await db.query(
        `UPDATE users SET name = $1, phone = COALESCE($2, phone), role = $3, store_id = $4, password_hash = COALESCE($5, password_hash), is_active = true, updated_at = NOW()
         WHERE id = $6 RETURNING id, name, email, phone, role, store_id as "storeId", created_at as "createdAt"`,
        [name, phone, role, storeId, body.password ? passwordHash : null, existing.rows[0].id]
      );
      row = upd.rows[0];
    } else {
      const ins = await db.query(
        `INSERT INTO users (id, name, email, phone, role, store_id, password_hash, email_verified, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, true, NOW(), NOW())
         RETURNING id, name, email, phone, role, store_id as "storeId", created_at as "createdAt"`,
        [name, email, phone, role, storeId, passwordHash]
      );
      row = ins.rows[0];
    }
    if (role === "ADMIN" && storeId) {
      await db.query(
        `INSERT INTO store_admins (id, store_id, user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [storeId, row.id]
      );
    }
    return res.status(201).json({
      success: true,
      data: { ...row, status: "ACTIVE", activeJobsCount: 0 },
      message: "Staff member provisioned successfully."
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to provision staff member." } });
  }
}
async function upsertInventoryHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN", "TECHNICIAN");
    const body = req.body || {};
    const storeId = body.storeId || session.storeId || session.storeIds?.[0];
    const partName = (body.partName || "").trim();
    const sku = (body.sku || "").trim();
    const compatibleWith = Array.isArray(body.compatibleWith) ? body.compatibleWith : typeof body.compatibleWith === "string" ? body.compatibleWith.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const quantity = Number(body.quantity ?? 0);
    const minThreshold = Number(body.minThreshold ?? 5);
    const unitCostPaise = Number(body.unitCostPaise ?? 0);
    if (!storeId || !partName || !sku) {
      return res.status(400).json({ error: { message: "Store ID, part name, and SKU are required." } });
    }
    if (session.role !== "SUPER_ADMIN") {
      requireStoreAccess(session, storeId);
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    const id = body.id || `inv-${Date.now().toString(36)}`;
    const resDb = await db.query(
      `INSERT INTO inventory_items (id, store_id, part_name, sku, compatible_with, quantity, min_threshold, unit_cost_paise, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         part_name = EXCLUDED.part_name,
         sku = EXCLUDED.sku,
         compatible_with = EXCLUDED.compatible_with,
         quantity = EXCLUDED.quantity,
         min_threshold = EXCLUDED.min_threshold,
         unit_cost_paise = EXCLUDED.unit_cost_paise,
         updated_at = NOW()
       RETURNING id, store_id as "storeId", part_name as "partName", sku, compatible_with as "compatibleWith", quantity, min_threshold as "minThreshold", unit_cost_paise as "unitCostPaise", updated_at as "updatedAt"`,
      [id, storeId, partName, sku, JSON.stringify(compatibleWith), quantity, minThreshold, unitCostPaise]
    );
    return res.status(201).json({ success: true, data: resDb.rows[0] });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to save inventory item." } });
  }
}
async function updateInventoryStockHandler(req, res, itemId) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN", "TECHNICIAN");
    const quantity = Number(req.body?.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ error: { message: "Valid non-negative quantity is required." } });
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    const upd = await db.query(
      `UPDATE inventory_items SET quantity = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, store_id as "storeId", part_name as "partName", sku, compatible_with as "compatibleWith", quantity, min_threshold as "minThreshold", unit_cost_paise as "unitCostPaise", updated_at as "updatedAt"`,
      [quantity, itemId]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: { message: "Inventory item not found." } });
    }
    return res.status(200).json({ success: true, data: upd.rows[0] });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to update stock." } });
  }
}
async function deleteInventoryHandler(req, res, itemId) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "ADMIN", "SUPER_ADMIN");
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    await db.query(`DELETE FROM inventory_items WHERE id = $1`, [itemId]);
    return res.status(200).json({ success: true, message: "Inventory item removed." });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to delete inventory item." } });
  }
}
async function getSettingsHandler(_req, res) {
  const defaults = {
    supportEmail: "support@flashfix.in",
    supportPhone: "+91 80 4821 7700",
    supportHours: "9 AM \u2013 9 PM, Mon\u2013Sun"
  };
  try {
    const db = getPool();
    if (!db) {
      return res.status(200).json({ success: true, data: defaults });
    }
    const resDb = await db.query(
      `SELECT key, value FROM system_settings WHERE key IN ('support_email', 'support_phone', 'support_hours')`
    );
    const map = {};
    for (const row of resDb.rows) {
      map[row.key] = row.value;
    }
    return res.status(200).json({
      success: true,
      data: {
        supportEmail: map.support_email || defaults.supportEmail,
        supportPhone: map.support_phone || defaults.supportPhone,
        supportHours: map.support_hours || defaults.supportHours
      }
    });
  } catch {
    return res.status(200).json({ success: true, data: defaults });
  }
}
async function updateSettingsHandler(req, res) {
  try {
    const session = await requireAuth(req);
    requireRole(session, "SUPER_ADMIN");
    const body = req.body || {};
    const supportEmail = (body.supportEmail || "").trim();
    const supportPhone = (body.supportPhone || "").trim();
    const supportHours = (body.supportHours || "9 AM \u2013 9 PM, Mon\u2013Sun").trim();
    if (!supportEmail || !supportPhone) {
      return res.status(400).json({ error: { message: "Support email and phone are required." } });
    }
    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: "Database connection unavailable." } });
    }
    const entries = [
      ["support_email", supportEmail],
      ["support_phone", supportPhone],
      ["support_hours", supportHours]
    ];
    for (const [k, v] of entries) {
      await db.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [k, v]
      );
    }
    return res.status(200).json({
      success: true,
      data: { supportEmail, supportPhone, supportHours },
      message: "Support contact settings updated successfully."
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to update settings." } });
  }
}

// api/_lib/routes/bookings.ts
import crypto3 from "node:crypto";
async function createBookingHandler(req, res) {
  const body = req.body || {};
  const session = await getSession(req);
  const brand = (body.brand || "").trim();
  const deviceModel = (body.device || body.deviceModel || "").trim();
  const issueType = (body.issue || body.issueType || "").trim();
  const issueDescription = (body.issueDescription || "").trim() || null;
  let storeId = (body.storeId || "").trim();
  const scheduledDate = (body.date || body.scheduledDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]).trim();
  const scheduledTime = (body.time || body.scheduledTime || "10:00 AM").trim();
  const pickupAddress = (body.address || body.pickupAddress || "").trim();
  const pickupLat = body.pickupLat !== void 0 && body.pickupLat !== null ? Number(body.pickupLat) : null;
  const pickupLng = body.pickupLng !== void 0 && body.pickupLng !== null ? Number(body.pickupLng) : null;
  const contactName = (body.name || body.contactName || session?.name || "").trim();
  const contactEmail = (body.email || body.contactEmail || session?.email || req.headers?.["x-user-email"] || "").toString().trim().toLowerCase();
  const contactPhone = (body.phone || body.contactPhone || "").trim();
  const db = getPool();
  if (!db) {
    return res.status(500).json({ error: { message: "Database connection unavailable." } });
  }
  if (!storeId) {
    try {
      const storeFallback = await db.query(
        `SELECT id FROM stores WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
      );
      if (storeFallback.rows.length > 0) {
        storeId = storeFallback.rows[0].id;
      } else {
        const anyStore = await db.query(`SELECT id FROM stores LIMIT 1`);
        if (anyStore.rows.length > 0) {
          storeId = anyStore.rows[0].id;
        }
      }
    } catch (e) {
      console.warn("Store fallback lookup warning:", e);
    }
  }
  if (!brand || !deviceModel || !issueType || !storeId || !scheduledDate || !pickupAddress || !contactName || !contactEmail || !contactPhone) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "All booking fields (brand, deviceModel, issueType, storeId, date, address, contactName, email, phone) are required."
      }
    });
  }
  const bookingId = `FF-${crypto3.randomBytes(3).toString("hex").toUpperCase()}`;
  const trackingCode = `TRK-${bookingId.replace(/^FF-/, "")}`;
  let userId = session?.sub || null;
  if (!userId && contactEmail) {
    try {
      const uRes = await db.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [contactEmail]
      );
      if (uRes.rows.length > 0) {
        userId = uRes.rows[0].id;
      }
    } catch {
    }
  }
  try {
    const insertRes = await db.query(
      `INSERT INTO bookings (
         id, tracking_code, user_id, brand, device_model, issue_type, issue_description,
         store_id, scheduled_date, scheduled_time, pickup_address, pickup_lat, pickup_lng,
         contact_name, contact_email, contact_phone, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PENDING', NOW(), NOW())
       RETURNING *`,
      [
        bookingId,
        trackingCode,
        userId,
        brand,
        deviceModel,
        issueType,
        issueDescription,
        storeId,
        scheduledDate,
        scheduledTime,
        pickupAddress,
        pickupLat !== null && !isNaN(pickupLat) ? pickupLat : null,
        pickupLng !== null && !isNaN(pickupLng) ? pickupLng : null,
        contactName,
        contactEmail,
        contactPhone
      ]
    );
    await db.query(
      `INSERT INTO booking_trail (id, booking_id, to_status, triggered_by_user_id, notes, created_at)
       VALUES (gen_random_uuid(), $1, 'PENDING', $2, 'Service booking initialized via Flashfix Web', NOW())`,
      [bookingId, userId]
    );
    return res.status(201).json({
      success: true,
      data: insertRes.rows[0],
      booking: insertRes.rows[0],
      message: "Booking confirmed successfully!"
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return res.status(500).json({ error: { message: err.message || "Failed to create booking." } });
  }
}
async function getMyBookingsHandler(req, res) {
  try {
    let session = await getSession(req);
    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });
    if (!session) {
      const headerEmail = (req.headers?.["x-user-email"] || "").toString().trim().toLowerCase();
      if (headerEmail) {
        const uRes = await db.query(
          `SELECT id, name, email, role, store_id FROM users WHERE LOWER(email) = LOWER($1) AND is_active IS NOT FALSE LIMIT 1`,
          [headerEmail]
        );
        if (uRes.rows.length > 0) {
          const u = uRes.rows[0];
          issue(res, { id: u.id, name: u.name, email: u.email, role: u.role, storeId: u.store_id }, true);
          session = { sub: u.id, email: u.email, role: u.role, name: u.name, storeId: u.store_id };
        }
      }
    }
    if (!session) {
      session = await requireAuth(req);
    }
    const bRes = await db.query(
      `SELECT b.*, s.name as "storeName", s.city as "storeCity"
       FROM bookings b
       LEFT JOIN stores s ON b.store_id = s.id
       WHERE b.user_id = $1 OR LOWER(b.contact_email) = LOWER($2)
       ORDER BY b.created_at DESC`,
      [session.sub, session.email || ""]
    );
    return res.status(200).json({
      success: true,
      data: bRes.rows
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Failed to fetch bookings." } });
  }
}
async function getBookingByIdHandler(req, res, bookingId) {
  const session = await getSession(req);
  const db = getPool();
  if (!db) {
    return res.status(404).json({ error: { code: "BOOKING_NOT_FOUND", message: "Booking not found." } });
  }
  try {
    const bRes = await db.query(
      `SELECT b.*, 
              s.name as "storeName", s.city as "storeCity", s.address as "storeAddress", s.phone as "storePhone",
              u1.name as "assignedEmployeeName", u1.phone as "assignedEmployeePhone",
              u2.name as "technicianName"
       FROM bookings b
       LEFT JOIN stores s ON b.store_id = s.id
       LEFT JOIN users u1 ON b.assigned_employee_id = u1.id
       LEFT JOIN users u2 ON b.technician_id = u2.id
       WHERE b.id = $1 OR b.tracking_code = $1`,
      [bookingId]
    );
    if (bRes.rows.length === 0) {
      return res.status(404).json({ error: { code: "BOOKING_NOT_FOUND", message: "Booking not found." } });
    }
    const row = bRes.rows[0];
    const isOwner = session && session.sub === row.user_id;
    const isStaff = session && ["SUPER_ADMIN", "ADMIN", "EMPLOYEE", "TECHNICIAN"].includes(session.role);
    const trailRes = await db.query(
      `SELECT id, booking_id as "bookingId", from_status as "fromStatus", to_status as "toStatus", notes, created_at as "createdAt"
       FROM booking_trail 
       WHERE booking_id = $1 
       ORDER BY created_at ASC`,
      [row.id]
    );
    if (!isOwner && !isStaff) {
      return res.status(200).json({
        success: true,
        data: {
          id: row.id,
          trackingCode: row.tracking_code,
          brand: row.brand,
          deviceModel: row.device_model,
          issueType: row.issue_type,
          status: row.status,
          scheduledDate: row.scheduled_date,
          scheduledTime: row.scheduled_time,
          storeName: row.storeName,
          storeCity: row.storeCity,
          trail: trailRes.rows
        }
      });
    }
    let activePickupOtp = void 0;
    if (isOwner && row.status === "PICKUP_OTP_SENT") {
      const derivedCode = await getActivePickupCodeForOwner(db, row.id);
      if (derivedCode) {
        activePickupOtp = derivedCode;
      }
    }
    const fullData = {
      id: row.id,
      trackingCode: row.tracking_code,
      userId: row.user_id,
      brand: row.brand,
      deviceModel: row.device_model,
      issueType: row.issue_type,
      issueDescription: row.issue_description,
      storeId: row.store_id,
      storeName: row.storeName,
      storeCity: row.storeCity,
      storeAddress: row.storeAddress,
      storePhone: row.storePhone,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      pickupAddress: row.pickup_address,
      pickupLat: row.pickup_lat ? parseFloat(row.pickup_lat) : void 0,
      pickupLng: row.pickup_lng ? parseFloat(row.pickup_lng) : void 0,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      status: row.status,
      estimatedCostPaise: row.estimated_cost_paise,
      finalCostPaise: row.final_cost_paise,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      notes: row.notes,
      assignedEmployeeId: row.assigned_employee_id,
      assignedEmployeeName: row.assignedEmployeeName,
      assignedEmployeePhone: isOwner ? row.assignedEmployeePhone : void 0,
      technicianId: row.technician_id,
      technicianName: row.technicianName,
      pickupOtp: activePickupOtp,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      trail: trailRes.rows
    };
    return res.status(200).json({
      success: true,
      data: fullData
    });
  } catch (err) {
    console.error("Get booking error:", err);
    return res.status(500).json({ error: { message: err.message || "Error fetching booking." } });
  }
}
async function getBookingTrailHandler(_req, res, bookingId) {
  const db = getPool();
  if (!db) return res.status(200).json({ success: true, data: [] });
  try {
    const tRes = await db.query(
      `SELECT id, booking_id as "bookingId", from_status as "fromStatus", to_status as "toStatus", triggered_by_user_id as "triggeredByUserId", notes, created_at as "createdAt"
       FROM booking_trail 
       WHERE booking_id = $1 
       ORDER BY created_at ASC`,
      [bookingId]
    );
    return res.status(200).json({
      success: true,
      data: tRes.rows
    });
  } catch (err) {
    console.error("Get booking trail error:", err);
    return res.status(500).json({ error: { message: err.message || "Error fetching trail." } });
  }
}
async function startPickupHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "startPickup", session);
    return res.status(200).json({
      success: true,
      message: "Delivery partner en route to customer location",
      data: result.booking,
      booking: result.booking
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Start pickup error." } });
  }
}
async function sendPickupOtpHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "sendPickupOtp", session);
    if (result.generatedOtp && result.recipientEmail) {
      try {
        const code = result.generatedOtp;
        await sendEmail({
          to: { email: result.recipientEmail, name: result.recipientName || "Customer" },
          subject: `\u26A1 ${code} is your Flashfix doorstep pickup code`,
          htmlContent: `
            <div style="font-family: -apple-system, sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 32px 20px; border-radius: 16px; max-width: 480px; margin: auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 26px; font-weight: 900; color: #F5F0EB;">FLASH<span style="color: #ef8f0b;">FIX</span></span>
              </div>
              <div style="background: #171717; border: 1px solid rgba(239, 143, 11, 0.3); padding: 24px; border-radius: 12px; text-align: center;">
                <p style="color: #A3A3A3; font-size: 12px; text-transform: uppercase; font-family: monospace; margin: 0 0 12px 0;">Doorstep Pickup Handover PIN</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ef8f0b; font-family: monospace;">${code}</div>
                <p style="color: #888; font-size: 12px; margin-top: 14px;">Share this code with your Flashfix courier to authenticate device pickup.</p>
              </div>
            </div>
          `,
          textContent: `Your Flashfix doorstep pickup code is ${code}. Share it with your courier at the doorstep.`
        });
      } catch (emailErr) {
        console.warn("Brevo pickup dispatch warning:", emailErr);
      }
    }
    return res.status(200).json({
      success: true,
      message: "Pickup OTP sent to customer successfully.",
      data: result.booking,
      booking: result.booking
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Send pickup OTP error." } });
  }
}
async function verifyPickupHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const otp = String(body.otp || "").trim();
    if (!otp || otp.length !== 6) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "6-digit OTP code required." }
      });
    }
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "verifyPickup", session, { otp });
    return res.status(200).json({
      success: true,
      message: "Pickup verified. Device now IN_TRANSIT",
      data: result.booking,
      booking: result.booking
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Verify pickup error." } });
  }
}
async function sendCustodyOtpHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "sendCustodyOtp", session);
    if (result.generatedOtp && result.recipientEmail) {
      try {
        const code = result.generatedOtp;
        await sendEmail({
          to: { email: result.recipientEmail, name: result.recipientName || "Flashfix Technician" },
          subject: `\u26A1 ${code} is your Flashfix lab custody verification code`,
          htmlContent: `
            <div style="font-family: -apple-system, sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 32px 20px; border-radius: 16px; max-width: 480px; margin: auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 26px; font-weight: 900; color: #F5F0EB;">FLASH<span style="color: #ef8f0b;">FIX</span></span>
              </div>
              <div style="background: #171717; border: 1px solid rgba(239, 143, 11, 0.3); padding: 24px; border-radius: 12px; text-align: center;">
                <p style="color: #A3A3A3; font-size: 12px; text-transform: uppercase; font-family: monospace; margin: 0 0 12px 0;">Lab Custody Handover PIN</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ef8f0b; font-family: monospace;">${code}</div>
                <p style="color: #888; font-size: 12px; margin-top: 14px;">Technician handover verification code for intake inspection.</p>
              </div>
            </div>
          `,
          textContent: `Your Flashfix custody verification code is ${code}.`
        });
      } catch (emailErr) {
        console.warn("Brevo custody dispatch warning:", emailErr);
      }
    }
    return res.status(200).json({
      success: true,
      message: "Custody OTP dispatched to technician",
      data: result.booking,
      booking: result.booking
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Send custody OTP error." } });
  }
}
async function verifyCustodyHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const otp = String(body.otp || "").trim();
    if (!otp || otp.length !== 6) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "6-digit OTP code required." }
      });
    }
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "verifyCustody", session, { otp });
    return res.status(200).json({
      success: true,
      message: "Custody verified. Device now IN_REPAIR",
      data: result.booking,
      booking: result.booking
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Verify custody error." } });
  }
}
async function completeRepairHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const finalCostPaise = body.finalCostPaise !== void 0 ? Number(body.finalCostPaise) : void 0;
    const note = body.note || "Multi-point lab diagnostic checks passed. OEM components installed.";
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "completeRepair", session, {
      finalCostPaise,
      note
    });
    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: "Repair marked complete"
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Complete repair error." } });
  }
}
async function startReturnHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "startReturn", session, {
      note: body.note
    });
    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: "Device dispatched for return delivery"
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Start return error." } });
  }
}
async function deliverBookingHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeTransition(db, bookingId, "deliver", session, {
      note: body.note
    });
    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: "Device delivered to customer and payment collected"
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Deliver booking error." } });
  }
}
async function updateBookingStatusHandler(req, res, bookingId) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const newStatus = body.status;
    const note = body.note;
    const finalCostPaise = body.finalCostPaise !== void 0 ? Number(body.finalCostPaise) : void 0;
    if (!newStatus) {
      return res.status(400).json({ error: { message: "Status is required." } });
    }
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    const result = await executeStatusTransition(db, bookingId, newStatus, session, {
      note,
      finalCostPaise,
      otp: body.otp,
      employeeId: body.employeeId,
      technicianId: body.technicianId
    });
    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: `Status updated to ${newStatus}`
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Update status error." } });
  }
}
async function cancelBookingHandler(req, res, bookingId) {
  try {
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
    let session = await getSession(req);
    const body = req.body || {};
    const headerEmail = String(req.headers?.["x-user-email"] || body.email || "").trim().toLowerCase();
    if (!session && headerEmail) {
      const userRes = await db.query(
        `SELECT id, email, role, name, store_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [headerEmail]
      );
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        session = {
          sub: u.id,
          email: u.email,
          role: u.role || "CONSUMER",
          name: u.name,
          storeId: u.store_id || null
        };
      } else {
        session = {
          sub: headerEmail,
          email: headerEmail,
          role: "CONSUMER"
        };
      }
    }
    if (!session) {
      session = await requireAuth(req);
    }
    const note = body.note || "Booking cancelled by user";
    const result = await executeTransition(db, bookingId, "cancel", session, { note });
    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      booking: result.booking,
      data: result.booking
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || "Cancel booking error." } });
  }
}
async function genericBookingActionHandler(req, res, bookingId, action) {
  const norm = normalizeAction(action);
  switch (norm) {
    case "startPickup":
      return startPickupHandler(req, res, bookingId);
    case "sendPickupOtp":
      return sendPickupOtpHandler(req, res, bookingId);
    case "verifyPickup":
      return verifyPickupHandler(req, res, bookingId);
    case "sendCustodyOtp":
      return sendCustodyOtpHandler(req, res, bookingId);
    case "verifyCustody":
      return verifyCustodyHandler(req, res, bookingId);
    case "completeRepair":
      return completeRepairHandler(req, res, bookingId);
    case "startReturn":
      return startReturnHandler(req, res, bookingId);
    case "deliver":
      return deliverBookingHandler(req, res, bookingId);
    case "cancel":
      return cancelBookingHandler(req, res, bookingId);
    default: {
      try {
        const session = await requireAuth(req);
        const db = getPool();
        if (!db) return res.status(500).json({ error: { message: "Database connection unavailable." } });
        const result = await executeTransition(db, bookingId, action, session, req.body || {});
        return res.status(200).json({
          success: true,
          data: result.booking,
          booking: result.booking
        });
      } catch (err) {
        if (err instanceof HttpError) {
          return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
        }
        return res.status(500).json({ error: { message: err.message || `Action ${action} failed.` } });
      }
    }
  }
}

// api/_lib/dispatcher.ts
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id, x-user-email");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  let pathname = "";
  if (req.query?.route) {
    if (Array.isArray(req.query.route)) {
      pathname = "/" + req.query.route.join("/");
    } else {
      pathname = "/" + req.query.route;
    }
  } else {
    try {
      const url = new URL(req.url || "", "http://localhost");
      pathname = url.pathname.replace(/^\/api/, "");
    } catch {
      pathname = (req.url || "").replace(/^\/api/, "");
    }
  }
  if (!pathname.startsWith("/")) pathname = "/" + pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body || "{}");
    } catch {
      req.body = {};
    }
  } else if (!req.body || typeof req.body !== "object") {
    req.body = {};
  }
  const method = req.method;
  try {
    if (pathname === "/auth/google" && method === "GET") return await googleAuthStartHandler(req, res);
    if (pathname === "/auth/google/callback" && method === "GET") return await googleAuthCallbackHandler(req, res);
    if (pathname === "/auth/identify" && method === "POST") return await identifyHandler(req, res);
    if ((pathname === "/auth/staff-login" || pathname === "/admin/auth/login") && method === "POST") return await staffLoginHandler(req, res);
    if (pathname === "/auth/verify-otp" && method === "POST") return await verifyOtpHandler(req, res);
    if (pathname === "/auth/send-otp" && method === "POST") return await sendOtpHandler(req, res);
    if (pathname === "/auth/me" && method === "GET") return await meHandler(req, res);
    if (pathname === "/auth/me" && method === "PATCH") return await updateMeHandler(req, res);
    if (pathname === "/auth/logout" && method === "POST") return await logoutHandler(req, res);
    if (pathname === "/account/addresses" && method === "GET") return await getAddressesHandler(req, res);
    if (pathname === "/account/addresses" && method === "POST") return await createAddressHandler(req, res);
    const deleteAddressMatch = pathname.match(/^\/account\/addresses\/([^\/]+)$/);
    if (deleteAddressMatch && method === "DELETE") return await deleteAddressHandler(req, res, deleteAddressMatch[1]);
    if ((pathname === "/stores/nearby" || pathname === "/api/stores/nearby") && method === "GET") return await getNearbyStoresHandler(req, res);
    if (pathname === "/stores" && method === "GET") return await getStoresHandler(req, res);
    if (pathname === "/admin/stores" && method === "GET") return await getAdminStoresHandler(req, res);
    if (pathname === "/admin/stores" && method === "POST") return await upsertStoreHandler(req, res);
    const storeToggleMatch = pathname.match(/^\/admin\/stores\/([^\/]+)\/toggle$/);
    if (storeToggleMatch && (method === "POST" || method === "PATCH")) return await toggleStoreHandler(req, res, storeToggleMatch[1]);
    if (pathname === "/admin/stores/toggle" && (method === "POST" || method === "PATCH")) return await toggleStoreHandler(req, res, req.body.storeId);
    const storeDeleteMatch = pathname.match(/^\/admin\/stores\/([^\/]+)$/);
    if (storeDeleteMatch && method === "DELETE") return await deleteStoreHandler(req, res, storeDeleteMatch[1]);
    if (pathname === "/admin/stores/delete" && method === "POST") return await deleteStoreHandler(req, res, req.body.storeId);
    if (pathname === "/admin/stores/assign-admins" && method === "POST") return await assignStoreAdminsHandler(req, res);
    if ((pathname === "/settings" || pathname === "/admin/settings") && method === "GET") return await getSettingsHandler(req, res);
    if (pathname === "/admin/settings" && (method === "PUT" || method === "POST")) return await updateSettingsHandler(req, res);
    if (pathname === "/admin/dashboard" && method === "GET") return await getDashboardHandler(req, res);
    if (pathname === "/admin/team" && method === "GET") return await getTeamHandler(req, res);
    if ((pathname === "/admin/team" || pathname === "/admin/team/invite") && method === "POST") return await createTeamMemberHandler(req, res);
    const teamRoleMatch = pathname.match(/^\/admin\/team\/([^\/]+)\/role$/);
    if (teamRoleMatch && method === "PATCH") return await updateTeamRoleHandler(req, res, teamRoleMatch[1]);
    if (pathname === "/admin/inventory" && method === "GET") return await getInventoryHandler(req, res);
    if (pathname === "/admin/inventory" && method === "POST") return await upsertInventoryHandler(req, res);
    const invStockMatch = pathname.match(/^\/admin\/inventory\/([^\/]+)\/stock$/);
    if (invStockMatch && method === "PATCH") return await updateInventoryStockHandler(req, res, invStockMatch[1]);
    const invDeleteMatch = pathname.match(/^\/admin\/inventory\/([^\/]+)$/);
    if (invDeleteMatch && method === "DELETE") return await deleteInventoryHandler(req, res, invDeleteMatch[1]);
    const assignBookingMatch = pathname.match(/^\/admin\/bookings\/([^\/]+)\/assign$/);
    if (assignBookingMatch && method === "POST") return await assignBookingStaffHandler(req, res, assignBookingMatch[1]);
    if ((pathname === "/admin/bookings" || pathname === "/bookings") && method === "GET") return await getAdminBookingsHandler(req, res);
    if (pathname === "/bookings" && method === "POST") return await createBookingHandler(req, res);
    if ((pathname === "/bookings/mine" || pathname === "/bookings/my" || pathname === "/account/bookings") && method === "GET") return await getMyBookingsHandler(req, res);
    const bookingCancelMatch = pathname.match(/^\/bookings\/([^\/]+)\/cancel$/);
    if (bookingCancelMatch && method === "POST") return await cancelBookingHandler(req, res, bookingCancelMatch[1]);
    const bookingTrailMatch = pathname.match(/^\/bookings\/([^\/]+)\/trail$/);
    if (bookingTrailMatch && method === "GET") return await getBookingTrailHandler(req, res, bookingTrailMatch[1]);
    const startPickupMatch = pathname.match(/^\/bookings\/([^\/]+)\/start-pickup$/);
    if (startPickupMatch && method === "POST") return await startPickupHandler(req, res, startPickupMatch[1]);
    const sendPickupOtpMatch = pathname.match(/^\/bookings\/([^\/]+)\/send-pickup-otp$/);
    if (sendPickupOtpMatch && method === "POST") return await sendPickupOtpHandler(req, res, sendPickupOtpMatch[1]);
    const verifyPickupMatch = pathname.match(/^\/bookings\/([^\/]+)\/verify-pickup$/);
    if (verifyPickupMatch && method === "POST") return await verifyPickupHandler(req, res, verifyPickupMatch[1]);
    const sendCustodyOtpMatch = pathname.match(/^\/bookings\/([^\/]+)\/send-custody-otp$/);
    if (sendCustodyOtpMatch && method === "POST") return await sendCustodyOtpHandler(req, res, sendCustodyOtpMatch[1]);
    const verifyCustodyMatch = pathname.match(/^\/bookings\/([^\/]+)\/verify-custody$/);
    if (verifyCustodyMatch && method === "POST") return await verifyCustodyHandler(req, res, verifyCustodyMatch[1]);
    const repairCompleteMatch = pathname.match(/^\/bookings\/([^\/]+)\/repair-complete$/);
    if (repairCompleteMatch && method === "POST") return await completeRepairHandler(req, res, repairCompleteMatch[1]);
    const startReturnMatch = pathname.match(/^\/bookings\/([^\/]+)\/start-return$/);
    if (startReturnMatch && method === "POST") return await startReturnHandler(req, res, startReturnMatch[1]);
    const deliverMatch = pathname.match(/^\/bookings\/([^\/]+)\/deliver$/);
    if (deliverMatch && method === "POST") return await deliverBookingHandler(req, res, deliverMatch[1]);
    const statusMatch = pathname.match(/^\/(?:admin\/)?bookings\/([^\/]+)\/status$/);
    if (statusMatch && method === "PATCH") return await updateBookingStatusHandler(req, res, statusMatch[1]);
    const genericActionMatch = pathname.match(/^\/bookings\/([^\/]+)\/([a-zA-Z0-9_-]+)$/);
    if (genericActionMatch && method === "POST" && !["status", "cancel", "trail"].includes(genericActionMatch[2])) {
      return await genericBookingActionHandler(req, res, genericActionMatch[1], genericActionMatch[2]);
    }
    const singleBookingMatch = pathname.match(/^\/bookings\/([^\/]+)$/);
    if (singleBookingMatch && method === "GET" && !["mine", "nearby"].includes(singleBookingMatch[1])) {
      return await getBookingByIdHandler(req, res, singleBookingMatch[1]);
    }
    return res.status(200).json({
      status: "ok",
      service: "flashfix-serverless-api",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      route: pathname
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    console.error("Unhandled API Gateway Error:", err);
    return res.status(500).json({ error: { message: err.message || "Internal server error." } });
  }
}
export {
  handler as default
};
