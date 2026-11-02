import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcDir = path.resolve(rootDir, 'api');
const dstDir = path.resolve(rootDir, 'packages/web/api');

function getFilesRecursively(dir, base = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = base ? path.join(base, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, relPath));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results;
}

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

console.log(`[check-mirror] Checking parity between:
  Source: ${srcDir}
  Mirror: ${dstDir}`);

if (!fs.existsSync(srcDir)) {
  console.error(`[check-mirror] Source directory does not exist: ${srcDir}`);
  process.exit(1);
}

if (!fs.existsSync(dstDir)) {
  console.error(`[check-mirror] Mirror directory does not exist: ${dstDir}`);
  process.exit(1);
}

const srcFiles = getFilesRecursively(srcDir).sort();
const dstFiles = getFilesRecursively(dstDir).sort();

const errors = [];

// Check every file in src exists and matches in dst
for (const rel of srcFiles) {
  const srcFile = path.join(srcDir, rel);
  const dstFile = path.join(dstDir, rel);

  if (!fs.existsSync(dstFile)) {
    errors.push(`Missing in mirror: packages/web/api/${rel}`);
    continue;
  }

  const srcHash = sha256(srcFile);
  const dstHash = sha256(dstFile);

  if (srcHash !== dstHash) {
    errors.push(`Content mismatch: api/${rel} (hash: ${srcHash.slice(0, 8)}) != packages/web/api/${rel} (hash: ${dstHash.slice(0, 8)})`);
  }
}

// Check if dst has any extraneous files not in src
for (const rel of dstFiles) {
  const srcFile = path.join(srcDir, rel);
  if (!fs.existsSync(srcFile)) {
    errors.push(`Extraneous file in mirror (not in api/): packages/web/api/${rel}`);
  }
}

if (errors.length > 0) {
  console.error(`\n[check-mirror] FAILED: ${errors.length} divergence(s) detected:`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`[check-mirror] SUCCESS: Parity confirmed across ${srcFiles.length} file(s). 0 divergence.`);
process.exit(0);
