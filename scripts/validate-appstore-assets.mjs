#!/usr/bin/env node
// Validates App Store Connect screenshot and app icon assets.
// For TestFlight builds, missing assets are non-blocking warnings.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const screenshotPaths = [
  'fastlane/metadata/App Store Connect/iPhone 6.7 - 1.png',
  'fastlane/metadata/App Store Connect/iPhone 6.7 - 2.png',
  'fastlane/metadata/App Store Connect/iPhone 6.7 - 3.png',
  'fastlane/metadata/App Store Connect/iPhone 6.5 - 1.png',
  'fastlane/metadata/App Store Connect/iPhone 6.5 - 2.png',
  'fastlane/metadata/App Store Connect/iPhone 6.5 - 3.png',
];

const iconPaths = [
  'fastlane/metadata/App Store Connect/AppIcon.png',
  'ios/AIBrainIM/Images.xcassets/AppIcon.appiconset/Contents.json',
];

function checkFile(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) return null;
  const stat = fs.statSync(fullPath);
  return stat.size;
}

console.log('App Store Asset Validation (TestFlight mode)');
console.log('============================================');

let screenshotCount = 0;
for (const p of screenshotPaths) {
  const size = checkFile(p);
  if (size) { console.log(`OK: ${p}`); screenshotCount++; }
  else console.log(`MISSING: ${p} (will be flagged by App Store Connect)`);
}

let iconOk = false;
for (const p of iconPaths) {
  const size = checkFile(p);
  if (size) { console.log(`OK: ${p}`); iconOk = true; break; }
  else console.log(`MISSING: ${p}`);
}
if (!iconOk) console.log('WARN: No AppIcon found');

console.log('');
console.log(`Screenshots: ${screenshotCount}/${screenshotPaths.length}`);
console.log(`AppIcon: ${iconOk ? 'present' : 'MISSING'}`);
console.log('');
console.log('App Store asset check complete (TestFlight - non-blocking).');
process.exit(0);
