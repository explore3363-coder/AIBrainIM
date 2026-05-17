import type {UploadFile} from '../services/uploadService';

export interface LatestLiveUploadTrace {
  id?: string;
  name?: string;
  dispatchId?: string;
  agent?: string;
  completedAt?: number;
  source: 'runtime' | 'release-status';
}

export interface UploadReleaseEvidence {
  activeUploads: number;
  completedUploads: number;
  liveCompletedUploads: number;
  simulatedCompletedUploads: number;
  liveDispatchedOnlyUploads: number;
  latestLiveUploadCompletedAt?: number;
  latestLiveUpload?: LatestLiveUploadTrace;
}

function normalizeTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeLatestLiveUpload(
  value: Partial<LatestLiveUploadTrace> | undefined | null,
  fallbackCompletedAt?: number,
): LatestLiveUploadTrace | undefined {
  if (!value) {
    return fallbackCompletedAt == null
      ? undefined
      : {
          completedAt: fallbackCompletedAt,
          source: 'release-status',
        };
  }

  const completedAt = normalizeTimestamp(value.completedAt) ?? fallbackCompletedAt;
  if (completedAt == null && !value.name?.trim()) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : undefined,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : undefined,
    dispatchId: typeof value.dispatchId === 'string' && value.dispatchId.trim() ? value.dispatchId.trim() : undefined,
    agent: typeof value.agent === 'string' && value.agent.trim() ? value.agent.trim() : undefined,
    completedAt,
    source: value.source === 'release-status' ? 'release-status' : 'runtime',
  };
}

function mergeLatestLiveUploadTrace(
  primaryTrace: LatestLiveUploadTrace | undefined,
  fallbackTrace: LatestLiveUploadTrace | undefined,
): LatestLiveUploadTrace | undefined {
  if (!primaryTrace && !fallbackTrace) {
    return undefined;
  }

  const primaryCompletedAt = primaryTrace?.completedAt ?? 0;
  const fallbackCompletedAt = fallbackTrace?.completedAt ?? 0;
  const selectedPrimary = primaryCompletedAt >= fallbackCompletedAt;
  const selected = selectedPrimary ? primaryTrace : fallbackTrace;
  const secondary = selectedPrimary ? fallbackTrace : primaryTrace;

  return {
    id: selected?.id ?? secondary?.id,
    name: selected?.name ?? secondary?.name,
    dispatchId: selected?.dispatchId ?? secondary?.dispatchId,
    agent: selected?.agent ?? secondary?.agent,
    completedAt: selected?.completedAt ?? secondary?.completedAt,
    source: selected?.source ?? secondary?.source ?? 'release-status',
  };
}

export function mergeUploadReleaseEvidence(
  primary: UploadReleaseEvidence | undefined | null,
  fallback: Partial<UploadReleaseEvidence> | undefined | null,
): UploadReleaseEvidence {
  const base: UploadReleaseEvidence = {
    activeUploads: 0,
    completedUploads: 0,
    liveCompletedUploads: 0,
    simulatedCompletedUploads: 0,
    liveDispatchedOnlyUploads: 0,
    latestLiveUploadCompletedAt: undefined,
    latestLiveUpload: undefined,
  };

  const safePrimary = primary ?? base;
  const safeFallback = fallback ?? {};

  const latestPrimary = normalizeTimestamp(safePrimary.latestLiveUploadCompletedAt);
  const latestFallback = normalizeTimestamp(safeFallback.latestLiveUploadCompletedAt);
  const mergedLatestLiveUploadCompletedAt = Math.max(latestPrimary ?? 0, latestFallback ?? 0) || undefined;

  const primaryTrace = normalizeLatestLiveUpload(safePrimary.latestLiveUpload, latestPrimary);
  const fallbackTrace = normalizeLatestLiveUpload(safeFallback.latestLiveUpload, latestFallback);
  const mergedLatestLiveUpload = mergeLatestLiveUploadTrace(primaryTrace, fallbackTrace);

  return {
    activeUploads: Math.max(
      0,
      Math.max(
        Math.floor(Number(safePrimary.activeUploads) || 0),
        Math.floor(Number(safeFallback.activeUploads) || 0),
      ),
    ),
    completedUploads: Math.max(
      0,
      Math.max(
        Math.floor(Number(safePrimary.completedUploads) || 0),
        Math.floor(Number(safeFallback.completedUploads) || 0),
      ),
    ),
    liveCompletedUploads: Math.max(
      0,
      Math.max(
        Math.floor(Number(safePrimary.liveCompletedUploads) || 0),
        Math.floor(Number(safeFallback.liveCompletedUploads) || 0),
      ),
    ),
    simulatedCompletedUploads: Math.max(
      0,
      Math.max(
        Math.floor(Number(safePrimary.simulatedCompletedUploads) || 0),
        Math.floor(Number(safeFallback.simulatedCompletedUploads) || 0),
      ),
    ),
    liveDispatchedOnlyUploads: Math.max(
      0,
      Math.max(
        Math.floor(Number(safePrimary.liveDispatchedOnlyUploads) || 0),
        Math.floor(Number(safeFallback.liveDispatchedOnlyUploads) || 0),
      ),
    ),
    latestLiveUploadCompletedAt: mergedLatestLiveUploadCompletedAt,
    latestLiveUpload: mergedLatestLiveUpload,
  };
}

function hasFiniteCompletedAt(file: UploadFile): file is UploadFile & {completedAt: number} {
  return typeof file.completedAt === 'number' && Number.isFinite(file.completedAt);
}

export function summarizeUploadReleaseEvidence(files: UploadFile[] | undefined | null): UploadReleaseEvidence {
  const safeFiles = Array.isArray(files) ? files : [];
  const activeUploads = safeFiles.filter(
    file => file.status === 'queued' || file.status === 'uploading' || file.status === 'processing',
  ).length;
  const completedFiles = safeFiles.filter(file => file.status === 'done' && hasFiniteCompletedAt(file));
  const liveCompletedFiles = completedFiles
    .filter(file => file.executionMode === 'live')
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const latestLiveUpload = liveCompletedFiles[0]
    ? {
        id: liveCompletedFiles[0].id,
        name: liveCompletedFiles[0].name,
        dispatchId: liveCompletedFiles[0].dispatchId,
        agent: liveCompletedFiles[0].agent,
        completedAt: liveCompletedFiles[0].completedAt,
        source: 'runtime' as const,
      }
    : undefined;
  const simulatedCompletedUploads = completedFiles.filter(file => file.executionMode === 'simulated').length;
  const latestLiveUploadCompletedAt = latestLiveUpload?.completedAt;

  return {
    activeUploads,
    completedUploads: completedFiles.length,
    liveCompletedUploads: liveCompletedFiles.length,
    simulatedCompletedUploads,
    liveDispatchedOnlyUploads: safeFiles.filter(file => file.status === 'dispatched' && file.executionMode === 'live').length,
    latestLiveUploadCompletedAt,
    latestLiveUpload,
  };
}

export function buildUploadEvidenceLine(evidence: UploadReleaseEvidence): string {
  const releaseTruthLabel = evidence.liveCompletedUploads > 0
    ? evidence.liveDispatchedOnlyUploads > 0
      ? '提测真值 LIVE done 仍有 dispatched-only 尾巴'
      : '提测真值 已拿到 LIVE done'
    : evidence.liveDispatchedOnlyUploads > 0
      ? '提测真值 缺最终 done 回流'
      : evidence.simulatedCompletedUploads > 0
        ? '提测真值 仍是模拟样本'
        : evidence.activeUploads > 0
          ? '提测真值 等待回流'
          : '提测真值 尚无样本';

  const parts = [
    `LIVE完成 ${evidence.liveCompletedUploads}`,
    `LIVE仅分派 ${evidence.liveDispatchedOnlyUploads}`,
    `模拟完成 ${evidence.simulatedCompletedUploads}`,
    `处理中 ${evidence.activeUploads}`,
    releaseTruthLabel,
  ];

  return parts.join(' · ');
}

function formatFreshnessLabel(timestamp?: number, freshMs = 72 * 60 * 60 * 1000): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return '时间未记录';
  }

  return Date.now() - timestamp <= freshMs ? '仍可作为提测依据' : '提测真值已过期';
}

function formatTraceSourceLabel(
  source: LatestLiveUploadTrace['source'] | undefined,
  hasExplicitTrace: boolean,
): string {
  if (source === 'release-status') {
    return '来源 仓库预检回填';
  }
  if (source === 'runtime') {
    return '来源 运行态真回流';
  }
  return hasExplicitTrace ? '来源 运行态真回流' : '来源 仓库预检回填';
}

export function hasMeaningfulLatestLiveUploadTrace(evidence: UploadReleaseEvidence): boolean {
  const trace = evidence.latestLiveUpload;
  return Boolean(
    trace?.name
    || trace?.dispatchId
    || trace?.agent,
  );
}

export function buildLatestLiveUploadTraceLine(
  evidence: UploadReleaseEvidence,
  freshMs = 72 * 60 * 60 * 1000,
): string | undefined {
  const trace = evidence.latestLiveUpload;
  const completedAt = trace?.completedAt ?? evidence.latestLiveUploadCompletedAt;

  if (!trace && completedAt == null) {
    return undefined;
  }

  const detailParts: string[] = [formatTraceSourceLabel(trace?.source, trace != null)];
  if (trace?.dispatchId) {
    detailParts.push(`调度 ${trace.dispatchId}`);
  }
  if (trace?.agent) {
    detailParts.push(`执行 ${trace.agent}`);
  }
  if (completedAt != null) {
    detailParts.push(new Date(completedAt).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }));
  }
  detailParts.push(formatFreshnessLabel(completedAt, freshMs));
  if (trace?.source === 'release-status' && !trace?.name) {
    detailParts.push('样本名待补录');
  }

  return `最近一条 LIVE 真回流证据：${trace?.name ?? '样本名未记录'}${detailParts.length > 0 ? ` · ${detailParts.join(' · ')}` : ''}`;
}
