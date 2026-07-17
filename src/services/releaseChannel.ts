import {generatedReleaseStatus} from '../data/releaseStatus.generated';

const runtimeProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}}).process;

const generatedReleaseStatusInput = generatedReleaseStatus as unknown as Partial<ReleaseChannelPayload> | null;

export interface LatestLiveUploadTrace {
  id?: string;
  name?: string;
  dispatchId?: string;
  agent?: string;
  completedAt?: number;
  source: 'runtime' | 'release-status';
}

export interface AppleReleaseStatus {
  applePrerequisitesReady: boolean;
  firstTestFlightBuildUploaded: boolean;
  appStoreAssetsReady: boolean;
  source: 'global-override' | 'generated' | 'env' | 'default';
  summary: string;
  validatedAt?: number;
  assetsValidatedAt?: number;
  preflightReportGeneratedAt?: number;
  preflightOverallStatus?: 'PASS' | 'FAIL';
  preflightBlockingCount?: number;
  preflightFailedChecks: string[];
  preflightSteps: ReleasePreflightStep[];
  preflightNextActions: string[];
  missingAppleInputs: string[];
  triggerTagName?: string;
  triggerGateReady?: boolean;
  triggerGateFailures: string[];
  activeUploads: number;
  completedUploads: number;
  liveCompletedUploads: number;
  simulatedCompletedUploads: number;
  liveDispatchedOnlyUploads: number;
  latestLiveUploadCompletedAt?: number;
  latestLiveUpload?: LatestLiveUploadTrace;
  uploadEvidenceSummary?: string;
  appleValidationDetail?: string;
  assetsValidationDetail?: string;
  preflightValidationDetail?: string;
}

export interface ReleasePreflightStep {
  label: string;
  ok: boolean;
  status?: number;
  durationMs?: number;
  stdoutTail: string[];
  stderrTail: string[];
}

interface ReleaseValidationDetails {
  apple?: string;
  assets?: string;
  preflight?: string;
}

interface ReleaseChannelPayload {
  applePrerequisitesReady?: boolean;
  firstTestFlightBuildUploaded?: boolean;
  appStoreAssetsReady?: boolean;
  summary?: string;
  validatedAt?: string | number;
  assetsValidatedAt?: string | number;
  updatedAt?: string | number;
  preflightReportGeneratedAt?: string | number;
  preflightOverallStatus?: 'PASS' | 'FAIL';
  preflightBlockingCount?: number;
  preflightFailedChecks?: readonly string[];
  preflightSteps?: readonly Partial<ReleasePreflightStep>[];
  preflightNextActions?: readonly string[];
  missingAppleInputs?: readonly string[];
  triggerTagName?: string;
  triggerGateReady?: boolean;
  triggerGateFailures?: readonly string[];
  activeUploads?: number;
  completedUploads?: number;
  liveCompletedUploads?: number;
  simulatedCompletedUploads?: number;
  liveDispatchedOnlyUploads?: number;
  latestLiveUploadCompletedAt?: string | number;
  latestLiveUpload?: Partial<LatestLiveUploadTrace> & {completedAt?: string | number};
  uploadEvidenceSummary?: string;
  validationDetails?: ReleaseValidationDetails;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIBRAINIM_RELEASE_CHANNEL__:
    | ReleaseChannelPayload
    | undefined;
}

function parseBoolean(value?: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'ready', 'ok'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'not-ready'].includes(normalized)) return false;
  return undefined;
}

function normalizeEpochTimestamp(value: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  if (value >= 1e12) {
    return value;
  }

  if (value >= 1e9) {
    return value * 1000;
  }

  return value > 0 ? value : undefined;
}

function parseTimestamp(value?: string | number | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normalizeEpochTimestamp(value);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    return normalizeEpochTimestamp(numeric);
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map(item => String(item ?? '').trim())
      .filter(Boolean),
  )];
}

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string' && value.trim() && /^\d+$/.test(value.trim())) {
    return Math.max(0, Number(value.trim()));
  }
  return 0;
}

function normalizeLatestLiveUpload(value: unknown): LatestLiveUploadTrace | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const source = value as Partial<LatestLiveUploadTrace> & {completedAt?: string | number};
  const completedAt = parseTimestamp(source.completedAt);
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : undefined;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name.trim() : undefined;
  const dispatchId = typeof source.dispatchId === 'string' && source.dispatchId.trim() ? source.dispatchId.trim() : undefined;
  const agent = typeof source.agent === 'string' && source.agent.trim() ? source.agent.trim() : undefined;

  if (!id && !name && !dispatchId && !agent && completedAt == null) {
    return undefined;
  }

  return {
    id,
    name,
    dispatchId,
    agent,
    completedAt,
    source: source.source === 'runtime' ? 'runtime' : 'release-status',
  };
}

function buildUploadEvidenceSummary(input: {
  activeUploads?: unknown;
  liveCompletedUploads?: unknown;
  simulatedCompletedUploads?: unknown;
  liveDispatchedOnlyUploads?: unknown;
  uploadEvidenceSummary?: unknown;
}): string | undefined {
  if (typeof input.uploadEvidenceSummary === 'string' && input.uploadEvidenceSummary.trim()) {
    return input.uploadEvidenceSummary.trim();
  }

  const activeUploads = parseCount(input.activeUploads);
  const liveCompletedUploads = parseCount(input.liveCompletedUploads);
  const simulatedCompletedUploads = parseCount(input.simulatedCompletedUploads);
  const liveDispatchedOnlyUploads = parseCount(input.liveDispatchedOnlyUploads);
  const hasStructuredEvidence = activeUploads > 0
    || liveCompletedUploads > 0
    || simulatedCompletedUploads > 0
    || liveDispatchedOnlyUploads > 0;

  if (!hasStructuredEvidence) {
    return undefined;
  }

  const releaseTruthLabel = liveCompletedUploads > 0
    ? liveDispatchedOnlyUploads > 0
      ? '提测真值 LIVE done 仍有 dispatched-only 尾巴'
      : '提测真值 已拿到 LIVE done'
    : liveDispatchedOnlyUploads > 0
      ? '提测真值 缺最终 done 回流'
      : simulatedCompletedUploads > 0
        ? '提测真值 仍是模拟样本'
        : activeUploads > 0
          ? '提测真值 等待回流'
          : '提测真值 尚无样本';

  return [
    `LIVE完成 ${liveCompletedUploads}`,
    `LIVE仅分派 ${liveDispatchedOnlyUploads}`,
    `模拟完成 ${simulatedCompletedUploads}`,
    `处理中 ${activeUploads}`,
    releaseTruthLabel,
  ].join(' · ');
}

function extractPreflightSteps(value: unknown): ReleasePreflightStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const steps: ReleasePreflightStep[] = [];
  for (const item of value) {
    const source = (item ?? {}) as Partial<ReleasePreflightStep>;
    const label = String(source.label ?? '').trim();
    if (!label) {
      continue;
    }

    const status = typeof source.status === 'number' && Number.isFinite(source.status)
      ? source.status
      : undefined;
    const durationMs = typeof source.durationMs === 'number' && Number.isFinite(source.durationMs)
      ? source.durationMs
      : undefined;

    steps.push({
      label,
      ok: source.ok === true,
      status,
      durationMs,
      stdoutTail: extractStringList(source.stdoutTail).slice(-6),
      stderrTail: extractStringList(source.stderrTail).slice(-6),
    });
  }

  return steps;
}

function parseReleaseChannelPayload(value?: string | null): ReleaseChannelPayload | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as ReleaseChannelPayload | null;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function buildSummary(
  ready: boolean,
  source: AppleReleaseStatus['source'],
  firstTestFlightBuildUploaded = false,
  appStoreAssetsReady = false,
): string {
  const assetSuffix = appStoreAssetsReady
    ? '，App Store 素材真值也已通过'
    : '，但 App Store 素材真值仍未被显式标记为通过';

  if (ready) {
    if (firstTestFlightBuildUploaded) {
      return source === 'global-override'
        ? `Apple 前置校验已由运行态覆盖标记为通过，首个 TestFlight Build 也已上传${assetSuffix}`
        : source === 'env'
          ? `Apple 前置校验已由环境标记为通过，首个 TestFlight Build 已上传${assetSuffix}`
          : `Apple 前置校验已通过，首个 TestFlight Build 已上传${assetSuffix}`;
    }

    return source === 'global-override'
      ? `Apple 前置校验已由运行态覆盖标记为通过${assetSuffix}`
      : source === 'env'
        ? `Apple 前置校验已由环境标记为通过${assetSuffix}`
        : `Apple 前置校验已通过${assetSuffix}`;
  }

  if (firstTestFlightBuildUploaded) {
    return source === 'global-override'
      ? `运行态显示首个 TestFlight Build 已上传，但 Apple 前置校验仍未被显式标记为通过${appStoreAssetsReady ? '；App Store 素材真值已通过' : '；App Store 素材真值也仍未通过'}`
      : source === 'env'
        ? `环境显示首个 TestFlight Build 已上传，但 Apple 前置校验仍未被显式标记为通过${appStoreAssetsReady ? '；App Store 素材真值已通过' : '；App Store 素材真值也仍未通过'}`
        : `首个 TestFlight Build 已上传，但 Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets 仍未形成完整就绪真值${appStoreAssetsReady ? '；App Store 素材真值已通过' : '；App Store 素材真值也仍未通过'}`;
  }

  return source === 'global-override'
    ? `Apple 前置校验被运行态显式标记为未通过${appStoreAssetsReady ? '，但 App Store 素材真值已通过' : ''}`
    : source === 'env'
      ? `Apple 前置校验尚未由环境标记为通过${appStoreAssetsReady ? '，但 App Store 素材真值已通过' : ''}`
      : `Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets 仍待补齐${appStoreAssetsReady ? '；App Store 素材真值已通过' : ''}`;
}

const APPLE_INPUT_ALIAS_MAP: Record<string, string> = {
  ASC_KEY_ID: 'APPLE_API_KEY_ID',
  ASC_ISSUER_ID: 'APPLE_API_ISSUER_ID',
  APPLE_API_KEY_ID: 'APPLE_API_KEY_ID',
  APPLE_API_ISSUER_ID: 'APPLE_API_ISSUER_ID',
  APPLE_TEAM_ID: 'APPLE_TEAM_ID',
  APPLE_API_KEY_CONTENT: 'APPLE_API_KEY_CONTENT',
};

function normalizeAppleInputName(value: string): string {
  const trimmed = value.trim();
  const parts = trimmed.split('/').map(part => part.trim()).filter(Boolean);
  for (const part of parts) {
    const normalized = APPLE_INPUT_ALIAS_MAP[part];
    if (normalized) {
      return normalized;
    }
  }
  return APPLE_INPUT_ALIAS_MAP[trimmed] ?? trimmed;
}

function extractMissingAppleInputs(payload?: Partial<ReleaseChannelPayload> | null): string[] {
  const explicitMissingInputs = extractStringList(payload?.missingAppleInputs)
    .map(item => normalizeAppleInputName(item))
    .filter(Boolean);
  if (explicitMissingInputs.length > 0) {
    return [...new Set(explicitMissingInputs)];
  }

  const raw = payload?.validationDetails?.apple;
  if (typeof raw !== 'string') {
    return [];
  }

  const match = raw.match(/Missing Apple inputs:\s*(.+)$/i);
  if (!match) {
    return [];
  }

  return [...new Set(
    match[1]
      .split(',')
      .map(item => normalizeAppleInputName(item))
      .filter(Boolean),
  )];
}

function appendGeneratedMissingInputHint(
  summary: string,
  payload?: Partial<ReleaseChannelPayload> | null,
): string {
  const missingInputs = extractMissingAppleInputs(payload);
  if (missingInputs.length === 0) {
    return summary;
  }

  if (summary.includes('当前缺口：')) {
    return summary;
  }

  return `${summary}；当前缺口：${missingInputs.join('、')}`;
}

export function getAppleReleaseStatus(): AppleReleaseStatus {
  const runtimeOverride = globalThis.__AIBRAINIM_RELEASE_CHANNEL__;
  const generatedOverride = generatedReleaseStatusInput;
  const runtimeJsonOverride = parseReleaseChannelPayload(
    runtimeProcess?.env?.AIBRAINIM_RELEASE_CHANNEL_JSON
      ?? runtimeProcess?.env?.RELEASE_CHANNEL_JSON
      ?? runtimeProcess?.env?.REACT_NATIVE_RELEASE_CHANNEL_JSON,
  );
  const mergedRuntimeOverride = runtimeOverride ?? runtimeJsonOverride;
  const hasRuntimeOverride = mergedRuntimeOverride != null && (
    typeof mergedRuntimeOverride.applePrerequisitesReady === 'boolean'
    || typeof mergedRuntimeOverride.firstTestFlightBuildUploaded === 'boolean'
    || typeof mergedRuntimeOverride.appStoreAssetsReady === 'boolean'
    || typeof mergedRuntimeOverride.summary === 'string'
    || mergedRuntimeOverride.updatedAt != null
    || mergedRuntimeOverride.preflightReportGeneratedAt != null
    || mergedRuntimeOverride.preflightOverallStatus != null
    || typeof mergedRuntimeOverride.preflightBlockingCount === 'number'
    || Array.isArray(mergedRuntimeOverride.preflightFailedChecks)
    || Array.isArray(mergedRuntimeOverride.preflightSteps)
    || Array.isArray(mergedRuntimeOverride.preflightNextActions)
    || Array.isArray(mergedRuntimeOverride.missingAppleInputs)
    || typeof mergedRuntimeOverride.activeUploads === 'number'
    || typeof mergedRuntimeOverride.completedUploads === 'number'
    || typeof mergedRuntimeOverride.liveCompletedUploads === 'number'
    || typeof mergedRuntimeOverride.simulatedCompletedUploads === 'number'
    || typeof mergedRuntimeOverride.liveDispatchedOnlyUploads === 'number'
    || mergedRuntimeOverride.latestLiveUploadCompletedAt != null
    || mergedRuntimeOverride.latestLiveUpload != null
    || typeof mergedRuntimeOverride.uploadEvidenceSummary === 'string'
    || mergedRuntimeOverride.validationDetails?.apple != null
    || mergedRuntimeOverride.validationDetails?.assets != null
    || mergedRuntimeOverride.validationDetails?.preflight != null
  );

  const hasGeneratedOverride = generatedOverride != null && (
    typeof generatedOverride.applePrerequisitesReady === 'boolean'
    || typeof generatedOverride.firstTestFlightBuildUploaded === 'boolean'
    || typeof generatedOverride.appStoreAssetsReady === 'boolean'
    || typeof generatedOverride.summary === 'string'
    || generatedOverride.validatedAt != null
    || generatedOverride.assetsValidatedAt != null
    || generatedOverride.updatedAt != null
    || generatedOverride.preflightReportGeneratedAt != null
    || generatedOverride.preflightOverallStatus != null
    || typeof generatedOverride.preflightBlockingCount === 'number'
    || Array.isArray(generatedOverride.preflightFailedChecks)
    || Array.isArray(generatedOverride.preflightSteps)
    || Array.isArray(generatedOverride.preflightNextActions)
    || Array.isArray(generatedOverride.missingAppleInputs)
    || typeof generatedOverride.activeUploads === 'number'
    || typeof generatedOverride.completedUploads === 'number'
    || typeof generatedOverride.liveCompletedUploads === 'number'
    || typeof generatedOverride.simulatedCompletedUploads === 'number'
    || typeof generatedOverride.liveDispatchedOnlyUploads === 'number'
    || generatedOverride.latestLiveUploadCompletedAt != null
    || generatedOverride.latestLiveUpload != null
    || typeof generatedOverride.uploadEvidenceSummary === 'string'
    || generatedOverride.validationDetails?.apple != null
    || generatedOverride.validationDetails?.assets != null
    || generatedOverride.validationDetails?.preflight != null
  );

  if (hasRuntimeOverride) {
    const applePrerequisitesReady = mergedRuntimeOverride?.applePrerequisitesReady === true;
    const firstTestFlightBuildUploaded = mergedRuntimeOverride?.firstTestFlightBuildUploaded === true;
    const appStoreAssetsReady = mergedRuntimeOverride?.appStoreAssetsReady === true;
    return {
      applePrerequisitesReady,
      firstTestFlightBuildUploaded,
      appStoreAssetsReady,
      source: 'global-override',
      summary: mergedRuntimeOverride?.summary?.trim()
        ? appendGeneratedMissingInputHint(mergedRuntimeOverride.summary.trim(), mergedRuntimeOverride)
        : appendGeneratedMissingInputHint(buildSummary(applePrerequisitesReady, 'global-override', firstTestFlightBuildUploaded, appStoreAssetsReady), mergedRuntimeOverride),
      validatedAt: parseTimestamp(mergedRuntimeOverride?.validatedAt),
      assetsValidatedAt: parseTimestamp(mergedRuntimeOverride?.assetsValidatedAt),
      preflightReportGeneratedAt: parseTimestamp(mergedRuntimeOverride?.preflightReportGeneratedAt),
      preflightOverallStatus: mergedRuntimeOverride?.preflightOverallStatus,
      preflightBlockingCount: mergedRuntimeOverride?.preflightBlockingCount,
      preflightFailedChecks: extractStringList(mergedRuntimeOverride?.preflightFailedChecks),
      preflightSteps: extractPreflightSteps(mergedRuntimeOverride?.preflightSteps),
      preflightNextActions: extractStringList(mergedRuntimeOverride?.preflightNextActions),
      missingAppleInputs: extractMissingAppleInputs(mergedRuntimeOverride),
      triggerTagName: typeof mergedRuntimeOverride?.triggerTagName === 'string' ? mergedRuntimeOverride.triggerTagName : undefined,
      triggerGateReady: typeof mergedRuntimeOverride?.triggerGateReady === 'boolean' ? mergedRuntimeOverride.triggerGateReady : undefined,
      triggerGateFailures: extractStringList(mergedRuntimeOverride?.triggerGateFailures),
      activeUploads: parseCount(mergedRuntimeOverride?.activeUploads),
      completedUploads: parseCount(mergedRuntimeOverride?.completedUploads),
      liveCompletedUploads: parseCount(mergedRuntimeOverride?.liveCompletedUploads),
      simulatedCompletedUploads: parseCount(mergedRuntimeOverride?.simulatedCompletedUploads),
      liveDispatchedOnlyUploads: parseCount(mergedRuntimeOverride?.liveDispatchedOnlyUploads),
      latestLiveUploadCompletedAt: parseTimestamp(mergedRuntimeOverride?.latestLiveUploadCompletedAt),
      latestLiveUpload: normalizeLatestLiveUpload(mergedRuntimeOverride?.latestLiveUpload),
      uploadEvidenceSummary: buildUploadEvidenceSummary({
        activeUploads: mergedRuntimeOverride?.activeUploads,
        liveCompletedUploads: mergedRuntimeOverride?.liveCompletedUploads,
        simulatedCompletedUploads: mergedRuntimeOverride?.simulatedCompletedUploads,
        liveDispatchedOnlyUploads: mergedRuntimeOverride?.liveDispatchedOnlyUploads,
        uploadEvidenceSummary: mergedRuntimeOverride?.uploadEvidenceSummary,
      }),
      appleValidationDetail: mergedRuntimeOverride?.validationDetails?.apple,
      assetsValidationDetail: mergedRuntimeOverride?.validationDetails?.assets,
      preflightValidationDetail: mergedRuntimeOverride?.validationDetails?.preflight,
    };
  }

  const envJsonPayload = parseReleaseChannelPayload(
    runtimeProcess?.env?.AIBRAINIM_ENV_RELEASE_CHANNEL_JSON
      ?? runtimeProcess?.env?.ENV_RELEASE_CHANNEL_JSON
      ?? runtimeProcess?.env?.REACT_NATIVE_ENV_RELEASE_CHANNEL_JSON,
  );

  const envReady = envJsonPayload?.applePrerequisitesReady ?? parseBoolean(
    runtimeProcess?.env?.AIBRAINIM_APPLE_PREREQUISITES_READY
      ?? runtimeProcess?.env?.APPLE_PREREQUISITES_READY
      ?? runtimeProcess?.env?.REACT_NATIVE_APPLE_PREREQUISITES_READY,
  );
  const envBuildUploaded = envJsonPayload?.firstTestFlightBuildUploaded ?? parseBoolean(
    runtimeProcess?.env?.AIBRAINIM_TESTFLIGHT_BUILD_UPLOADED
      ?? runtimeProcess?.env?.TESTFLIGHT_BUILD_UPLOADED
      ?? runtimeProcess?.env?.REACT_NATIVE_TESTFLIGHT_BUILD_UPLOADED,
  );
  const envAssetsReady = envJsonPayload?.appStoreAssetsReady ?? parseBoolean(
    runtimeProcess?.env?.AIBRAINIM_APPSTORE_ASSETS_READY
      ?? runtimeProcess?.env?.APPSTORE_ASSETS_READY
      ?? runtimeProcess?.env?.REACT_NATIVE_APPSTORE_ASSETS_READY,
  );
  const envSummary = envJsonPayload?.summary
    ?? runtimeProcess?.env?.AIBRAINIM_APPLE_RELEASE_SUMMARY
    ?? runtimeProcess?.env?.APPLE_RELEASE_SUMMARY
    ?? runtimeProcess?.env?.REACT_NATIVE_APPLE_RELEASE_SUMMARY;
  const envValidatedAt = parseTimestamp(
    envJsonPayload?.validatedAt
      ?? runtimeProcess?.env?.AIBRAINIM_APPLE_RELEASE_VALIDATED_AT
      ?? runtimeProcess?.env?.APPLE_RELEASE_VALIDATED_AT
      ?? runtimeProcess?.env?.REACT_NATIVE_APPLE_RELEASE_VALIDATED_AT,
  );
  const envAssetsValidatedAt = parseTimestamp(
    envJsonPayload?.assetsValidatedAt
      ?? runtimeProcess?.env?.AIBRAINIM_APPSTORE_ASSETS_VALIDATED_AT
      ?? runtimeProcess?.env?.APPSTORE_ASSETS_VALIDATED_AT
      ?? runtimeProcess?.env?.REACT_NATIVE_APPSTORE_ASSETS_VALIDATED_AT,
  );
  const hasExplicitEnvSignal = typeof envReady === 'boolean'
    || typeof envBuildUploaded === 'boolean'
    || typeof envAssetsReady === 'boolean'
    || typeof envSummary === 'string'
    || envValidatedAt != null
    || envAssetsValidatedAt != null
    || envJsonPayload?.updatedAt != null
    || envJsonPayload?.preflightReportGeneratedAt != null
    || envJsonPayload?.preflightOverallStatus != null
    || typeof envJsonPayload?.preflightBlockingCount === 'number'
    || Array.isArray(envJsonPayload?.preflightFailedChecks)
    || Array.isArray(envJsonPayload?.preflightSteps)
    || Array.isArray(envJsonPayload?.preflightNextActions)
    || Array.isArray(envJsonPayload?.missingAppleInputs)
    || envJsonPayload?.validationDetails?.apple != null
    || envJsonPayload?.validationDetails?.assets != null
    || envJsonPayload?.validationDetails?.preflight != null;

  if (hasExplicitEnvSignal) {
    const applePrerequisitesReady = envReady === true;
    const firstTestFlightBuildUploaded = envBuildUploaded === true;
    const appStoreAssetsReady = envAssetsReady === true;
    return {
      applePrerequisitesReady,
      firstTestFlightBuildUploaded,
      appStoreAssetsReady,
      source: 'env',
      summary: envSummary?.trim()
        ? appendGeneratedMissingInputHint(envSummary.trim(), envJsonPayload)
        : appendGeneratedMissingInputHint(buildSummary(applePrerequisitesReady, 'env', firstTestFlightBuildUploaded, appStoreAssetsReady), envJsonPayload),
      validatedAt: envValidatedAt,
      assetsValidatedAt: envAssetsValidatedAt,
      preflightReportGeneratedAt: parseTimestamp(envJsonPayload?.preflightReportGeneratedAt),
      preflightOverallStatus: envJsonPayload?.preflightOverallStatus,
      preflightBlockingCount: envJsonPayload?.preflightBlockingCount,
      preflightFailedChecks: extractStringList(envJsonPayload?.preflightFailedChecks),
      preflightSteps: extractPreflightSteps(envJsonPayload?.preflightSteps),
      preflightNextActions: extractStringList(envJsonPayload?.preflightNextActions),
      missingAppleInputs: extractMissingAppleInputs(envJsonPayload),
      triggerTagName: typeof envJsonPayload?.triggerTagName === 'string' ? envJsonPayload.triggerTagName : undefined,
      triggerGateReady: typeof envJsonPayload?.triggerGateReady === 'boolean' ? envJsonPayload.triggerGateReady : undefined,
      triggerGateFailures: extractStringList(envJsonPayload?.triggerGateFailures),
      activeUploads: parseCount(envJsonPayload?.activeUploads),
      completedUploads: parseCount(envJsonPayload?.completedUploads),
      liveCompletedUploads: parseCount(envJsonPayload?.liveCompletedUploads),
      simulatedCompletedUploads: parseCount(envJsonPayload?.simulatedCompletedUploads),
      liveDispatchedOnlyUploads: parseCount(envJsonPayload?.liveDispatchedOnlyUploads),
      latestLiveUploadCompletedAt: parseTimestamp(envJsonPayload?.latestLiveUploadCompletedAt),
      latestLiveUpload: normalizeLatestLiveUpload(envJsonPayload?.latestLiveUpload),
      uploadEvidenceSummary: buildUploadEvidenceSummary({
        activeUploads: envJsonPayload?.activeUploads,
        liveCompletedUploads: envJsonPayload?.liveCompletedUploads,
        simulatedCompletedUploads: envJsonPayload?.simulatedCompletedUploads,
        liveDispatchedOnlyUploads: envJsonPayload?.liveDispatchedOnlyUploads,
        uploadEvidenceSummary: envJsonPayload?.uploadEvidenceSummary,
      }),
      appleValidationDetail: envJsonPayload?.validationDetails?.apple,
      assetsValidationDetail: envJsonPayload?.validationDetails?.assets,
      preflightValidationDetail: envJsonPayload?.validationDetails?.preflight,
    };
  }

  if (hasGeneratedOverride) {
    const applePrerequisitesReady = generatedOverride?.applePrerequisitesReady === true;
    const firstTestFlightBuildUploaded = generatedOverride?.firstTestFlightBuildUploaded === true;
    const appStoreAssetsReady = generatedOverride?.appStoreAssetsReady === true;
    const summary = generatedOverride?.summary?.trim() || buildSummary(applePrerequisitesReady, 'generated', firstTestFlightBuildUploaded, appStoreAssetsReady);
    return {
      applePrerequisitesReady,
      firstTestFlightBuildUploaded,
      appStoreAssetsReady,
      source: 'generated',
      summary: appendGeneratedMissingInputHint(summary, generatedOverride),
      validatedAt: parseTimestamp(generatedOverride?.validatedAt),
      assetsValidatedAt: parseTimestamp(generatedOverride?.assetsValidatedAt),
      preflightReportGeneratedAt: parseTimestamp(generatedOverride?.preflightReportGeneratedAt),
      preflightOverallStatus: generatedOverride?.preflightOverallStatus,
      preflightBlockingCount: generatedOverride?.preflightBlockingCount,
      preflightFailedChecks: extractStringList(generatedOverride?.preflightFailedChecks),
      preflightSteps: extractPreflightSteps(generatedOverride?.preflightSteps),
      preflightNextActions: extractStringList(generatedOverride?.preflightNextActions),
      missingAppleInputs: extractMissingAppleInputs(generatedOverride),
      triggerTagName: typeof generatedOverride?.triggerTagName === 'string' ? generatedOverride.triggerTagName : undefined,
      triggerGateReady: typeof generatedOverride?.triggerGateReady === 'boolean' ? generatedOverride.triggerGateReady : undefined,
      triggerGateFailures: extractStringList(generatedOverride?.triggerGateFailures),
      activeUploads: parseCount(generatedOverride?.activeUploads),
      completedUploads: parseCount(generatedOverride?.completedUploads),
      liveCompletedUploads: parseCount(generatedOverride?.liveCompletedUploads),
      simulatedCompletedUploads: parseCount(generatedOverride?.simulatedCompletedUploads),
      liveDispatchedOnlyUploads: parseCount(generatedOverride?.liveDispatchedOnlyUploads),
      latestLiveUploadCompletedAt: parseTimestamp(generatedOverride?.latestLiveUploadCompletedAt),
      latestLiveUpload: normalizeLatestLiveUpload(generatedOverride?.latestLiveUpload),
      uploadEvidenceSummary: buildUploadEvidenceSummary({
        activeUploads: generatedOverride?.activeUploads,
        liveCompletedUploads: generatedOverride?.liveCompletedUploads,
        simulatedCompletedUploads: generatedOverride?.simulatedCompletedUploads,
        liveDispatchedOnlyUploads: generatedOverride?.liveDispatchedOnlyUploads,
        uploadEvidenceSummary: generatedOverride?.uploadEvidenceSummary,
      }),
      appleValidationDetail: generatedOverride?.validationDetails?.apple,
      assetsValidationDetail: generatedOverride?.validationDetails?.assets,
      preflightValidationDetail: generatedOverride?.validationDetails?.preflight,
    };
  }

  const firstTestFlightBuildUploaded = false;
  const appStoreAssetsReady = false;
  return {
    applePrerequisitesReady: false,
    firstTestFlightBuildUploaded,
    appStoreAssetsReady,
    source: 'default',
    summary: buildSummary(false, 'default', firstTestFlightBuildUploaded, appStoreAssetsReady),
    validatedAt: undefined,
    assetsValidatedAt: undefined,
    preflightReportGeneratedAt: undefined,
    preflightOverallStatus: undefined,
    preflightBlockingCount: undefined,
    preflightFailedChecks: [],
    preflightSteps: [],
    preflightNextActions: [],
    missingAppleInputs: [],
    triggerTagName: undefined,
    triggerGateReady: undefined,
    triggerGateFailures: [],
    activeUploads: 0,
    completedUploads: 0,
    liveCompletedUploads: 0,
    simulatedCompletedUploads: 0,
    liveDispatchedOnlyUploads: 0,
    latestLiveUploadCompletedAt: undefined,
    latestLiveUpload: undefined,
    uploadEvidenceSummary: undefined,
    appleValidationDetail: undefined,
    assetsValidationDetail: undefined,
    preflightValidationDetail: undefined,
  };
}
