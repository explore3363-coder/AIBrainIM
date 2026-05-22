#!/usr/bin/env node
// Validates that App Store Connect screenshot and app icon assets exist.
// Placeholder assets are accepted for initial TestFlight builds.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredScreenshots = [
  'fastlane/metadata/App Store Connect/iPhone 6.7 - 1.png',
  'fastlane/metadata/App Store Connect/iPhone 6.7 - 2.png',
  'fastlane/metadata/App Store Connect/iPhone 6.7 - 3.png',
  'fastlane/metadata/App Store Connect/iPhone 6.5 - 1.png',
  'fastlane/metadata/App Store Connect/iPhone 6.5 - 2.png',
  'fastlane/metadata/App Store Connect/iPhone 6.5 - 3.png',
];

const requiredAppIcon = [
  'fastlane/metadata/App Store Connect/AppIcon.png',
];

const errors = [];
const warnings = [];
const infos = [];

function checkFile(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing: ${relPath}`);
    return false;
  }
  const stat = fs.statSync(fullPath);
  if (stat.size === 0) {
    errors.push(`Empty file: ${relPath}`);
    return false;
  }
  infos.push(`OK: ${relPath} (${(stat.size / 1024).toFixed(1)} KB)`);
  return true;
}

console.log('App Store Asset Validation');
console.log('==========================');
console.log('');

console.log('Checking App Icon...');
let iconOk = false;
for (const icon of requiredAppIcon) {
  if (checkFile(icon)) { iconOk = true; break; }
}
if (!iconOk) warnings.push('AppIcon.png not found — will warn in App Store Connect');

console.log('');
console.log('Checking Screenshots...');
let screenshotCount = 0;
for (const shot of requiredScreenshots) {
  if (checkFile(shot)) screenshotCount++;
}
console.log(`Screenshots present: ${screenshotCount}/${requiredScreenshots.length}`);
if (screenshotCount < 1) {
  warnings.push(`No screenshots found — Apple requires at least 1`);
}

for (const info of infos) console.log(info);

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings (non-blocking):');
  for (const w of warnings) console.log(`  WARN: ${w}`);
}

if (errors.length > 0) {
  console.error('');
  console.error('Errors (blocking):');
  for (const e of errors) console.error(`  ERROR: ${e}`);
  console.error('App Store asset validation failed.');
  process.exit(1);
}

console.log('');
console.log('App Store asset validation passed (placeholders acceptable for TestFlight).');
process.exit(0);
