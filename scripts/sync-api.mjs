import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcDir = path.resolve(rootDir, 'api');
const dstDir = path.resolve(rootDir, 'packages/web/api');

console.log(`[sync-api] Bundling self-contained serverless entry points from api/_lib/dispatcher.ts...`);

const dispatcherPath = path.resolve(srcDir, '_lib/dispatcher.ts');
if (fs.existsSync(dispatcherPath)) {
  const result = await esbuild.build({
    entryPoints: [dispatcherPath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    write: false,
    external: ['pg', 'bcryptjs', 'jsonwebtoken', 'crypto', 'node:crypto'],
    banner: {
      js: '// @ts-nocheck\n// Auto-generated self-contained Vercel Serverless bundle (immune to ESM ERR_MODULE_NOT_FOUND)\n',
    },
  });

  const bundledCode = result.outputFiles[0].text;
  fs.writeFileSync(path.resolve(srcDir, 'index.ts'), bundledCode, 'utf8');
  fs.writeFileSync(path.resolve(srcDir, '[...route].ts'), bundledCode, 'utf8');
  console.log(`[sync-api] Bundled api/index.ts and api/[...route].ts (${bundledCode.length} bytes).`);
}

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
