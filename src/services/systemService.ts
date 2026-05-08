/**
 * systemService.ts — Mac mini 系统状态服务（stub）
 *
 * 实际执行逻辑在 SystemStatusScreen / CronManagerScreen / CommandTerminalScreen
 * 中通过 gatewayInvoke('exec', 'run', {...}) 调用。
 *
 * 本文件保留类型定义，供跨屏幕共享。
 */

import type { GatewayConfig } from './gatewayConfig';

export interface SystemInfo {
  hostname: string;
  osVersion: string;
  uptime: string;
  cpuBrand: string;
  cpuCores: number;
  memoryTotalGB: number;
  memoryUsedGB: number;
  memoryPct: number;
  diskTotalGB: number;
  diskUsedGB: number;
  diskFreeGB: number;
  diskPct: number;
  openclawPID: number | null;
  openclawVersion: string;
  openclawStatus: 'running' | 'stopped' | 'unknown';
  lastUpdated: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpuPct: number;
  memMB: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  nextRun: string;
  enabled: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'failed' | 'running';
  lastDuration?: string;
}

/**
 * 通过 Gateway exec 工具在 Mac mini 上执行任意命令
 */
export async function runCommand(
  cmd: string,
  config: GatewayConfig,
  timeoutMs = 30000,
): Promise<{stdout: string; stderr: string; exitCode: number}> {
  const result = await (async () => {
    const {gatewayInvoke} = await import('../data/api');
    return gatewayInvoke('exec', 'run', {
      command: cmd,
      workdir: '/Users/zz',
      timeoutMs,
    });
  })() as {stdout?: string; stdoutText?: string; stderr?: string; stderrText?: string; exitCode?: number} | null;
  return {
    stdout: (result?.stdout ?? result?.stdoutText ?? '').trim(),
    stderr: (result?.stderr ?? result?.stderrText ?? '').trim(),
    exitCode: typeof result?.exitCode === 'number' ? result.exitCode : 0,
  };
}
