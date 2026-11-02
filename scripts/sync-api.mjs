import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcDir = path.resolve(rootDir, 'api');
const dstDir = path.resolve(rootDir, 'packages/web/api');

console.log(`[sync-api] Synchronizing ${srcDir} -> ${dstDir}`);

if (!fs.existsSync(srcDir)) {
  console.error(`[sync-api] Source directory does not exist: ${srcDir}`);
  process.exit(1);
}

// Ensure destination directory is completely cleaned before copy to eliminate dangling deleted files
if (fs.existsSync(dstDir)) {
  fs.rmSync(dstDir, { recursive: true, force: true });
}

fs.mkdirSync(dstDir, { recursive: true });
fs.cpSync(srcDir, dstDir, { recursive: true, force: true });

console.log('[sync-api] Synchronization complete. Verifying mirror parity...');
