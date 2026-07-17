/**
 * RemoteConnectionTester — 远程 Gateway 连通性测试
 *
 * 测试目标：
 * 1. OpenClaw Gateway HTTPS 连通性
 * 2. sessions_list API（鉴权测试）
 * 3. sessions_send API（发消息测试）
 * 4. Hermes session（独立 AI 系统）是否存在
 */

import {getGatewayConfig} from './gatewayConfig';

const TIMEOUT_MS = 15000;

export interface ConnectionTestResult {
  endpoint: string;
  method: string;
  status: number;
  ok: boolean;
  durationMs: number;
  error?: string;
  responsePreview?: string;
}

export interface FullTestReport {
  timestamp: string;
  gatewayUrl: string;
  sessionKey: string;
  directMode: boolean;
  tests: ConnectionTestResult[];
  hermesSessionKey: string | null;
  hermesTest: ConnectionTestResult | null;
  overallStatus: 'PASS' | 'PARTIAL' | 'FAIL';
  recommendations: string[];
}

async function measureTime<T>(fn: () => Promise<T>): Promise<{result: T; durationMs: number}> {
  const start = Date.now();
  const result = await fn();
  return {result, durationMs: Date.now() - start};
}

async function testEndpoint(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<ConnectionTestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal as AbortSignal,
    });
    clearTimeout(timer);
    const durationMs = Date.now() - start;
    let responsePreview: string | undefined;
    try {
      const text = await res.text();
      responsePreview = text.slice(0, 500);
    } catch { /* ignore */ }
    return {endpoint: url, method, status: res.status, ok: res.ok, durationMs, responsePreview};
  } catch (err) {
    clearTimeout(timer);
    const durationMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    return {endpoint: url, method, status: 0, ok: false, durationMs, error};
  }
}

function buildMarkdownReport(report: FullTestReport): string {
  const lines: string[] = [
    '# AIBrainIM 远程连接测试报告',
    '',
    `> 测试时间：${report.timestamp}`,
    `> Gateway：${report.gatewayUrl}`,
    `> Session Key：${report.sessionKey}`,
    '',
    `## 总体状态：${report.overallStatus}`,
    '',
    '## 测试详情',
    '',
  ];
  for (const test of report.tests) {
    const icon = test.ok ? '✅' : '❌';
    lines.push(`### ${icon} ${test.method} ${test.endpoint}`);
    lines.push('');
    lines.push(`- **状态码**：${test.status}`);
    lines.push(`- **耗时**：${test.durationMs}ms`);
    if (test.error) lines.push(`- **错误**：${test.error}`);
    if (test.responsePreview) lines.push(`- **响应预览**：\`\`\`\n${test.responsePreview}\n\`\`\``);
    lines.push('');
  }
  if (report.hermesTest) {
    const h = report.hermesTest;
    const hIcon = h.ok ? '✅' : '❌';
    lines.push('## Hermes Session 测试');
    lines.push('');
    lines.push(`### ${hIcon} ${h.method} ${h.endpoint}`);
    lines.push('');
    lines.push(`- **状态码**：${h.status}`);
    lines.push(`- **耗时**：${h.durationMs}ms`);
    if (h.error) lines.push(`- **错误**：${h.error}`);
    if (h.responsePreview) lines.push(`- **响应预览**：${h.responsePreview.slice(0, 300)}`);
    lines.push('');
  }
  if (report.recommendations.length > 0) {
    lines.push('## 建议与后续步骤');
    lines.push('');
    for (const rec of report.recommendations) lines.push(`- ${rec}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('*此报告由 AIBrainIM RemoteConnectionTester 自动生成*');
  return lines.join('\n');
}

/**
 * 执行完整连接测试（可在 RN App 启动时调用）
 */
export async function runConnectionTest(): Promise<FullTestReport> {
  const config = await getGatewayConfig();
  const {gatewayUrl, gatewayToken, sessionKey, directMode} = config;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${gatewayToken}`,
    'Content-Type': 'application/json',
  };
  const results: ConnectionTestResult[] = [];

  // Test 1: /tools/invoke reachability
  const t1 = await measureTime(() =>
    testEndpoint(`${gatewayUrl}/tools/invoke`, 'POST', headers, JSON.stringify({tool: 'sessions', action: 'list', args: {}})),
  );
  const r1 = t1.result; r1.durationMs = t1.durationMs; results.push(r1);

  // Test 2: sessions_list
  const t2 = await measureTime(() =>
    testEndpoint(`${gatewayUrl}/tools/invoke`, 'POST', headers, JSON.stringify({tool: 'sessions', action: 'list', args: {}})),
  );
  const r2 = t2.result; r2.durationMs = t2.durationMs; results.push(r2);

  // Test 3: sessions_send if directMode
  let sessionsSendResult: {result: ConnectionTestResult, durationMs: number} | null = null;
  if (directMode && sessionKey) {
    sessionsSendResult = await measureTime(() =>
      testEndpoint(
        `${gatewayUrl}/api/sessions/${encodeURIComponent(sessionKey)}/messages`,
        'POST',
        headers,
        JSON.stringify({content: 'test', role: 'user'}),
      ),
    );
    if (sessionsSendResult) { const r3 = sessionsSendResult.result; r3.durationMs = sessionsSendResult.durationMs; results.push(r3); }
  }

  // Hermes candidates
  const hermesCandidates = [
    'agent:hermes:feishu:direct:ou_9782bd16e99998d38b13d05ff5cb648c',
    'session:hermes',
    'agent:hermes',
    'hermes',
  ];
  let hermesTest: {result: ConnectionTestResult, durationMs: number} | null = null;
  let hermesSessionKey: string | null = null;
  for (const candidate of hermesCandidates) {
    hermesTest = await measureTime(() =>
      testEndpoint(
        `${gatewayUrl}/api/sessions/${encodeURIComponent(candidate)}/messages`,
        'POST',
        headers,
        JSON.stringify({content: 'ping', role: 'user'}),
      ),
    );
    if (hermesTest && (hermesTest.result.ok || (hermesTest.result.status >= 200 && hermesTest.result.status < 500))) {
      hermesSessionKey = candidate;
      break;
    }
  }

  // Build recommendations
  const recommendations: string[] = [];
  const authErrors = results.filter(r => r.status === 401 || r.status === 403);
  const networkErrors = results.filter(r => !r.ok && (r.error?.includes('abort') || r.error?.includes('network') || r.error?.includes('ENOTFOUND') || r.error?.includes('timeout') || r.error?.includes('Timeout') || r.error?.includes('Network request failed')));

  if (authErrors.length > 0) {
    recommendations.push('🔐 Token 鉴权失败（401/403）。请确认 `openclaw.json` 中的 `gateway.auth.token` 与本配置一致。');
  }
  if (networkErrors.length > 0 || results.filter(r => r.ok).length === 0) {
    recommendations.push('🌐 网络连接失败。请确认：');
    recommendations.push('  1. Mac mini 已开机并运行 OpenClaw Gateway');
    recommendations.push('  2. Tailscale 已安装并连接到 tailnet（当前 URL: `node.tail67ac15.ts.net`）');
    recommendations.push('  3. Gateway 在 Mac mini 上以 `openclaw gateway start` 运行中');
    recommendations.push('  4. Mac mini 防火墙允许 18789 端口入站');
  }
  if (!hermesSessionKey) {
    recommendations.push('❓ 未找到 Hermes session key。请在 Mac mini 上运行 `openclaw sessions list` 查找 Hermes 相关 session。');
  }

  let overallStatus: 'PASS' | 'PARTIAL' | 'FAIL' = 'PASS';
  if (authErrors.length > 0) overallStatus = 'PARTIAL';
  if (networkErrors.length > 0 || results.filter(r => r.ok).length === 0) overallStatus = 'FAIL';

  const report: FullTestReport = {
    timestamp: new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'}),
    gatewayUrl,
    sessionKey,
    directMode,
    tests: results,
    hermesSessionKey,
    hermesTest: hermesTest ? hermesTest.result : null,
    overallStatus,
    recommendations,
  };

  // Try to write report file (works in Node dev environment)
  try {
    const fs = require('fs');
    const path = require('path');
    const reportPath = '/Users/zz/.tungsten_codex/AIBrainIM/连接测试报告.md';
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(reportPath, buildMarkdownReport(report), 'utf8');
    console.log(`[RemoteConnectionTester] Report: ${reportPath}`);
  } catch (e) {
    console.warn('[RemoteConnectionTester] Could not write report:', e);
    // Fallback: log to console in RN
    console.log('[RemoteConnectionTester] Report:', JSON.stringify(report, null, 2));
  }

  return report;
}

/**
 * Simple connectivity check — returns true if gateway is reachable
 */
export async function isGatewayReachable(): Promise<boolean> {
  try {
    const config = await getGatewayConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${config.gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.gatewayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({tool: 'sessions', action: 'list', args: {}}),
      signal: controller.signal as AbortSignal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
