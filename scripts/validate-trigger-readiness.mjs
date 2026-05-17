#!/usr/bin/env node
/**
 * validate-trigger-readiness.mjs
 * TestFlight 首个 Build 触发门禁。
 * 检查 GitHub Actions Variables / Secrets 是否已配置 Apple API 凭证。
 * 失败时打印原因并以非零退出码终止，不允许继续 tag/push。
 */

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: opts.stdio ?? 'pipe',
  });
  return r;
}

function fail(msg) {
  console.error('❌ 首个 TestFlight Build 触发门禁未通过');
  console.error(msg);
  process.exit(1);
}

function warn(msg) {
  console.warn('⚠️  ' + msg);
}

function checkVar(name) {
  const r = run('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/variables/${name}`, '--jq', '.value']);
  return r.status === 0 && String(r.stdout).trim() !== '';
}

// 检查工作区干净
const status = run('git', ['status', '--porcelain']);
if (String(status.stdout).trim()) {
  fail('工作区仍有未提交改动，不能安全触发 TestFlight Build。请先 commit 或 stash 当前改动。');
}

// 检查 GitHub Variables
const requiredVars = ['APPLE_API_KEY_ID', 'APPLE_API_ISSUER_ID', 'APPLE_TEAM_ID'];
for (const v of requiredVars) {
  if (!checkVar(v)) {
    fail(`GitHub Variable \`${v}\` 未配置或为空。请在 repo Settings → Actions → Variables 中添加。`);
  }
}

// 检查 GitHub Secret
const r = run('gh', ['api', 'repos/' + process.env.GITHUB_REPOSITORY + '/actions/secrets/APPLE_API_KEY_CONTENT', '--jq', '.name']);
if (r.status !== 0 || !String(r.stdout).trim()) {
  fail('GitHub Secret `APPLE_API_KEY_CONTENT` 未配置或为空。请在 repo Settings → Actions → Secrets 中添加（值为 .p8 文件 base64 编码内容）。');
}

console.log('✅ 首个 TestFlight Build 触发门禁检查通过');
console.log('   所有 GitHub Variables 和 Secrets 已配置');
console.log('');
console.log('  git tag v0.1.0 即将创建并推送，GitHub Actions 将自动启动 TestFlight 上传流水线。');
console.log('  完成后请在 App Store Connect → TestFlight 查看 Build 状态。');
