import * as dotenv from 'dotenv';
import { createApp } from './app.js';

dotenv.config();

const port = Number(process.env.PORT) || 3008;
const app = createApp();

const server = app.listen(port, () => {
  console.log(`⚡ [inventory-service] running on port ${port} (mode: ${process.env.NODE_ENV || 'development'})`);
});

process.on('SIGTERM', () => {
  console.log('[inventory-service] shutting down...');
  server.close(() => process.exit(0));
});

export { app, server };
