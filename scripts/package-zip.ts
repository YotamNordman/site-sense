#!/usr/bin/env node

/**
 * site-sense extension packager
 *
 * Zips dist/extension/ into site-sense.zip for Chrome Web Store upload.
 *
 * Usage:
 *   node dist/scripts/package-zip.js [--out <path>]
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..', '..');
const extensionDir = path.join(projectRoot, 'dist', 'extension');

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath =
  outIndex !== -1 && args[outIndex + 1]
    ? path.resolve(args[outIndex + 1])
    : path.join(projectRoot, 'site-sense.zip');

if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
  console.error(`❌ Extension build not found at ${extensionDir}`);
  console.error(`   Run 'npm run build' first.`);
  process.exit(1);
}

if (fs.existsSync(outPath)) {
  fs.unlinkSync(outPath);
}

try {
  execSync(`cd "${extensionDir}" && zip -r "${outPath}" .`, { stdio: 'inherit' });
} catch {
  console.error(`\n❌ zip failed. Make sure the 'zip' command is available.`);
  process.exit(1);
}

const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`\n✅ Packaged extension: ${outPath} (${sizeKb} KB)`);
