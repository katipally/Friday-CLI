#!/usr/bin/env node

/**
 * Build a standalone binary for fridaycode using Node.js Single Executable Application (SEA).
 * Requires Node.js >= 20.
 *
 * Usage: node scripts/build-binary.mjs
 *
 * This creates:
 *   dist/friday-macos-arm64
 *   dist/friday-macos-x64
 *   dist/friday-linux-x64
 *   dist/friday-win-x64.exe
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-binary');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function buildSEA() {
  console.log('\n🔨 Building fridaycode standalone binary\n');

  // Step 1: Build all packages
  console.log('1. Building packages...');
  run('pnpm run build');

  // Step 2: Bundle CLI into a single file with esbuild
  console.log('\n2. Bundling into single file...');
  ensureDir(DIST);

  run(
    `npx esbuild packages/cli/dist/bin/friday.js ` +
    `--bundle --platform=node --target=node20 ` +
    `--outfile=${DIST}/friday-bundled.cjs ` +
    `--format=cjs --external:fsevents`
  );

  // Step 3: Generate SEA config
  console.log('\n3. Generating SEA config...');
  const seaConfig = {
    main: path.join(DIST, 'friday-bundled.cjs'),
    output: path.join(DIST, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
  };
  fs.writeFileSync(
    path.join(DIST, 'sea-config.json'),
    JSON.stringify(seaConfig, null, 2),
  );

  // Step 4: Generate the blob
  console.log('\n4. Generating SEA blob...');
  run(`node --experimental-sea-config ${DIST}/sea-config.json`);

  // Step 5: Create the executable
  const platform = process.platform;
  const arch = process.arch;
  const nodeBin = process.execPath;

  if (platform === 'darwin') {
    const binaryName = `friday-macos-${arch}`;
    const binaryPath = path.join(DIST, binaryName);

    console.log(`\n5. Creating macOS binary (${arch})...`);
    fs.copyFileSync(nodeBin, binaryPath);
    run(`codesign --remove-signature "${binaryPath}"`);
    run(
      `npx postject "${binaryPath}" NODE_SEA_BLOB "${DIST}/sea-prep.blob" ` +
      `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`
    );
    run(`codesign --sign - "${binaryPath}"`);
    fs.chmodSync(binaryPath, 0o755);
    console.log(`\n✅ Binary created: ${binaryPath}`);
  } else if (platform === 'linux') {
    const binaryName = `friday-linux-${arch}`;
    const binaryPath = path.join(DIST, binaryName);

    console.log(`\n5. Creating Linux binary (${arch})...`);
    fs.copyFileSync(nodeBin, binaryPath);
    run(
      `npx postject "${binaryPath}" NODE_SEA_BLOB "${DIST}/sea-prep.blob" ` +
      `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`
    );
    fs.chmodSync(binaryPath, 0o755);
    console.log(`\n✅ Binary created: ${binaryPath}`);
  } else if (platform === 'win32') {
    const binaryName = 'friday-win-x64.exe';
    const binaryPath = path.join(DIST, binaryName);

    console.log('\n5. Creating Windows binary...');
    fs.copyFileSync(nodeBin, binaryPath);
    run(
      `npx postject "${binaryPath}" NODE_SEA_BLOB "${DIST}/sea-prep.blob" ` +
      `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`
    );
    console.log(`\n✅ Binary created: ${binaryPath}`);
  }

  // Cleanup
  console.log('\n6. Cleaning up...');
  const cleanupFiles = ['friday-bundled.cjs', 'sea-config.json', 'sea-prep.blob'];
  for (const f of cleanupFiles) {
    const fp = path.join(DIST, f);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  console.log('\n🎉 Build complete!\n');
}

buildSEA().catch((err) => {
  console.error('\n❌ Build failed:', err.message);
  process.exit(1);
});
