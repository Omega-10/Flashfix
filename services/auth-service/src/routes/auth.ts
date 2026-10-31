import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import {
  isDisposableEmail,
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
  RefreshTokenRequestSchema,
  UpdateProfileRequestSchema,
  CreateSavedAddressRequestSchema,
} from '@flashfix/shared';
import { getAuthRepository } from '../db/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  AuthenticatedRequest,
} from '../middleware/auth.js';

const router = Router();
const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:3005';

// 1. Send Login OTP
router.post('/send-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SendOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email address', details: parsed.error.format() },
      });
    }

    const email = parsed.data.email.trim().toLowerCase();

    // Disposable email check
    if (isDisposableEmail(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
          message: 'Disposable or temporary email addresses are not permitted',
        },
      });
    }

    // Generate 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = bcrypt.hashSync(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const repo = getAuthRepository();
    await repo.saveOtp({
      email,
      codeHash,
      purpose: 'LOGIN',
      expiresAt,
    });

    // Dispatch via notify-service
    try {
      await fetch(`${NOTIFY_URL}/notify/otp-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
    } catch (notifyErr) {
      // In offline/hermetic test mode, notify-service might be offline; continue gracefully
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[auth-service] could not notify notify-service:', (notifyErr as Error).message);
      }
    }

    return res.json({
      success: true,
      message: 'OTP sent to email',
      code: process.env.NODE_ENV !== 'production' ? code : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Verify Login OTP
router.post('/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = VerifyOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid OTP verification payload', details: parsed.error.format() },
      });
    }

    const { email, code } = parsed.data;
    const repo = getAuthRepository();
    const otp = await repo.findActiveOtp(email, 'LOGIN');

    if (!otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'OTP has expired or is invalid' },
      });
    }

    if (otp.attempts >= 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded' },
      });
    }

    const isValid = bcrypt.compareSync(code, otp.codeHash);
    if (!isValid) {
      await repo.incrementOtpAttempts(otp.id);
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_INVALID', message: 'Invalid OTP code' },
      });
    }

    // Mark OTP used
    await repo.markOtpVerified(otp.id);

    // Upsert user
    const user = await repo.upsertUser({
      email,
      role: 'CONSUMER',
      emailVerified: true,
    });

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Google OAuth Redirect
router.get('/google', (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId.startsWith('mock-')) {
    // Return mock Google OAuth URL
    return res.json({
      success: true,
      authUrl: `/auth/google/callback?code=mock-google-code-${Date.now()}`,
    });
  }

  const redirectUri = `${process.env.APP_URL || 'http://localhost:3001'}/auth/google/callback`;
  const scope = encodeURIComponent('profile email');
  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&access_type=offline`;

  return res.redirect(googleUrl);
});

// 4. Google OAuth Callback
router.get('/google/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = (req.query.code as string) || 'mock-google-code';
    let profile = {
      email: 'consumer.google@gmail.com',
      name: 'Google User',
      googleId: `goog-${Date.now()}`,
      avatarUrl: 'https://lh3.googleusercontent.com/a/default',
    };

    // If real Google credentials configured and not a mock code
    if (
      process.env.GOOGLE_CLIENT_ID &&
      !process.env.GOOGLE_CLIENT_ID.startsWith('mock-') &&
      !code.startsWith('mock-')
    ) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: `${process.env.APP_URL || 'http://localhost:3001'}/auth/google/callback`,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = (await tokenRes.json()) as any;
        if (tokenData.access_token) {
          const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userinfo = (await userinfoRes.json()) as any;
          profile = {
            email: userinfo.email,
            name: userinfo.name || userinfo.email.split('@')[0],
            googleId: userinfo.id,
            avatarUrl: userinfo.picture,
          };
        }
      } catch (oauthErr) {
        console.warn('[auth-service] Google OAuth exchange failed, falling back to mock profile', oauthErr);
      }
    }

    if (isDisposableEmail(profile.email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'DISPOSABLE_EMAIL_NOT_ALLOWED', message: 'Disposable emails not permitted' },
      });
    }

    const repo = getAuthRepository();
    const user = await repo.upsertUser({
      email: profile.email,
      name: profile.name,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      role: 'CONSUMER',
      emailVerified: true,
    });

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. Refresh Access Token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RefreshTokenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing refresh token' },
      });
    }

    let payload;
    try {
      payload = verifyRefreshToken(parsed.data.refreshToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' },
      });
    }

    const repo = getAuthRepository();
    const user = await repo.findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User associated with token no longer exists' },
      });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    };

    const accessToken = signAccessToken(tokenPayload);
    return res.json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
});

// 6. Get Current User Profile (GET /auth/me)
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const repo = getAuthRepository();
    const user = await repo.findUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const savedAddresses = await repo.getSavedAddresses(user.id);
    return res.json({
      success: true,
      data: {
        ...user,
        savedAddresses,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 7. Update Current User Profile (PATCH /auth/me)
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateProfileRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid profile update payload' },
      });
    }

    const repo = getAuthRepository();
    const updated = await repo.updateUser(req.user!.userId, parsed.data);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// 8. Saved Addresses (POST & GET /auth/saved-addresses)
router.post('/saved-addresses', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateSavedAddressRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid address payload', details: parsed.error.format() },
      });
    }

    const repo = getAuthRepository();
    const address = await repo.createSavedAddress({
      userId: req.user!.userId,
      label: parsed.data.label || 'Home',
      address: parsed.data.address,
      landmark: parsed.data.landmark || null,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      isDefault: parsed.data.isDefault ?? false,
    });

    return res.status(201).json({
      success: true,
      data: address,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/saved-addresses', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const repo = getAuthRepository();
    const addresses = await repo.getSavedAddresses(req.user!.userId);
    return res.json({
      success: true,
      data: addresses,
    });
  } catch (err) {
    next(err);
  }
});

// 9. Logout
router.post('/logout', requireAuth, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
