const runtimeProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}}).process;

export interface AppleReleaseStatus {
  applePrerequisitesReady: boolean;
  source: 'global-override' | 'env' | 'default';
  summary: string;
  validatedAt?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIBRAINIM_RELEASE_CHANNEL__:
    | {
        applePrerequisitesReady?: boolean;
        validatedAt?: number;
      }
    | undefined;
}

function parseBoolean(value?: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'ready', 'ok'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'not-ready'].includes(normalized)) return false;
  return undefined;
}

function buildSummary(ready: boolean, source: AppleReleaseStatus['source']): string {
  if (ready) {
    return source === 'global-override'
      ? 'Apple 前置校验已由运行态覆盖标记为通过'
      : source === 'env'
        ? 'Apple 前置校验已由环境标记为通过'
        : 'Apple 前置校验已通过';
  }

  return source === 'global-override'
    ? 'Apple 前置校验被运行态显式标记为未通过'
    : source === 'env'
      ? 'Apple 前置校验尚未由环境标记为通过'
      : 'Apple Developer / App Store Connect / GitHub CI 变量仍待补齐';
}

export function getAppleReleaseStatus(): AppleReleaseStatus {
  const runtimeOverride = globalThis.__AIBRAINIM_RELEASE_CHANNEL__;

  if (typeof runtimeOverride?.applePrerequisitesReady === 'boolean') {
    return {
      applePrerequisitesReady: runtimeOverride.applePrerequisitesReady,
      source: 'global-override',
      summary: buildSummary(runtimeOverride.applePrerequisitesReady, 'global-override'),
      validatedAt: runtimeOverride.validatedAt,
    };
  }

  const envReady = parseBoolean(
    runtimeProcess?.env?.AIBRAINIM_APPLE_PREREQUISITES_READY
      ?? runtimeProcess?.env?.APPLE_PREREQUISITES_READY
      ?? runtimeProcess?.env?.REACT_NATIVE_APPLE_PREREQUISITES_READY,
  );

  if (typeof envReady === 'boolean') {
    return {
      applePrerequisitesReady: envReady,
      source: 'env',
      summary: buildSummary(envReady, 'env'),
    };
  }

  return {
    applePrerequisitesReady: false,
    source: 'default',
    summary: buildSummary(false, 'default'),
  };
}
