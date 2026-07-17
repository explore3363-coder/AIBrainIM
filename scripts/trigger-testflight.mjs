#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const triggerTagName = 'v0.1.0';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });

  if (result.error) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error.message}`);
  }

  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureCleanWorkingTree() {
  const result = run('git', ['status', '--porcelain']);
  const dirty = String(result.stdout ?? '').trim();
  if (dirty) {
    const preview = dirty.split('\n').slice(0, 12).join('；');
    const count = dirty.split('\n').length;
    const overflow = count > 12 ? `；另有 ${count - 12} 项` : '';
    fail(`拒绝触发 TestFlight：工作区仍有未提交改动，不能安全创建 ${triggerTagName}。当前改动：${preview}${overflow}`);
  }
}

function ensureTagDoesNotExist() {
  const localTag = run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${triggerTagName}`]);
  if (localTag.status === 0) {
    fail(`拒绝触发 TestFlight：本地已存在 ${triggerTagName} tag。请先核对该 tag 是否对应已上传 Build，再决定改版本号或人工处理 tag。`);
  }

  const remoteTag = run('git', ['ls-remote', '--tags', '--quiet', 'origin', `refs/tags/${triggerTagName}`]);
  if (remoteTag.status !== 0) {
    const reason = String(remoteTag.stderr || remoteTag.stdout || '无法访问 origin 远端 tag 列表').trim();
    fail(`拒绝触发 TestFlight：无法确认 origin 是否已有 ${triggerTagName} tag。详情：${reason}`);
  }
  if (String(remoteTag.stdout ?? '').trim()) {
    fail(`拒绝触发 TestFlight：origin 远端已存在 ${triggerTagName} tag，不会重复触发首个 Build。请核对 GitHub Actions / App Store Connect 后改版本号或人工处理。`);
  }
}

console.log('▶ 运行 TestFlight 总预检');
const preflight = run('npm', ['run', 'preflight:testflight'], {stdio: 'inherit'});
if (preflight.status !== 0) {
  process.exit(preflight.status ?? 1);
}

console.log('▶ 运行 TestFlight 触发门禁');
const gate = run('npm', ['run', 'validate:trigger-readiness'], {stdio: 'inherit'});
if (gate.status !== 0) {
  process.exit(gate.status ?? 1);
}

ensureCleanWorkingTree();
ensureTagDoesNotExist();

console.log(`▶ 创建 ${triggerTagName} tag`);
const tag = run('git', ['tag', triggerTagName], {stdio: 'inherit'});
if (tag.status !== 0) {
  process.exit(tag.status ?? 1);
}

console.log(`▶ 推送 main 与 ${triggerTagName} tag`);
const push = run('git', ['push', 'origin', 'main', triggerTagName], {stdio: 'inherit'});
if (push.status !== 0) {
  process.exit(push.status ?? 1);
}

console.log('TestFlight 触发完成：GitHub Actions 将根据 tag 启动上传链路。');
