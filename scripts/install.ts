#!/usr/bin/env node

/**
 * site-sense setup script
 *
 * Does everything in one command:
 * 1. Registers the native messaging host for Chrome/Edge
 * 2. Uses the deterministic extension ID (from manifest.json key)
 * 3. Optionally launches the browser with the extension loaded
 *
 * Usage:
 *   node dist/scripts/install.js [--browser chrome|edge] [--launch]
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST_NAME = 'com.sitesense.bridge';

// Deterministic extension ID derived from the public key in manifest.json
// Algorithm: SHA-256(DER(pubkey))[0:32] mapped 0-f → a-p
const EXTENSION_ID = 'jhapajnoajjppmbgmfhfnoonkmgglklm';

interface HostManifest {
  name: string;
  description: string;
  path: string;
  type: 'stdio';
  allowed_origins: string[];
}

function getProjectRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

function getNativeHostDir(browser: 'chrome' | 'edge'): string {
  const platform = os.platform();

  if (platform === 'darwin') {
    const base = path.join(os.homedir(), 'Library', 'Application Support');
    return browser === 'edge'
      ? path.join(base, 'Microsoft Edge', 'NativeMessagingHosts')
      : path.join(base, 'Google', 'Chrome', 'NativeMessagingHosts');
  }

  if (platform === 'linux') {
    return browser === 'edge'
      ? path.join(os.homedir(), '.config', 'microsoft-edge', 'NativeMessagingHosts')
      : path.join(os.homedir(), '.config', 'google-chrome', 'NativeMessagingHosts');
  }

  throw new Error(
    `Unsupported platform: ${platform}. On Windows, use the registry-based installer.`
  );
}

function getBrowserPath(browser: 'chrome' | 'edge'): string | null {
  const platform = os.platform();

  if (platform === 'darwin') {
    const paths = browser === 'edge'
      ? ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];

    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }

  if (platform === 'linux') {
    try {
      const bin = browser === 'edge' ? 'microsoft-edge' : 'google-chrome';
      return execSync(`which ${bin}`, { encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }

  return null;
}

async function install(browser: 'chrome' | 'edge', launch: boolean) {
  const projectRoot = getProjectRoot();
  const extensionDir = path.join(projectRoot, 'dist', 'extension');
  const nativeHostSrc = path.join(projectRoot, 'dist', 'bridge', 'src', 'native-host.js');

  // Verify build exists
  if (!fs.existsSync(nativeHostSrc)) {
    console.error(`❌ Build not found at ${nativeHostSrc}\n   Run 'npm run build' first.`);
    process.exit(1);
  }

  // Verify extension exists
  if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
    console.error(`❌ Extension not found at ${extensionDir}`);
    process.exit(1);
  }

  // --- Step 1: Create native host wrapper script ---
  // Use absolute path to node (Chrome spawns with minimal PATH, NVM not loaded)
  const nodePath = process.execPath;
  const wrapperPath = path.join(projectRoot, 'site-sense-native-host');
  fs.writeFileSync(wrapperPath, `#!/bin/bash\nexec "${nodePath}" "${nativeHostSrc}" "$@"\n`, {
    mode: 0o755,
  });

  // --- Step 2: Register native messaging host ---
  const manifest: HostManifest = {
    name: HOST_NAME,
    description: 'site-sense: give your AI coding CLI eyes into web portals',
    path: wrapperPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
  };

  const hostDir = getNativeHostDir(browser);
  fs.mkdirSync(hostDir, { recursive: true });

  const manifestPath = path.join(hostDir, `${HOST_NAME}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✅ site-sense setup complete for ${browser}\n`);
  console.log(`   Native host: ${manifestPath}`);
  console.log(`   Extension ID: ${EXTENSION_ID} (deterministic)`);
  console.log(`   Extension dir: ${extensionDir}`);

  // --- Step 3: Launch browser with extension ---
  if (launch) {
    const browserPath = getBrowserPath(browser);
    if (!browserPath) {
      console.log(`\n⚠  Could not find ${browser} binary. Load the extension manually:`);
      printManualInstructions(browser, extensionDir);
      return;
    }

    console.log(`\n🚀 Launching ${browser} with site-sense extension...`);
    console.log(`   (If ${browser} is already running, close it first for --load-extension to work)\n`);

    try {
      const { spawn } = await import('node:child_process');
      const child = spawn(browserPath, [`--load-extension=${extensionDir}`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      console.log(`   ✓ ${browser} launched with extension loaded`);
    } catch (err) {
      console.log(`   ⚠  Failed to launch: ${err instanceof Error ? err.message : err}`);
      printManualInstructions(browser, extensionDir);
    }
  } else {
    printManualInstructions(browser, extensionDir);
  }

  // --- Step 4: MCP config hint ---
  console.log(`\n📋 Add to your CLI MCP config (.mcp.json or settings):\n`);
  console.log(`   {`);
  console.log(`     "mcpServers": {`);
  console.log(`       "site-sense": {`);
  console.log(`         "command": "node",`);
  console.log(`         "args": ["${path.join(projectRoot, 'dist', 'bridge', 'src', 'index.js')}"]`);
  console.log(`       }`);
  console.log(`     }`);
  console.log(`   }\n`);
}

function printManualInstructions(browser: 'chrome' | 'edge', extensionDir: string) {
  const url = browser === 'edge' ? 'edge://extensions' : 'chrome://extensions';
  console.log(`\n   Load the extension in ${browser}:`);
  console.log(`   1. Open ${url}`);
  console.log(`   2. Enable Developer mode`);
  console.log(`   3. Click "Load unpacked" → select: ${extensionDir}`);
}

// --- CLI ---

const args = process.argv.slice(2);
let browser: 'chrome' | 'edge' = 'edge';
let launch = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--browser' && args[i + 1]) {
    const b = args[i + 1].toLowerCase();
    if (b !== 'chrome' && b !== 'edge') {
      console.error('--browser must be "chrome" or "edge"');
      process.exit(1);
    }
    browser = b;
    i++;
  } else if (args[i] === '--launch') {
    launch = true;
  }
}

install(browser, launch);
