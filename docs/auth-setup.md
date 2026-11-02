# Flashfix Authentication & Secret Setup Guide

This guide details the security model, environment variable configuration, and step-by-step setup for **JWT Sessions**, **Brevo Transactional Email**, and **Google OAuth** in Flashfix v2.

---

## 1. Architecture Overview

Flashfix v2 enforces database-authoritative authentication and role-based access control (RBAC):
- **Signed Cookie Sessions**: Authentication tokens are standard **HS256 signed JWTs** issued into an `HttpOnly`, `SameSite=Lax`, `Secure` cookie named `ff_session`.
- **Zero LocalStorage Tokens**: Sensitive tokens are never stored in browser `localStorage` or `sessionStorage`, mitigating XSS credential exfiltration.
- **Fail-Closed Secrets**: In production (`NODE_ENV === 'production'`), missing or short secrets trigger fatal errors that fail closed rather than degrading to insecure defaults.
- **Active Account Check**: Every protected route verifies signature validity and queries PostgreSQL to ensure `users.is_active` has not been revoked.

---

## 2. JWT Secret Configuration

Flashfix signs and verifies all `ff_session` cookies using a cryptographically random secret.

### 2.1 Generating a Production Secret
Generate a 256-bit or 512-bit secure random secret using OpenSSL or Node.js:

```bash
# Using OpenSSL (recommended)
openssl rand -base64 48

# Or using Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.2 Environment Variables
Add the generated string to your environment:

| Variable | Required | Description | Minimum Length |
|---|---|---|---|
| `JWT_SECRET` | **Yes (Prod)** | Cryptographic key used for HS256 JWT signing and verification | 32 characters |

#### Vercel Production Configuration
1. Open the **Flashfix Project** in the Vercel Dashboard.
2. Navigate to **Settings** → **Environment Variables**.
3. Add key: `JWT_SECRET`, Value: `<generated-secret>`.
4. Select environments: **Production**, **Preview**.
5. Save and redeploy.

#### Local Development Behavior
In non-production environments (`NODE_ENV !== 'production'`), if `JWT_SECRET` is unset, the system defaults to:
```
flashfix_local_development_jwt_secret_32bytes_min
```
> **Warning**: Never use the local development fallback in production. The API validates `process.env.NODE_ENV === 'production'` and immediately throws an unhandled fatal exception if `JWT_SECRET` is absent or shorter than 32 characters.

---

## 3. Brevo Transactional Email Setup

All one-time passwords (login OTP, doorstep pickup verification, and lab custody handover) are dispatched via the Brevo HTTP API.

### 3.1 Obtaining API Credentials
1. Sign up or log into [Brevo](https://www.brevo.com/).
2. Navigate to **Account** → **SMTP & API** → **API Keys**.
3. Click **Generate a new API key**, name it `flashfix-v2-production`, and copy the secret key.
4. Verify your sender email address under **Senders & IP** (e.g. `support@flashfix.in`).

### 3.2 Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `BREVO_API_KEY` | **Yes (Prod)** | Primary Brevo v3 REST API key | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Optional | Verified sender email address | `support@flashfix.in` |
| `BREVO_SENDER_NAME` | Optional | Display name for outbound emails | `Flashfix Support` |

#### Zero Hardcoded Fallback Policy
All XOR-hex obfuscated fallback keys have been purged from the codebase. In development, if `BREVO_API_KEY` is omitted, the API logs a warning and simulates email dispatch without throwing. In production, missing credentials return an explicit `500 BREVO_API_KEY_MISSING` error without calling external endpoints.

---

## 4. Google OAuth Setup (Step-by-Step)

If integrating Google Sign-In with Flashfix, follow these steps in Google Cloud Console.

### Step 1: Create a Google Cloud Project
1. Log into the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar → **New Project**.
3. Name the project `Flashfix Platform` and click **Create**.

### Step 2: Configure OAuth Consent Screen
1. In the left navigation, go to **APIs & Services** → **OAuth consent screen**.
2. Select User Type: **External** (or **Internal** if using Google Workspace).
3. Fill in the required fields:
   - **App name**: `Flashfix`
   - **User support email**: Your support or administrator email.
   - **Developer contact information**: Your technical contact email.
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes** and select:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Click **Save and Continue**. If in Testing mode, add test user emails.

### Step 3: Create OAuth 2.0 Credentials
1. In the left navigation, go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Select Application type: **Web application**.
4. Name: `Flashfix Web App`.

### Step 4: Configure Origins and Redirect URIs
Under **Authorized JavaScript origins**, add:
- Local development: `http://localhost:5173`, `http://localhost:3000`
- Production domain: `https://flashfix.in`, `https://www.flashfix.in`
- Vercel preview domain: `https://<your-project>.vercel.app`

Under **Authorized redirect URIs**, add:
- Local development: `http://localhost:5173/api/auth/google/callback`
- Production domain: `https://flashfix.in/api/auth/google/callback`

Click **Create**. A modal will display your **Client ID** and **Client Secret**.

### Step 5: Configure Environment Variables
Add the credentials to your Vercel project and `.env.local`:

```env
GOOGLE_CLIENT_ID=1234567890-abc123xyz.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
```

---

## 5. Cookie Specification Matrix

| Cookie Name | Scope | Attributes | Expiry | Security Purpose |
|---|---|---|---|---|
| `ff_session` | `/` | `HttpOnly; SameSite=Lax; Secure` | Session (12h) or Persistent (7d if "Remember me") | Authenticated session token signed with HS256 |

### Session Token Payload (`SessionPayload`)
```typescript
export interface SessionPayload {
  sub: string;             // User UUID (primary key in `users`)
  email: string;           // Normalized lowercase email
  role: UserRole;          // 'CONSUMER' | 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN' | 'TECHNICIAN'
  name?: string;           // Optional user display name
  storeId?: string | null; // Primary home store ID (e.g. 'store-001')
  storeIds?: string[];     // All authorized store scopes from `store_admins`
  iat?: number;            // Issued-at timestamp
  exp?: number;            // Expiration timestamp
}
```

---

## 6. Verification Commands

Run the following checks from the repository root to verify authentication integrity:

```powershell
# 1. Verify byte parity between api/ and packages/web/api/
npm run check:mirror

# 2. Typecheck all packages and serverless API handlers
npm run typecheck

# 3. Verify zero obfuscated key strings in git sources
git grep "OBFUSCATED_BREVO_KEY" api/ packages/web/api/
```
