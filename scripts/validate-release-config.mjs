#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const expectedBundleId = 'com.openclaw.aibrainim';

const checks = [
  {
    file: 'ios/AIBrainIM.xcodeproj/project.pbxproj',
    pattern: /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g,
    expected: expectedBundleId,
    label: 'iOS Xcode PRODUCT_BUNDLE_IDENTIFIER',
  },
  {
    file: 'ios/fastlane/Appfile',
    pattern: /app_identifier\("([^"]+)"\)/g,
    expected: expectedBundleId,
    label: 'fastlane app_identifier',
  },
  {
    file: 'README.md',
    pattern: /\| Bundle ID \| `([^`]+)` \|/g,
    expected: expectedBundleId,
    label: 'README Bundle ID',
  },
  {
    file: 'APP_STORE_READINESS.md',
    pattern: /Bundle ID：`([^`]+)`/g,
    expected: expectedBundleId,
    label: 'APP_STORE_READINESS Bundle ID',
  },
  {
    file: 'TESTFLIGHT.md',
    pattern: /\| 套装 ID \| `([^`]+)` \|/g,
    expected: expectedBundleId,
    label: 'TESTFLIGHT Bundle ID',
  },
  {
    file: 'APPSTORE_LISTING.md',
    pattern: /\| \*\*Bundle ID\*\* \| `([^`]+)` \|/g,
    expected: expectedBundleId,
    label: 'APPSTORE_LISTING Bundle ID',
  },
];

function readFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

function collectMatches(content, pattern) {
  const matches = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

const errors = [];
const summary = [];

summary.push(`Repo root: ${repoRoot}`);

for (const check of checks) {
  const content = readFile(check.file);
  const matches = collectMatches(content, new RegExp(check.pattern));

  if (matches.length === 0) {
    errors.push(`${check.label}: no match found in ${check.file}`);
    continue;
  }

  const uniqueValues = [...new Set(matches)];
  summary.push(`${check.label}: ${uniqueValues.join(', ')}`);

  if (uniqueValues.length !== 1) {
    errors.push(`${check.label}: found multiple values in ${check.file} → ${uniqueValues.join(', ')}`);
    continue;
  }

  if (uniqueValues[0] !== check.expected) {
    errors.push(`${check.label}: expected ${check.expected}, got ${uniqueValues[0]}`);
  }
}

const workflowContent = readFile('.github/workflows/testflight.yml');
if (!workflowContent.includes('--apiKey "$ASC_KEY_ID"')) {
  errors.push('TestFlight workflow upload step must use --apiKey "$ASC_KEY_ID" to match the decoded App Store Connect key.');
} else {
  summary.push('TestFlight upload step: uses ASC_KEY_ID');
}

if (!workflowContent.includes('ASC_KEY_ID: ${{ vars.APPLE_API_KEY_ID }}')) {
  errors.push('Workflow env must map ASC_KEY_ID from vars.APPLE_API_KEY_ID.');
} else {
  summary.push('Workflow env: ASC_KEY_ID <- vars.APPLE_API_KEY_ID');
}

if (!workflowContent.includes('ASC_ISSUER_ID: ${{ vars.APPLE_API_ISSUER_ID }}')) {
  errors.push('Workflow env must map ASC_ISSUER_ID from vars.APPLE_API_ISSUER_ID.');
} else {
  summary.push('Workflow env: ASC_ISSUER_ID <- vars.APPLE_API_ISSUER_ID');
}

const packageJson = JSON.parse(readFile('package.json'));
const scripts = packageJson?.scripts ?? {};
if (scripts['validate:testflight'] !== 'bash scripts/validate-testflight-inputs.sh') {
  errors.push('package.json must expose validate:testflight -> bash scripts/validate-testflight-inputs.sh');
} else {
  summary.push('package.json: validate:testflight script present');
}

if (scripts['test:release'] !== 'jest --runInBand --detectOpenHandles __tests__/releaseReadiness.test.ts __tests__/releaseChannel.test.ts __tests__/uploadReleaseEvidence.test.ts __tests__/DashboardScreen.test.tsx __tests__/ProfileScreen.test.tsx __tests__/ProjectLibraryScreen.test.tsx __tests__/UploadScreen.test.tsx') {
  errors.push('package.json must expose test:release -> jest --runInBand --detectOpenHandles __tests__/releaseReadiness.test.ts __tests__/releaseChannel.test.ts __tests__/uploadReleaseEvidence.test.ts __tests__/DashboardScreen.test.tsx __tests__/ProfileScreen.test.tsx __tests__/ProjectLibraryScreen.test.tsx __tests__/UploadScreen.test.tsx');
} else {
  summary.push('package.json: test:release script present');
}

if (scripts['validate:release-config'] !== 'node scripts/validate-release-config.mjs') {
  errors.push('package.json must expose validate:release-config -> node scripts/validate-release-config.mjs');
} else {
  summary.push('package.json: validate:release-config script present');
}

if (scripts['validate:assets'] !== 'node scripts/validate-appstore-assets.mjs') {
  errors.push('package.json must expose validate:assets -> node scripts/validate-appstore-assets.mjs');
} else {
  summary.push('package.json: validate:assets script present');
}

if (scripts['sync:release-status'] !== 'node scripts/sync-release-status.mjs') {
  errors.push('package.json must expose sync:release-status -> node scripts/sync-release-status.mjs');
} else {
  summary.push('package.json: sync:release-status script present');
}

if (scripts['preflight:testflight'] !== 'node scripts/preflight-testflight.mjs') {
  errors.push('package.json must expose preflight:testflight -> node scripts/preflight-testflight.mjs');
} else {
  summary.push('package.json: preflight:testflight script present');
}

if (scripts['validate:trigger-readiness'] !== 'node scripts/validate-trigger-readiness.mjs') {
  errors.push('package.json must expose validate:trigger-readiness -> node scripts/validate-trigger-readiness.mjs');
} else {
  summary.push('package.json: validate:trigger-readiness script present');
}

if (scripts['trigger:testflight'] !== 'node scripts/trigger-testflight.mjs') {
  errors.push('package.json must expose trigger:testflight -> node scripts/trigger-testflight.mjs so tag/push stays behind the guarded trigger entry.');
} else {
  summary.push('package.json: trigger:testflight guarded script present');
}

const triggerContent = readFile('scripts/trigger-testflight.mjs');
if (!triggerContent.includes("run('npm', ['run', 'preflight:testflight']") || !triggerContent.includes("run('npm', ['run', 'validate:trigger-readiness']")) {
  errors.push('trigger:testflight must run preflight:testflight and validate:trigger-readiness before creating or pushing the v0.1.0 tag.');
} else {
  summary.push('trigger:testflight: runs preflight and trigger-readiness gates first');
}

if (!triggerContent.includes("run('git', ['tag', triggerTagName]") || !triggerContent.includes("run('git', ['push', 'origin', 'main', triggerTagName]")) {
  errors.push('trigger:testflight must create and push the v0.1.0 tag only after guarded checks pass.');
} else {
  summary.push('trigger:testflight: creates and pushes v0.1.0 after gates pass');
}

if (!triggerContent.includes("git', ['status', '--porcelain']") || !triggerContent.includes('工作区仍有未提交改动')) {
  errors.push('trigger:testflight must independently block dirty working trees immediately before tag creation.');
} else {
  summary.push('trigger:testflight: blocks dirty working tree immediately before tag creation');
}

if (!triggerContent.includes('refs/tags/${triggerTagName}') || !triggerContent.includes('origin 远端已存在 ${triggerTagName} tag')) {
  errors.push('trigger:testflight must independently block duplicate local or remote v0.1.0 tags immediately before push.');
} else {
  summary.push('trigger:testflight: blocks duplicate local or remote v0.1.0 tags');
}

const preflightContent = readFile('scripts/preflight-testflight.mjs');
if (!preflightContent.includes('release-readiness.json') || !preflightContent.includes('release-readiness.md')) {
  errors.push('preflight:testflight must write release-readiness.json and release-readiness.md for TestFlight handoff evidence.');
} else {
  summary.push('preflight:testflight: writes release readiness handoff reports');
}

const syncReleaseStatusContent = readFile('scripts/sync-release-status.mjs');
if (!syncReleaseStatusContent.includes('preflightNextActions')) {
  errors.push('sync:release-status must preserve preflight nextActions so the app can show actionable TestFlight recovery steps.');
} else {
  summary.push('sync:release-status: preserves preflight nextActions');
}

const triggerReadinessContent = readFile('scripts/validate-trigger-readiness.mjs');
if (!triggerReadinessContent.includes('首个 TestFlight Build 触发门禁未通过') || !triggerReadinessContent.includes('git tag v0.1.0')) {
  errors.push('validate:trigger-readiness must fail closed before tag/push and print the final v0.1.0 trigger command only after all gates pass.');
} else {
  summary.push('validate:trigger-readiness: fails closed before final tag/push');
}

if (!triggerReadinessContent.includes("git', ['status', '--porcelain']") || !triggerReadinessContent.includes('工作区仍有未提交改动')) {
  errors.push('validate:trigger-readiness must fail closed when the working tree is dirty, so trigger:testflight cannot tag an uncommitted or drifting snapshot.');
} else {
  summary.push('validate:trigger-readiness: blocks dirty working tree before tag/push');
}

if (!triggerReadinessContent.includes('refs/tags/${tagName}') || !triggerReadinessContent.includes('本地已存在 ${triggerTagName} tag')) {
  errors.push('validate:trigger-readiness must fail closed when the local v0.1.0 tag already exists, so trigger:testflight cannot accidentally skip tag creation and push an old tag.');
} else {
  summary.push('validate:trigger-readiness: blocks duplicate local v0.1.0 tag before push');
}

if (!triggerReadinessContent.includes("git', ['ls-remote', '--tags', '--quiet', 'origin'") || !triggerReadinessContent.includes('origin 远端已存在 ${triggerTagName} tag')) {
  errors.push('validate:trigger-readiness must fail closed when the remote v0.1.0 tag already exists or cannot be checked, so trigger:testflight cannot duplicate a previously triggered build.');
} else {
  summary.push('validate:trigger-readiness: blocks duplicate or unverified remote v0.1.0 tag before push');
}

const packageNodeRange = packageJson?.engines?.node;
if (packageNodeRange !== '>= 22.11.0') {
  errors.push(`package.json engines.node must stay pinned to >= 22.11.0, got ${packageNodeRange ?? 'undefined'}`);
} else {
  summary.push(`package.json: engines.node ${packageNodeRange}`);
}

const ciWorkflowContent = readFile('.github/workflows/ci.yml');
if (!ciWorkflowContent.includes('NODE_VERSION: "22"')) {
  errors.push('CI workflow must keep NODE_VERSION pinned to 22 to match package.json engines.node.');
} else {
  summary.push('CI workflow: NODE_VERSION pinned to 22');
}

if (!workflowContent.includes('node-version: 22')) {
  errors.push('TestFlight workflow must use Node 22 to match package.json engines.node.');
} else {
  summary.push('TestFlight workflow: node-version 22');
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

for (const line of summary) {
  console.log(`OK: ${line}`);
}
console.log('Release config looks consistent.');
