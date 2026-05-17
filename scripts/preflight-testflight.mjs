#!/usr/bin/env node

import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const buildDir = path.join(repoRoot, 'build');
const reportJsonPath = path.join(buildDir, 'release-readiness.json');
const reportMarkdownPath = path.join(buildDir, 'release-readiness.md');

const steps = [
  {label: 'TypeScript 校验', command: 'npm', args: ['run', 'typecheck']},
  {label: '提测关键测试', command: 'npm', args: ['run', 'test:release']},
  {label: 'TestFlight 输入预检', command: 'npm', args: ['run', 'validate:testflight']},
  {label: '发布配置校验', command: 'npm', args: ['run', 'validate:release-config']},
  {label: 'App Store 素材校验', command: 'npm', args: ['run', 'validate:assets']},
];

function ensureBuildDir() {
  fs.mkdirSync(buildDir, {recursive: true});
}

function normalizeOutput(value) {
  return String(value ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-20);
}

function summarizeFailures(failures) {
  if (failures.length === 0) {
    return '代码、测试、Apple 前置项、发布配置与 App Store 素材校验均已通过。';
  }

  return `仍有 ${failures.length} 个提测阻塞：${failures.map(item => item.label).join('、')}。`;
}

function buildNextActions(failures) {
  if (failures.length === 0) {
    return [
      '可以继续执行 npm run trigger:testflight；脚本会先复跑总预检、再校验触发门禁，最后才打 v0.1.0 tag 并 push。',
      '确认 GitHub Actions TestFlight workflow 正常归档并上传。',
      '到 App Store Connect 的 TestFlight 页面添加测试人员并做真机安装验证。',
    ];
  }

  return failures.map(item => {
    if (item.label.includes('TestFlight 输入预检')) {
      return '先补 Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets，再重新跑 npm run preflight:testflight。';
    }
    if (item.label.includes('App Store 素材')) {
      return '先补齐或重生成 App Icon、三尺寸截图、隐私页，再重新跑 npm run validate:assets。';
    }
    if (item.label.includes('发布配置')) {
      return '先修正 Bundle ID、workflow、文档或 package.json 发布脚本漂移，再重新跑 npm run validate:release-config。';
    }
    if (item.label.includes('提测关键测试')) {
      return '先修复提测关键测试失败项，再重新跑 npm run test:release。';
    }
    if (item.label.includes('TypeScript')) {
      return '先修复类型错误，再重新跑 npm run typecheck。';
    }
    if (item.label.includes('同步 releaseStatus')) {
      return '先修复 releaseStatus.generated.ts 同步脚本或其依赖校验，再重新跑 npm run sync:release-status。';
    }
    return `先处理「${item.label}」失败项，再重新跑预检。`;
  });
}

function writeReadinessReport(report) {
  ensureBuildDir();
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const markdown = [
    '# Release Readiness Report',
    '',
    `- Generated At: ${report.generatedAt}`,
    `- Overall Status: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Summary: ${report.summary}`,
    '',
    '## Steps',
    '',
    ...report.steps.map(step => `- [${step.ok ? 'x' : ' '}] ${step.label}（exit ${step.status}，${step.durationMs}ms）`),
    '',
    '## Next Actions',
    '',
    ...report.nextActions.map(action => `- ${action}`),
  ].join('\n');

  fs.writeFileSync(reportMarkdownPath, `${markdown}\n`);
}

function runStep(step) {
  console.log(`\n▶ ${step.label}`);
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const status = typeof result.status === 'number' ? result.status : 1;
  const durationMs = Date.now() - startedAt;
  console.log(status === 0 ? `✓ ${step.label}通过` : `✗ ${step.label}失败（exit ${status}）`);

  return {
    label: step.label,
    status,
    ok: status === 0,
    durationMs,
    stdoutTail: normalizeOutput(result.stdout),
    stderrTail: normalizeOutput(result.stderr),
  };
}

const stepResults = [];
const failures = [];
for (const step of steps) {
  const result = runStep(step);
  stepResults.push(result);
  if (!result.ok) {
    failures.push({label: result.label, status: result.status});
  }
}

const preSyncReport = {
  generatedAt: new Date().toISOString(),
  ok: failures.length === 0,
  summary: summarizeFailures(failures),
  steps: stepResults,
  failures,
  failedChecks: failures.map(item => item.label),
  blockingCount: failures.length,
  nextActions: buildNextActions(failures),
};
writeReadinessReport(preSyncReport);
console.log(`\nℹ️ 已先写出本轮预检报告，供 release status 同步读取：${path.relative(repoRoot, reportJsonPath)}`);

console.log('\n▶ 同步 releaseStatus.generated.ts');
const syncStartedAt = Date.now();
const syncResult = spawnSync('npm', ['run', 'sync:release-status'], {
  cwd: repoRoot,
  env: process.env,
  encoding: 'utf8',
});
if (syncResult.stdout) process.stdout.write(syncResult.stdout);
if (syncResult.stderr) process.stderr.write(syncResult.stderr);
const syncStatus = typeof syncResult.status === 'number' ? syncResult.status : 1;
const syncDurationMs = Date.now() - syncStartedAt;
const syncStep = {
  label: '同步 releaseStatus.generated.ts',
  status: syncStatus,
  ok: syncStatus === 0,
  durationMs: syncDurationMs,
  stdoutTail: normalizeOutput(syncResult.stdout),
  stderrTail: normalizeOutput(syncResult.stderr),
};
stepResults.push(syncStep);
if (syncStatus !== 0) {
  failures.push({label: '同步 releaseStatus.generated.ts', status: syncStatus});
  console.log(`✗ 同步 releaseStatus.generated.ts 失败（exit ${syncStatus}）`);
} else {
  console.log('✓ releaseStatus.generated.ts 已同步');
}

const report = {
  generatedAt: new Date().toISOString(),
  ok: failures.length === 0,
  summary: summarizeFailures(failures),
  steps: stepResults,
  failures,
  failedChecks: failures.map(item => item.label),
  blockingCount: failures.length,
  nextActions: buildNextActions(failures),
};

writeReadinessReport(report);
console.log(`\nℹ️ 已写出提测报告：${path.relative(repoRoot, reportJsonPath)} / ${path.relative(repoRoot, reportMarkdownPath)}`);
console.log('ℹ️ 预检会额外沉淀这两份 readiness 报告，便于提测交接与回看。');

if (failures.length > 0) {
  console.error('\nTestFlight 预检未通过：');
  failures.forEach(item => {
    console.error(`- ${item.label}（exit ${item.status}）`);
  });
  process.exit(1);
}

console.log('\nTestFlight 预检通过，运行态 release status 已同步。');
