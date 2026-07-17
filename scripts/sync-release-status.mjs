#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const outputFile = path.join(repoRoot, 'src/data/releaseStatus.generated.ts');

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runShell(script) {
  return spawnSync('bash', ['-lc', script], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readPreviousGeneratedReleaseStatus() {
  try {
    const content = fs.readFileSync(outputFile, 'utf8');
    const match = content.match(/export const generatedReleaseStatus = ([\s\S]*?) as const;\s*$/);
    if (!match) {
      return null;
    }
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function hasValue(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlaceholder(value) {
  return /PLACEHOLDER|placeholder|TODO|todo|CHANGEME|changeme|^YOUR_|^your_/.test(value.trim());
}

function resolveEnv(primary, fallback) {
  const primaryValue = process.env[primary];
  if (primaryValue && primaryValue.trim()) return primaryValue.trim();
  const fallbackValue = fallback ? process.env[fallback] : undefined;
  return fallbackValue?.trim() ?? '';
}

function parseBoolEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (!value) continue;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'ready', 'ok', 'uploaded'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'not-ready', 'pending'].includes(normalized)) return false;
  }
  return false;
}

function normalizeOutput(value) {
  return String(value ?? '').trim().split('\n').filter(Boolean).slice(-6).join(' | ');
}

function hasLocalTag(tagName) {
  const result = run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`]);
  return result.status === 0;
}

function hasRemoteTag(tagName) {
  const result = run('git', ['ls-remote', '--tags', '--quiet', 'origin', `refs/tags/${tagName}`]);
  if (result.status !== 0) {
    return {
      checked: false,
      exists: false,
      reason: normalizeOutput(result.stderr || result.stdout || '无法访问 origin 远端 tag 列表'),
    };
  }

  return {
    checked: true,
    exists: String(result.stdout ?? '').trim().length > 0,
  };
}

function getDirtyWorkingTreeFiles() {
  const result = run('git', ['status', '--porcelain']);
  if (result.status !== 0) {
    return ['无法读取 git 工作区状态'];
  }

  return String(result.stdout ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

const assetResult = run('node', ['scripts/validate-appstore-assets.mjs']);
const appStoreAssetsReady = assetResult.status === 0;
const previousGeneratedStatus = readPreviousGeneratedReleaseStatus();

const preflightReportPath = path.join(repoRoot, 'build', 'release-readiness.json');
let preflightReport;
try {
  preflightReport = JSON.parse(fs.readFileSync(preflightReportPath, 'utf8'));
} catch {
  preflightReport = null;
}

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value > 1e9 ? value * 1000 : undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const numeric = Number(value.trim());
  if (Number.isFinite(numeric) && /^\d+$/.test(value.trim())) {
    return numeric > 1e12 ? numeric : numeric > 1e9 ? numeric * 1000 : undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string' && value.trim() && /^\d+$/.test(value.trim())) {
    return Math.max(0, Number(value.trim()));
  }
  return 0;
}

function getPreflightStep(report, label) {
  if (!report || !Array.isArray(report.steps)) {
    return null;
  }
  return report.steps.find(step => step?.label === label) ?? null;
}

  const preflightReportGeneratedAt = parseTimestamp(preflightReport?.generatedAt);
  const preflightPassed = preflightReport?.ok === true;
  const preflightAppleStepPassed = getPreflightStep(preflightReport, 'TestFlight 输入预检')?.ok === true;
  const preflightAssetsStepPassed = getPreflightStep(preflightReport, 'App Store 素材校验')?.ok === true;
  const preflightNextActions = Array.isArray(preflightReport?.nextActions)
    ? preflightReport.nextActions.filter(item => typeof item === 'string' && item.trim())
    : [];

function resolveValidationTimestamp({
  ready,
  stepPassed,
  fallbackTimestamp,
}) {
  if (!ready) {
    return undefined;
  }

  if (stepPassed && fallbackTimestamp) {
    return fallbackTimestamp;
  }

  return undefined;
}

const appleVariables = [
  ['ASC_KEY_ID', 'APPLE_API_KEY_ID'],
  ['ASC_ISSUER_ID', 'APPLE_API_ISSUER_ID'],
  ['APPLE_TEAM_ID'],
  ['APPLE_API_KEY_CONTENT'],
];
const missingAppleInputs = appleVariables
  .filter(([primary, fallback]) => {
    const value = resolveEnv(primary, fallback);
    return !value || isPlaceholder(value);
  })
  .map(([primary, fallback]) => fallback ? `${primary}/${fallback}` : primary);

let applePrerequisitesReady = false;
let appleValidationSummary = '';
if (missingAppleInputs.length === 0) {
  const appleResult = runShell('bash scripts/validate-testflight-inputs.sh >/tmp/aibrainim-testflight-validation.log 2>&1');
  applePrerequisitesReady = appleResult.status === 0;
  appleValidationSummary = fs.existsSync('/tmp/aibrainim-testflight-validation.log')
    ? fs.readFileSync('/tmp/aibrainim-testflight-validation.log', 'utf8')
    : `${appleResult.stdout ?? ''}${appleResult.stderr ?? ''}`;
} else {
  appleValidationSummary = `Missing Apple inputs: ${missingAppleInputs.join(', ')}`;
}

const firstTestFlightBuildUploaded = parseBoolEnv(
  'AIBRAINIM_TESTFLIGHT_BUILD_UPLOADED',
  'TESTFLIGHT_BUILD_UPLOADED',
  'REACT_NATIVE_TESTFLIGHT_BUILD_UPLOADED',
);

const packageJson = readJson('package.json');
const now = Date.now();
const triggerTagName = `v${packageJson.version}`;
const dirtyWorkingTreeFiles = getDirtyWorkingTreeFiles();
const remoteTagState = hasRemoteTag(triggerTagName);
const triggerGateFailures = [];
if (dirtyWorkingTreeFiles.length > 0) {
  const preview = dirtyWorkingTreeFiles.slice(0, 12).join('；');
  const overflow = dirtyWorkingTreeFiles.length > 12 ? `；另有 ${dirtyWorkingTreeFiles.length - 12} 项` : '';
  triggerGateFailures.push(`工作区仍有未提交改动，当前不会安全触发 ${triggerTagName}：${preview}${overflow}`);
}
if (hasLocalTag(triggerTagName)) {
  triggerGateFailures.push(`本地已存在 ${triggerTagName} tag，需先人工核对是否沿用、删除重建或改版本号`);
}
if (!remoteTagState.checked) {
  triggerGateFailures.push(`无法确认 origin 远端是否已存在 ${triggerTagName} tag：${remoteTagState.reason}`);
} else if (remoteTagState.exists) {
  triggerGateFailures.push(`origin 远端已存在 ${triggerTagName} tag，当前不会重复触发首个 Build`);
}

const appleValidatedAt = resolveValidationTimestamp({
  ready: applePrerequisitesReady,
  stepPassed: preflightAppleStepPassed,
  fallbackTimestamp: preflightReportGeneratedAt ?? now,
});
const assetsValidatedAt = resolveValidationTimestamp({
  ready: appStoreAssetsReady,
  stepPassed: preflightAssetsStepPassed,
  fallbackTimestamp: preflightReportGeneratedAt ?? now,
});
const summaryParts = [];
summaryParts.push(applePrerequisitesReady
  ? (appleValidatedAt
      ? preflightPassed
        ? 'Apple / TestFlight 前置项已通过本地结构校验并完成最近一次总预检'
        : 'Apple / TestFlight 前置项已通过结构校验，且最近一次专项预检已留下时间戳'
      : 'Apple / TestFlight 前置项已通过结构校验，但最近一次专项预检还未留下可复用时间戳')
  : 'Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets 仍待补齐');
summaryParts.push(appStoreAssetsReady
  ? (assetsValidatedAt
      ? preflightPassed
        ? 'App Store 素材真值已通过仓库校验并完成最近一次总预检'
        : 'App Store 素材真值已通过仓库校验，且最近一次专项预检已留下时间戳'
      : 'App Store 素材真值已通过仓库校验，但最近一次专项预检还未留下可复用时间戳')
  : 'App Store 素材真值未通过仓库校验');
summaryParts.push(firstTestFlightBuildUploaded
  ? '首个 TestFlight Build 已被外部状态标记为上传'
  : '首个 TestFlight Build 仍待真实触发');
summaryParts.push(triggerGateFailures.length === 0
  ? `最终触发仓库态已就绪（${triggerTagName} 可安全检查）`
  : `最终触发仓库态仍有 ${triggerGateFailures.length} 个阻塞`);

const preflightSteps = Array.isArray(preflightReport?.steps)
  ? preflightReport.steps
      .filter(step => step && typeof step === 'object' && typeof step.label === 'string' && step.label.trim())
      .map(step => ({
        label: String(step.label).trim(),
        ok: step.ok === true,
        status: typeof step.status === 'number' ? step.status : undefined,
        durationMs: typeof step.durationMs === 'number' ? step.durationMs : undefined,
        stdoutTail: Array.isArray(step.stdoutTail)
          ? step.stdoutTail.map(item => String(item ?? '').trim()).filter(Boolean).slice(-6)
          : undefined,
        stderrTail: Array.isArray(step.stderrTail)
          ? step.stderrTail.map(item => String(item ?? '').trim()).filter(Boolean).slice(-6)
          : undefined,
      }))
  : undefined;

const previousLatestLiveUpload = previousGeneratedStatus?.latestLiveUpload
  && typeof previousGeneratedStatus.latestLiveUpload === 'object'
  ? previousGeneratedStatus.latestLiveUpload
  : null;
const uploadEvidence = {
  activeUploads: parseCount(previousGeneratedStatus?.activeUploads),
  completedUploads: parseCount(previousGeneratedStatus?.completedUploads),
  liveCompletedUploads: parseCount(previousGeneratedStatus?.liveCompletedUploads),
  simulatedCompletedUploads: parseCount(previousGeneratedStatus?.simulatedCompletedUploads),
  liveDispatchedOnlyUploads: parseCount(previousGeneratedStatus?.liveDispatchedOnlyUploads),
  latestLiveUploadCompletedAt: parseTimestamp(previousGeneratedStatus?.latestLiveUploadCompletedAt),
  latestLiveUpload: previousLatestLiveUpload
    ? {
        id: typeof previousLatestLiveUpload.id === 'string' && previousLatestLiveUpload.id.trim() ? previousLatestLiveUpload.id.trim() : undefined,
        name: typeof previousLatestLiveUpload.name === 'string' && previousLatestLiveUpload.name.trim() ? previousLatestLiveUpload.name.trim() : undefined,
        dispatchId: typeof previousLatestLiveUpload.dispatchId === 'string' && previousLatestLiveUpload.dispatchId.trim() ? previousLatestLiveUpload.dispatchId.trim() : undefined,
        agent: typeof previousLatestLiveUpload.agent === 'string' && previousLatestLiveUpload.agent.trim() ? previousLatestLiveUpload.agent.trim() : undefined,
        completedAt: parseTimestamp(previousLatestLiveUpload.completedAt) ?? parseTimestamp(previousGeneratedStatus?.latestLiveUploadCompletedAt),
        source: previousLatestLiveUpload.source === 'runtime' ? 'runtime' : 'release-status',
      }
    : undefined,
};
const uploadEvidenceSummary = [
  `LIVE完成 ${uploadEvidence.liveCompletedUploads}`,
  `LIVE仅分派 ${uploadEvidence.liveDispatchedOnlyUploads}`,
  `模拟完成 ${uploadEvidence.simulatedCompletedUploads}`,
  `处理中 ${uploadEvidence.activeUploads}`,
  uploadEvidence.liveCompletedUploads > 0
    ? '提测真值 已拿到 LIVE done'
    : uploadEvidence.liveDispatchedOnlyUploads > 0
      ? '提测真值 缺最终 done 回流'
      : uploadEvidence.simulatedCompletedUploads > 0
        ? '提测真值 仍是模拟样本'
        : uploadEvidence.activeUploads > 0
          ? '提测真值 等待回流'
          : '提测真值 尚无样本',
].join(' · ');

const payload = {
  applePrerequisitesReady,
  firstTestFlightBuildUploaded,
  appStoreAssetsReady,
  summary: summaryParts.join('；'),
  triggerTagName,
  triggerGateReady: triggerGateFailures.length === 0,
  triggerGateFailures: triggerGateFailures.length > 0 ? triggerGateFailures : undefined,
  validatedAt: appleValidatedAt,
  assetsValidatedAt,
  updatedAt: now,
  preflightReportGeneratedAt: preflightReport?.generatedAt,
  preflightOverallStatus: preflightPassed ? 'PASS' : preflightReport?.ok === false ? 'FAIL' : undefined,
  preflightBlockingCount: typeof preflightReport?.blockingCount === 'number' ? preflightReport.blockingCount : undefined,
  preflightFailedChecks: Array.isArray(preflightReport?.failedChecks)
    ? preflightReport.failedChecks.filter(item => typeof item === 'string' && item.trim())
    : undefined,
  preflightSteps,
  preflightNextActions: [
    ...preflightNextActions,
    ...(uploadEvidence.liveCompletedUploads <= 0
      ? ['上传提测真值仍未闭合：当前没有可复用的 LIVE done 样本，先补一条真实附件回流后再触发首个 Build。']
      : []),
    ...(uploadEvidence.liveDispatchedOnlyUploads > 0
      ? [`上传提测真值仍有尾巴：还有 ${uploadEvidence.liveDispatchedOnlyUploads} 条 LIVE 样本只到 dispatched，需等最终 done 回流或明确清理队列。`]
      : []),
    ...(triggerGateFailures.length > 0
      ? ['先清理 trigger:testflight 的仓库态阻塞（脏工作区 / 重复 tag / 远端 tag 状态不明），再触发首个 Build。']
      : []),
  ],
  activeUploads: uploadEvidence.activeUploads,
  completedUploads: uploadEvidence.completedUploads,
  liveCompletedUploads: uploadEvidence.liveCompletedUploads,
  simulatedCompletedUploads: uploadEvidence.simulatedCompletedUploads,
  liveDispatchedOnlyUploads: uploadEvidence.liveDispatchedOnlyUploads,
  latestLiveUploadCompletedAt: uploadEvidence.latestLiveUploadCompletedAt,
  latestLiveUpload: uploadEvidence.latestLiveUpload,
  uploadEvidenceSummary,
  missingAppleInputs: missingAppleInputs.length > 0 ? missingAppleInputs : undefined,
  validationDetails: {
    version: packageJson.version,
    apple: applePrerequisitesReady ? 'ok' : normalizeOutput(appleValidationSummary),
    assets: appStoreAssetsReady ? 'ok' : normalizeOutput(`${assetResult.stdout ?? ''}${assetResult.stderr ?? ''}`),
    preflight: [
      preflightReport?.summary,
      `上传提测真值：${uploadEvidenceSummary}`,
      triggerGateFailures.length > 0
        ? `trigger:testflight 门禁：${triggerGateFailures.join('；')}`
        : `trigger:testflight 门禁：仓库态已通过，可在其他门禁闭合后安全检查 ${triggerTagName}`,
    ].filter(Boolean).join(' | '),
  },
};

const fileContent = `// Auto-generated by scripts/sync-release-status.mjs.\n// Do not edit by hand; rerun npm run sync:release-status after release prechecks.\n\nexport const generatedReleaseStatus = ${JSON.stringify(payload, null, 2)} as const;\n`;

fs.writeFileSync(outputFile, fileContent);
console.log(`Release status generated: ${path.relative(repoRoot, outputFile)}`);
console.log(payload.summary);

if (!appStoreAssetsReady) {
  console.error('App Store asset validation failed; generated status keeps assets as not ready.');
  process.exitCode = 1;
}
