import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  NotifyOtpLoginSchema,
  NotifyBookingConfirmedSchema,
  NotifyPickupOtpSchema,
  NotifyCustodyOtpSchema,
  NotifyRepairCompleteSchema,
  NotifyEmployeeAssignedSchema,
} from '@flashfix/shared';
import {
  renderOtpLoginTemplate,
  renderBookingConfirmedTemplate,
  renderPickupOtpTemplate,
  renderCustodyOtpTemplate,
  renderRepairCompleteTemplate,
  renderEmployeeAssignedTemplate,
} from './templates/index.js';
import { ConsoleMockEmailAdapter, consoleMockEmailAdapter } from './adapters/mock.js';
import { BrevoEmailAdapter } from './adapters/brevo.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Email adapter resolution: Brevo if API key is set and not test mode; otherwise ConsoleMock
  const brevoApiKey = process.env.BREVO_API_KEY;
  const useBrevo = Boolean(brevoApiKey && brevoApiKey.trim().length > 0 && process.env.NODE_ENV !== 'test');

  const emailAdapter = useBrevo
    ? new BrevoEmailAdapter({
        apiKey: brevoApiKey!,
        senderEmail: process.env.BREVO_SENDER_EMAIL || 'nexusprojects03@gmail.com',
        senderName: process.env.BREVO_SENDER_NAME || 'Flashfix',
      })
    : consoleMockEmailAdapter;

  // Health Check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'notify-service',
      adapter: useBrevo ? 'brevo' : 'console-mock',
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Login OTP
  app.post('/notify/otp-login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = NotifyOtpLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const { email, code } = parsed.data;
      const tpl = renderOtpLoginTemplate(code);

      const result = await emailAdapter.sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateType: 'otp-login',
        metadata: { code },
      });

      return res.json({
        success: true,
        message: 'Login OTP dispatched',
        messageId: result.messageId,
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Booking Confirmed
  app.post('/notify/booking-confirmed', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = NotifyBookingConfirmedSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const { email, ...rest } = parsed.data;
      const tpl = renderBookingConfirmedTemplate(rest);

      const result = await emailAdapter.sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateType: 'booking-confirmed',
        metadata: rest,
      });

      return res.json({
        success: true,
        message: 'Booking confirmation dispatched',
        messageId: result.messageId,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Pickup OTP
  app.post('/notify/pickup-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = NotifyPickupOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const { email, code, bookingId, employeeName } = parsed.data;
      const tpl = renderPickupOtpTemplate({ code, bookingId, employeeName });

      const result = await emailAdapter.sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateType: 'pickup-otp',
        metadata: { code, bookingId, employeeName },
      });

      return res.json({
        success: true,
        message: 'Pickup OTP dispatched',
        messageId: result.messageId,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Custody OTP
  app.post('/notify/custody-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = NotifyCustodyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const { email, code, bookingId, technicianName } = parsed.data;
      const tpl = renderCustodyOtpTemplate({ code, bookingId, technicianName });

      const result = await emailAdapter.sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateType: 'custody-otp',
        metadata: { code, bookingId, technicianName },
      });

      return res.json({
        success: true,
        message: 'Custody OTP dispatched',
        messageId: result.messageId,
      });
    } catch (err) {
      next(err);
    }
  });

  // 5. Repair Complete
  app.post('/notify/repair-complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = NotifyRepairCompleteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const { email, ...rest } = parsed.data;
      const tpl = renderRepairCompleteTemplate(rest);

      const result = await emailAdapter.sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateType: 'repair-complete',
        metadata: rest,
      });

      return res.json({
        success: true,
        message: 'Repair completion notification dispatched',
        messageId: result.messageId,
      });
    } catch (err) {
      next(err);
    }
  });

  // 6. Employee Assigned
  app.post('/notify/employee-assigned', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = NotifyEmployeeAssignedSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const { email, ...rest } = parsed.data;
      const tpl = renderEmployeeAssignedTemplate(rest);

      const result = await emailAdapter.sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateType: 'employee-assigned',
        metadata: rest,
      });

      return res.json({
        success: true,
        message: 'Employee assignment notification dispatched',
        messageId: result.messageId,
      });
    } catch (err) {
      next(err);
    }
  });

  // Test Inbox endpoints for testing assertions
  app.get('/notify/test-inbox', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      data: consoleMockEmailAdapter.getInbox(),
    });
  });

  app.post('/notify/test-inbox/clear', (_req: Request, res: Response) => {
    consoleMockEmailAdapter.clear();
    return res.json({
      success: true,
      message: 'Test inbox cleared',
    });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[notify-service error]', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Internal server error',
      },
    });
  });

  return app;
}
