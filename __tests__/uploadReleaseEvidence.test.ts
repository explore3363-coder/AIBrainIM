import {
  summarizeUploadReleaseEvidence,
  buildUploadEvidenceLine,
  buildLatestLiveUploadTraceLine,
  hasMeaningfulLatestLiveUploadTrace,
  mergeUploadReleaseEvidence,
} from '../src/utils/uploadReleaseEvidence';
import type {UploadFile} from '../src/services/uploadService';

function createUploadFile(overrides: Partial<UploadFile>): UploadFile {
  return {
    id: 'upload-1',
    name: 'sample.pdf',
    uri: 'file:///sample.pdf',
    type: 'document',
    mimeType: 'application/pdf',
    size: 1024,
    status: 'queued',
    progress: 0,
    transferMode: 'direct',
    resumable: false,
    queueStage: 'queued',
    timestamp: '13:30',
    ...overrides,
  };
}

describe('uploadReleaseEvidence', () => {
  it('summarizes active, live completed, simulated completed and dispatched-only uploads separately', () => {
    const now = Date.now();
    const files: UploadFile[] = [
      createUploadFile({
        id: 'live-done',
        name: '真实回流.pdf',
        status: 'done',
        executionMode: 'live',
        completedAt: now - 5_000,
        dispatchId: 'dispatch-live-1',
        agent: '黑金',
      }),
      createUploadFile({
        id: 'sim-done',
        status: 'done',
        executionMode: 'simulated',
        completedAt: now - 10_000,
      }),
      createUploadFile({
        id: 'live-dispatched',
        status: 'dispatched',
        executionMode: 'live',
      }),
      createUploadFile({
        id: 'processing',
        status: 'processing',
        executionMode: 'live',
      }),
    ];

    const result = summarizeUploadReleaseEvidence(files);

    expect(result).toEqual({
      activeUploads: 1,
      completedUploads: 2,
      liveCompletedUploads: 1,
      simulatedCompletedUploads: 1,
      liveDispatchedOnlyUploads: 1,
      latestLiveUploadCompletedAt: now - 5_000,
      latestLiveUpload: {
        id: 'live-done',
        name: '真实回流.pdf',
        dispatchId: 'dispatch-live-1',
        agent: '黑金',
        completedAt: now - 5_000,
        source: 'runtime',
      },
    });
  });

  it('ignores done uploads without a finite completedAt when computing release truth', () => {
    const files: UploadFile[] = [
      createUploadFile({
        id: 'missing-completed-at',
        status: 'done',
        executionMode: 'live',
        completedAt: undefined,
      }),
      createUploadFile({
        id: 'nan-completed-at',
        status: 'done',
        executionMode: 'simulated',
        completedAt: Number.NaN,
      }),
    ];

    const result = summarizeUploadReleaseEvidence(files);

    expect(result.completedUploads).toBe(0);
    expect(result.liveCompletedUploads).toBe(0);
    expect(result.simulatedCompletedUploads).toBe(0);
    expect(result.latestLiveUploadCompletedAt).toBeUndefined();
    expect(result.latestLiveUpload).toBeUndefined();
  });

  it('uses the newest live completed timestamp as the release evidence freshness source', () => {
    const now = Date.now();
    const result = summarizeUploadReleaseEvidence([
      createUploadFile({
        id: 'older-live',
        name: '旧回流.pdf',
        status: 'done',
        executionMode: 'live',
        completedAt: now - 60_000,
      }),
      createUploadFile({
        id: 'newer-live',
        name: '新回流.pdf',
        status: 'done',
        executionMode: 'live',
        completedAt: now - 1_000,
        dispatchId: 'dispatch-new',
        agent: '智联',
      }),
    ]);

    expect(result.latestLiveUploadCompletedAt).toBe(now - 1_000);
    expect(result.liveCompletedUploads).toBe(2);
    expect(result.latestLiveUpload?.name).toBe('新回流.pdf');
    expect(result.latestLiveUpload?.dispatchId).toBe('dispatch-new');
  });

  it('merges runtime trace with release-status fallback trace', () => {
    const now = Date.now();
    const result = mergeUploadReleaseEvidence(
      {
        activeUploads: 0,
        completedUploads: 1,
        liveCompletedUploads: 1,
        simulatedCompletedUploads: 0,
        liveDispatchedOnlyUploads: 0,
        latestLiveUploadCompletedAt: now - 1_000,
        latestLiveUpload: {
          id: 'runtime-live',
          name: '运行态真回流.pdf',
          dispatchId: 'dispatch-runtime',
          agent: '黑金',
          completedAt: now - 1_000,
          source: 'runtime',
        },
      },
      {
        latestLiveUploadCompletedAt: now - 10_000,
        latestLiveUpload: {
          name: '生成产物旧样本.pdf',
          completedAt: now - 10_000,
          source: 'release-status',
        },
      },
    );

    expect(result.latestLiveUpload?.name).toBe('运行态真回流.pdf');
    expect(result.latestLiveUpload?.dispatchId).toBe('dispatch-runtime');
    expect(result.latestLiveUpload?.source).toBe('runtime');
  });

  it('fills missing primary trace fields from fallback when fallback is newer', () => {
    const now = Date.now();
    const result = mergeUploadReleaseEvidence(
      {
        activeUploads: 0,
        completedUploads: 1,
        liveCompletedUploads: 1,
        simulatedCompletedUploads: 0,
        liveDispatchedOnlyUploads: 0,
        latestLiveUploadCompletedAt: now - 10_000,
        latestLiveUpload: {
          id: 'runtime-live',
          completedAt: now - 10_000,
          source: 'runtime',
        },
      },
      {
        latestLiveUploadCompletedAt: now - 1_000,
        latestLiveUpload: {
          name: '生成产物新样本.pdf',
          dispatchId: 'dispatch-generated',
          agent: '智联',
          completedAt: now - 1_000,
          source: 'release-status',
        },
      },
    );

    expect(result.latestLiveUpload).toEqual({
      id: 'runtime-live',
      name: '生成产物新样本.pdf',
      dispatchId: 'dispatch-generated',
      agent: '智联',
      completedAt: now - 1_000,
      source: 'release-status',
    });
  });

  it('prefers fallback active upload count when runtime queue is temporarily empty', () => {
    const result = mergeUploadReleaseEvidence(
      {
        activeUploads: 0,
        completedUploads: 0,
        liveCompletedUploads: 0,
        simulatedCompletedUploads: 0,
        liveDispatchedOnlyUploads: 0,
        latestLiveUploadCompletedAt: undefined,
        latestLiveUpload: undefined,
      },
      {
        activeUploads: 2,
      },
    );

    expect(result.activeUploads).toBe(2);
    expect(buildUploadEvidenceLine(result)).toBe('LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 2 · 提测真值 等待回流');
  });

  it('builds live-done release evidence line when final live sample exists', () => {
    const line = buildUploadEvidenceLine({
      activeUploads: 0,
      completedUploads: 2,
      liveCompletedUploads: 1,
      simulatedCompletedUploads: 1,
      liveDispatchedOnlyUploads: 0,
      latestLiveUploadCompletedAt: Date.now(),
      latestLiveUpload: undefined,
    });

    expect(line).toBe('LIVE完成 1 · LIVE仅分派 0 · 模拟完成 1 · 处理中 0 · 提测真值 已拿到 LIVE done');
  });

  it('builds mixed live-done plus dispatched-tail evidence line when queue still has live tail', () => {
    const line = buildUploadEvidenceLine({
      activeUploads: 0,
      completedUploads: 2,
      liveCompletedUploads: 1,
      simulatedCompletedUploads: 0,
      liveDispatchedOnlyUploads: 1,
      latestLiveUploadCompletedAt: Date.now(),
      latestLiveUpload: undefined,
    });

    expect(line).toBe('LIVE完成 1 · LIVE仅分派 1 · 模拟完成 0 · 处理中 0 · 提测真值 LIVE done 仍有 dispatched-only 尾巴');
  });

  it('builds dispatched-only release evidence line before final done arrives', () => {
    const line = buildUploadEvidenceLine({
      activeUploads: 0,
      completedUploads: 0,
      liveCompletedUploads: 0,
      simulatedCompletedUploads: 0,
      liveDispatchedOnlyUploads: 2,
      latestLiveUploadCompletedAt: undefined,
      latestLiveUpload: undefined,
    });

    expect(line).toBe('LIVE完成 0 · LIVE仅分派 2 · 模拟完成 0 · 处理中 0 · 提测真值 缺最终 done 回流');
  });

  it('builds simulated-only release evidence line when only demo samples exist', () => {
    const line = buildUploadEvidenceLine({
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 0,
      simulatedCompletedUploads: 1,
      liveDispatchedOnlyUploads: 0,
      latestLiveUploadCompletedAt: undefined,
      latestLiveUpload: undefined,
    });

    expect(line).toBe('LIVE完成 0 · LIVE仅分派 0 · 模拟完成 1 · 处理中 0 · 提测真值 仍是模拟样本');
  });

  it('builds waiting line while uploads are still in progress', () => {
    const line = buildUploadEvidenceLine({
      activeUploads: 3,
      completedUploads: 0,
      liveCompletedUploads: 0,
      simulatedCompletedUploads: 0,
      liveDispatchedOnlyUploads: 0,
      latestLiveUploadCompletedAt: undefined,
      latestLiveUpload: undefined,
    });

    expect(line).toBe('LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 3 · 提测真值 等待回流');
  });

  it('builds empty line when no upload evidence exists yet', () => {
    const line = buildUploadEvidenceLine({
      activeUploads: 0,
      completedUploads: 0,
      liveCompletedUploads: 0,
      simulatedCompletedUploads: 0,
      liveDispatchedOnlyUploads: 0,
      latestLiveUploadCompletedAt: undefined,
      latestLiveUpload: undefined,
    });

    expect(line).toBe('LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 尚无样本');
  });

  it('builds structured trace line for latest live upload evidence', () => {
    const line = buildLatestLiveUploadTraceLine({
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      simulatedCompletedUploads: 0,
      liveDispatchedOnlyUploads: 0,
      latestLiveUploadCompletedAt: Date.now() - 1_000,
      latestLiveUpload: {
        id: 'live-1',
        name: '最新真回流.png',
        dispatchId: 'dispatch-001',
        agent: '黑金',
        completedAt: Date.now() - 1_000,
        source: 'runtime',
      },
    });

    expect(line).toContain('最近一条 LIVE 真回流证据：最新真回流.png');
    expect(line).toContain('来源 运行态真回流');
    expect(line).toContain('调度 dispatch-001');
    expect(line).toContain('执行 黑金');
    expect(line).toContain('仍可作为提测依据');
  });

  it('marks release-status sourced live evidence explicitly in trace line', () => {
    const line = buildLatestLiveUploadTraceLine({
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      simulatedCompletedUploads: 0,
      liveDispatchedOnlyUploads: 0,
      latestLiveUploadCompletedAt: Date.now() - 1_000,
      latestLiveUpload: {
        id: 'generated-live-1',
        name: 'release-status-live.zip',
        dispatchId: 'dispatch-generated-live-1',
        agent: '助理',
        completedAt: Date.now() - 1_000,
        source: 'release-status',
      },
    });

    expect(line).toContain('最近一条 LIVE 真回流证据：release-status-live.zip');
    expect(line).toContain('来源 仓库预检回填');
    expect(line).toContain('调度 dispatch-generated-live-1');
    expect(line).toContain('执行 助理');
  });

  it('treats timestamp-only fallback traces as not meaningful for rich UI rendering', () => {
    const evidence = {
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      simulatedCompletedUploads: 0,
      liveDispatchedOnlyUploads: 0,
      latestLiveUploadCompletedAt: Date.now() - 1_000,
      latestLiveUpload: {
        completedAt: Date.now() - 1_000,
        source: 'release-status' as const,
      },
    };

    expect(buildLatestLiveUploadTraceLine(evidence)).toContain('样本名未记录');
    expect(hasMeaningfulLatestLiveUploadTrace(evidence)).toBe(false);
  });
});
