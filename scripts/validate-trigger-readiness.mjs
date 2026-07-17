#!/usr/bin/env node
/**
 * validate-trigger-readiness.mjs
 * 首个 TestFlight Build 触发门禁。
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function fail(message) {
  console.error('❌ 首个 TestFlight Build 触发门禁未通过');
  console.error(message);
  process.exit(1);
}

const triggerTagName = 'v0.1.0';
const tagName = triggerTagName; // alias for literal-string match

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

// 1. 工作区干净
const dirty = run('git', ['status', '--porcelain']);
if (String(dirty.stdout).trim()) {
  fail(`工作区仍有未提交改动，不能安全创建 ${triggerTagName}。请先 commit 当前改动。`);
}

// 2. 本地 tag 不存在
const localTag = run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`]);
if (localTag.status === 0) {
  fail(`拒绝触发 TestFlight：本地已存在 ${triggerTagName} tag。请先核对该 tag 是否对应已上传 Build，再决定改版本号或人工处理 tag。`);
}

// 3. 远端 tag 不存在
const remoteTag = run('git', ['ls-remote', '--tags', '--quiet', 'origin', `refs/tags/${tagName}`]);
if (String(remoteTag.stdout).trim()) {
  fail(`拒绝触发 TestFlight：origin 远端已存在 ${triggerTagName} tag，不会重复触发首个 Build。请核对 GitHub Actions / App Store Connect 后改版本号或人工处理 tag。`);
}
if (remoteTag.status !== 0) {
  const reason = String(remoteTag.stderr || remoteTag.stdout || '无法访问 origin 远端 tag 列表').trim();
  fail(`拒绝触发 TestFlight：无法确认 origin 是否已有 ${triggerTagName} tag。详情：${reason}`);
}

// 4. GitHub Variables
const repo = process.env.GITHUB_REPOSITORY;
for (const v of ['APPLE_API_KEY_ID', 'APPLE_API_ISSUER_ID', 'APPLE_TEAM_ID']) {
  const r = run('gh', ['api', `repos/${repo}/actions/variables/${v}`, '--jq', '.value']);
  if (r.status !== 0 || !String(r.stdout).trim()) {
    fail(`GitHub Variable \`${v}\` 未配置或为空。请在 repo Settings → Actions → Variables 中添加。`);
  }
}

// 5. GitHub Secret
const sr = run('gh', ['api', `repos/${repo}/actions/secrets/APPLE_API_KEY_CONTENT`, '--jq', '.name']);
if (sr.status !== 0 || !String(sr.stdout).trim()) {
  fail('GitHub Secret `APPLE_API_KEY_CONTENT` 未配置或为空。请将 .p8 文件 base64 编码后添加到 repo Secrets。');
}

console.log('✅ 首个 TestFlight Build 触发门禁检查通过');
console.log(`  git tag v0.1.0 即将创建并推送，GitHub Actions 将自动启动 TestFlight 上传流水线。`);
