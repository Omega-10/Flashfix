import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './index.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function runMigrations() {
  console.log('Starting Neon Postgres migrations...');
  const db = createDb();
  await migrate(db, { migrationsFolder: './infra/db/migrations' });
  console.log('Migrations applied successfully.');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
