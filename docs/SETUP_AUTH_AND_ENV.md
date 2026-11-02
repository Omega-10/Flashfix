# Flashfix — Environment & Authentication Setup Guide

This guide covers the exact steps to configure your production secrets in **Vercel** (`Project Settings → Environment Variables`):

1. **`JWT_SECRET`** (Signed `HttpOnly` session cookies)
2. **`BREVO_API_KEY`** (Rotated transactional OTP email key)
3. **`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`** (Google Sign-In OAuth 2.0)

---

## 1. Add `JWT_SECRET` in Vercel

Flashfix uses HMAC-SHA256 (`HS256`) to cryptographically sign the `ff_session` `HttpOnly` cookie and to derive booking-bound pickup/custody OTPs.

### Ready-to-Use 256-Bit Secret (or generate your own):
You can generate a fresh 64-character hex secret in PowerShell or bash:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Or use this freshly generated 256-bit key:
```text
9f4d8c2e7a1b6053e9d2c4f8a71b3e506d9c2a4f7e1b8d305a6c9e2f4b7d1a83
```

### Steps in Vercel:
1. Open your Vercel Dashboard → select the **Flashfix** project.
2. Go to **Settings** → **Environment Variables**.
3. Add a new variable:
   - **Key**: `JWT_SECRET`
   - **Value**: Paste the 64-character hex string above.
   - **Environments**: Select **Production**, **Preview**, and **Development**.
4. Click **Save**.

---

## 2. Rotate & Add `BREVO_API_KEY` in Vercel

The legacy XOR-obfuscated Brevo key has been purged from the codebase. The backend now reads exclusively from `process.env.BREVO_API_KEY`.

### Steps in Brevo & Vercel:
1. Log in to [Brevo (app.brevo.com)](https://app.brevo.com).
2. Click your account name (top-right) → **SMTP & API** → **API Keys** tab.
3. **Delete/Revoke** the old API key that was previously used.
4. Click **Generate a new API key**, name it `flashfix-production`, and copy the `xkeysib-...` value.
5. In Vercel → **Settings** → **Environment Variables**:
   - If `BREVO_API_KEY` already exists, edit it and replace the value with your new key (or delete the old entry and add a new one).
   - Also verify `BREVO_SENDER_EMAIL` (e.g., `eswar123210@gmail.com` or your verified sender domain) and `BREVO_SENDER_NAME` (`Flashfix`).
6. Click **Save**.

---

## 3. Step-by-Step Google Sign-In (`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`) Setup

If you want to enable Google OAuth 2.0 alongside Email OTP / Staff Password sign-in:

### Step A: Configure Google Cloud OAuth Consent Screen
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Flashfix`) or select an existing project.
3. Navigate to **APIs & Services** → **OAuth consent screen**.
4. Choose **External** user type and click **Create**:
   - **App name**: `Flashfix`
   - **User support email**: Your support email
   - **Authorized domains**: Add your Vercel domain (e.g. `flashfix.vercel.app` or your custom domain)
   - **Developer contact information**: Your email address
5. Click **Save and Continue** through Scopes (`.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`) and publish the app to **In production** (so any Gmail user can sign in without being listed as a test user).

### Step B: Create OAuth 2.0 Client ID
1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. Select **Application type**: `Web application`.
4. Name: `Flashfix Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `https://<your-vercel-domain>.vercel.app`
   - `http://localhost:5173` (for local testing)
6. Under **Authorized redirect URIs**, add:
   - `https://<your-vercel-domain>.vercel.app/api/auth/google/callback`
   - `http://localhost:5173/api/auth/google/callback`
7. Click **Create** and copy the **Client ID** and **Client Secret**.

### Step C: Add to Vercel Environment Variables
1. In Vercel → **Settings** → **Environment Variables**, add:
   - `GOOGLE_CLIENT_ID` = `<your-client-id>.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = `GOCSPX-<your-client-secret>`
2. Redeploy the latest deployment from the **Deployments** tab for all environment variables to take effect.
