import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bookingsRouter from './routes/bookings.js';
import adminRouter from './routes/admin.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'booking-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount routes
  app.use('/bookings', bookingsRouter);
  app.use('/admin', adminRouter);

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[booking-service error]', err);
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
