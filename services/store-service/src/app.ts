import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import storesRouter from './routes/stores.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'store-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount routes
  app.use('/stores', storesRouter);

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[store-service error]', err);
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
