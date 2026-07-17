/**
 * @format
 * UploadScreen tests — validates rendering, navigation, and runtime banner logic.
 * File queue rendering requires integration tests with a real uploadService backend.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';

// ─── Shared mutable mock state ─────────────────────────────────────────────────
var mockRuntimeMode: 'live' | 'fallback' = 'live';
var mockRuntimeError: string | undefined;
var mockGatewayConfigValid = true;
var mockApplePrerequisitesReady = false;
var mockFirstTestFlightBuildUploaded = false;
var mockAppStoreAssetsReady = false;
var mockAppleReleaseValidatedAt: number | undefined;
var mockAppStoreAssetsValidatedAt: number | undefined;
var mockPreflightOverallStatus: 'PASS' | 'FAIL' | undefined;
var mockPreflightBlockingCount: number | undefined;
var mockPreflightNextActions: string[] = [];
var mockPreflightFailedChecks: string[] = [];
var mockPreflightReportGeneratedAt: number | undefined;
var mockAppleMissingInputs: string[] = [];
var mockTriggerTagName: string | undefined;
var mockTriggerGateReady: boolean | undefined;
var mockTriggerGateFailures: string[] = [];
var mockReleaseActiveUploads = 0;
var mockReleaseCompletedUploads = 0;
var mockReleaseLiveCompletedUploads = 0;
var mockReleaseSimulatedCompletedUploads = 0;
var mockReleaseLiveDispatchedOnlyUploads = 0;
var mockReleaseLatestLiveUploadCompletedAt: number | undefined;
var mockReleaseLatestLiveUpload: any | undefined;
var mockReleaseUploadEvidenceSummary: string | undefined;
var mockUploadQueue: any[] = [];

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    runtimeMode: mockRuntimeMode,
    runtimeError: mockRuntimeError,
    gatewayConfigValid: mockGatewayConfigValid,
    preflightOverallStatus: mockPreflightOverallStatus,
    preflightBlockingCount: mockPreflightBlockingCount,
    preflightNextActions: mockPreflightNextActions,
    preflightFailedChecks: mockPreflightFailedChecks,
    preflightReportGeneratedAt: mockPreflightReportGeneratedAt,
    applePrerequisitesReady: mockApplePrerequisitesReady,
    firstTestFlightBuildUploaded: mockFirstTestFlightBuildUploaded,
    appStoreAssetsReady: mockAppStoreAssetsReady,
    appleReleaseValidatedAt: mockAppleReleaseValidatedAt,
    appStoreAssetsValidatedAt: mockAppStoreAssetsValidatedAt,
    appleMissingInputs: mockAppleMissingInputs,
    triggerTagName: mockTriggerTagName,
    triggerGateReady: mockTriggerGateReady,
    triggerGateFailures: mockTriggerGateFailures,
    releaseActiveUploads: mockReleaseActiveUploads,
    releaseCompletedUploads: mockReleaseCompletedUploads,
    releaseLiveCompletedUploads: mockReleaseLiveCompletedUploads,
    releaseSimulatedCompletedUploads: mockReleaseSimulatedCompletedUploads,
    releaseLiveDispatchedOnlyUploads: mockReleaseLiveDispatchedOnlyUploads,
    releaseLatestLiveUploadCompletedAt: mockReleaseLatestLiveUploadCompletedAt,
    releaseLatestLiveUpload: mockReleaseLatestLiveUpload,
    releaseUploadEvidenceSummary: mockReleaseUploadEvidenceSummary,
  }),
}));

jest.mock('../src/services/uploadService', () => ({
  uploadService: {
    getQueue: () => mockUploadQueue,
    subscribe: (listener: (queue: any[]) => void) => {
      listener(mockUploadQueue);
      return jest.fn();
    },
    retryUpload: jest.fn(),
    removeFile: jest.fn((fileId: string) => {
      mockUploadQueue = mockUploadQueue.filter(file => file.id !== fileId);
    }),
    markFileForNextDispatch: jest.fn(),
    formatBytes: (bytes: number) => bytes === 0 ? '未知大小' : `${bytes} B`,
  },
  enqueueUpload: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: any) => children,
  useNavigation: () => ({navigate: mockNavigate}),
  useRoute: () => ({params: {}}),
}));

// ─── Component ────────────────────────────────────────────────────────────────
import {UploadScreen} from '../src/screens/UploadScreen';

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('UploadScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRuntimeMode = 'live';
    mockRuntimeError = undefined;
    mockGatewayConfigValid = true;
    mockPreflightOverallStatus = undefined;
    mockApplePrerequisitesReady = false;
    mockFirstTestFlightBuildUploaded = false;
    mockAppStoreAssetsReady = false;
    mockAppleReleaseValidatedAt = undefined;
    mockAppStoreAssetsValidatedAt = undefined;
    mockPreflightBlockingCount = undefined;
    mockPreflightNextActions = [];
    mockPreflightFailedChecks = [];
    mockPreflightReportGeneratedAt = undefined;
    mockAppleMissingInputs = [];
    mockTriggerTagName = undefined;
    mockTriggerGateReady = undefined;
    mockTriggerGateFailures = [];
    mockReleaseActiveUploads = 0;
    mockReleaseCompletedUploads = 0;
    mockReleaseLiveCompletedUploads = 0;
    mockReleaseSimulatedCompletedUploads = 0;
    mockReleaseLiveDispatchedOnlyUploads = 0;
    mockReleaseLatestLiveUploadCompletedAt = undefined;
    mockReleaseLatestLiveUpload = undefined;
    mockReleaseUploadEvidenceSummary = undefined;
    mockUploadQueue = [];
  });

  // ── Empty state ──────────────────────────────────────────────────────────────
  it('renders empty state with upload prompt', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '暂无上传任务')).toBeDefined();
    expect(texts.find(t => t.props.children === '📭')).toBeDefined();
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('无大小限制'))).toBeDefined();
  });

  it('shows correct file count (0) in header when empty', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children != null && (t.props.children === 0 || (Array.isArray(t.props.children) && t.props.children[0] === 0)))).toBeDefined();
  });

  it('keeps showing waiting-for-fallback evidence when runtime queue is empty but release-status still has active uploads', async () => {
    mockUploadQueue = [];
    mockReleaseActiveUploads = 2;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });

    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('上传样本计数：LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 2 · 提测真值 等待回流');
    expect(textDump).toContain('上传队列正在跑，等至少一条 LIVE 样本进入最终 done 并记录 completedAt 后，才算提测真值。');
  });

  it('shows + 上传 button in header', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '+ 上传')).toBeDefined();
  });

  // ── Runtime banner ───────────────────────────────────────────────────────────
  it('shows fallback mode banner in fallback mode', async () => {
    mockRuntimeMode = 'fallback';
    mockGatewayConfigValid = false;
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '当前为回退模式')).toBeDefined();
  });

  it('shows runtime error text when runtimeError is set', async () => {
    mockRuntimeMode = 'fallback';
    mockRuntimeError = 'Gateway unreachable';
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('Gateway unreachable'))).toBeDefined();
  });

  it('shows Gateway configured hint when gatewayConfigValid is true in fallback', async () => {
    mockRuntimeMode = 'fallback';
    mockRuntimeError = undefined;
    mockGatewayConfigValid = true;
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('Gateway 配置已就绪'))).toBeDefined();
  });

  it('hides runtime banner in live mode', async () => {
    mockRuntimeMode = 'live';
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '当前为回退模式')).toBeUndefined();
  });

  // ── Upload policy banner ─────────────────────────────────────────────────────
  it('always shows upload policy banner regardless of mode', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('无大小限制'))).toBeDefined();
  });

  // ── Navigation ───────────────────────────────────────────────────────────────
  it('navigates to GatewaySettings from fallback banner "去配置" button', async () => {
    mockRuntimeMode = 'fallback';
    mockGatewayConfigValid = false;
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const btn = touchables.find(b =>
      b.findAllByType(Text).some(t => t.props.children === '去配置')
    );
    expect(btn).toBeDefined();
    ReactTestRenderer.act(() => { (btn as any).props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('GatewaySettings');
  });

  it('navigates to Chat when "选择文件上传" is pressed (empty state)', async () => {
    // In empty state, pressing the upload button opens an alert (not navigation).
    // Test that the upload button exists and is pressable.
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    // Find "选择文件上传" or "+ 上传" button
    const uploadBtn = touchables.find(b =>
      b.findAllByType(Text).some(t =>
        typeof t.props.children === 'string' &&
        (t.props.children.includes('选择文件上传') || t.props.children === '+ 上传')
      )
    );
    expect(uploadBtn).toBeDefined();
  });

  it('shows trigger gate blockers inside upload closure card', async () => {
    mockTriggerTagName = 'v0.1.0';
    mockTriggerGateReady = false;
    mockTriggerGateFailures = [
      '工作区仍有未提交改动，当前不会安全触发 v0.1.0',
      'origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build',
    ];
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('仓库触发门禁：仓库触发门禁未过（v0.1.0）');
    expect(textDump).toContain('仓库态说明：工作区仍有未提交改动，当前不会安全触发 v0.1.0；origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build');
    expect(textDump).toContain('仓库剩余门禁数：2 / 4');
    expect(textDump).toContain('仓库触发责任：封版 / 改版本 1 项；仓库封版清理 1 项');
    expect(textDump).toContain('当前触发 tag：v0.1.0');
    expect(textDump).toContain('仓库态阻塞：工作区仍有未提交改动，当前不会安全触发 v0.1.0');
    expect(textDump).toContain('仓库态阻塞：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build');
    expect(textDump).toContain('待封版 / 改版本：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build');
    expect(textDump).toContain('待仓库封版清理：工作区仍有未提交改动，当前不会安全触发 v0.1.0');
    expect(textDump).toContain('工作区门禁：工作区仍有未提交改动，当前不会安全触发 v0.1.0。工作区门禁未通过：工作区仍有未提交改动，当前不会安全触发 v0.1.0');
    expect(textDump).toContain('远端 tag 门禁：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build。远端 tag 门禁未通过：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build');
  });

  it('surfaces LIVE and simulated completed upload evidence separately', async () => {
    const now = Date.now();
    mockUploadQueue = [
      {
        id: 'live-1',
        name: '真实回流.jpg',
        uri: 'file:///live.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 1024,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '13:30',
        executionMode: 'live',
        completedAt: now - 30 * 60 * 1000,
        agent: '黑金',
      },
      {
        id: 'sim-1',
        name: '模拟回流.pdf',
        uri: 'demo://sim.pdf',
        type: 'document',
        mimeType: 'application/pdf',
        size: 2048,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '13:31',
        executionMode: 'simulated',
        completedAt: now - 40 * 60 * 1000,
        agent: '智联',
      },
      {
        id: 'live-dispatched-only',
        name: '只分派未回流.mov',
        uri: 'file:///dispatch.mov',
        type: 'video',
        mimeType: 'video/mp4',
        size: 4096,
        status: 'dispatched',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'dispatched',
        timestamp: '13:32',
        executionMode: 'live',
        agent: '黑金',
      },
    ];

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    const textDump = texts
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('已拿到 1 条 LIVE 真回流样本');
    expect(textDump).toContain('最近一条：真实回流.jpg');
    expect(textDump).toContain('最近一条 LIVE 真回流时间');
    expect(textDump).toContain('最近一条 LIVE 真回流证据：真实回流.jpg');
    expect(textDump).toContain('来源 运行态真回流');
    expect(textDump).toContain('执行 黑金');
    expect(textDump).toContain('仍可作为提测依据');
    expect(textDump).toContain('最近一条 LIVE 真回流证据：真实回流.jpg');
    expect(textDump).toContain('执行 黑金');
    expect(textDump).toContain('另有 1 条 LIVE 附件只到“已分派”');
  });

  it('prefers runtime release upload evidence summary when present', async () => {
    mockReleaseUploadEvidenceSummary = 'LIVE完成 6 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准';

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('上传样本口径：LIVE完成 6 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准');
  });

  it('surfaces TestFlight preflight blockers beside upload evidence', async () => {
    const now = Date.now();
    mockUploadQueue = [
      {
        id: 'live-1',
        name: '真实回流.jpg',
        uri: 'file:///live.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 1024,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '13:30',
        executionMode: 'live',
        completedAt: now - 20 * 60 * 1000,
        agent: '黑金',
      },
    ];
    mockPreflightOverallStatus = 'FAIL';
    mockPreflightBlockingCount = 1;
    mockPreflightNextActions = ['先补 Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets，再重新跑 npm run preflight:testflight。'];
    mockPreflightFailedChecks = ['TestFlight 输入预检'];
    mockPreflightReportGeneratedAt = now - 20 * 60 * 1000;
    mockAppleMissingInputs = ['APPLE_API_KEY_ID', 'APPLE_API_ISSUER_ID', 'APPLE_TEAM_ID', 'APPLE_API_KEY_CONTENT'];

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('TestFlight 总预检：FAIL · 阻塞 1');
    expect(textDump).toContain('总预检失败项：TestFlight 输入预检');
    expect(textDump).toContain('当前 Apple 缺口：APPLE_API_KEY_ID、APPLE_API_ISSUER_ID、APPLE_TEAM_ID、APPLE_API_KEY_CONTENT');
    expect(textDump).toContain('最近总预检时间：');
    expect(textDump).toContain('当前建议动作：先补 Apple Developer');
    expect(textDump).toContain('去补 Apple 上线配置');
  });

  it('keeps Apple release readiness blocked when missing-input list is empty but explicit Apple status is still not ready', async () => {
    const now = Date.now();
    mockUploadQueue = [
      {
        id: 'live-1',
        name: '真实回流.jpg',
        uri: 'file:///live.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 1024,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '16:20',
        executionMode: 'live',
        completedAt: now - 20 * 60 * 1000,
        agent: '黑金',
      },
    ];
    mockPreflightOverallStatus = 'PASS';
    mockPreflightBlockingCount = 0;
    mockPreflightReportGeneratedAt = now - 20 * 60 * 1000;
    mockAppleMissingInputs = [];
    mockApplePrerequisitesReady = false;
    mockAppStoreAssetsReady = true;
    mockAppStoreAssetsValidatedAt = now - 20 * 60 * 1000;
    mockAppleReleaseValidatedAt = undefined;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('提测准备度：待收口');
    expect(textDump).toContain('补齐 Apple Developer、App Store Connect App 记录');
    expect(textDump).toContain('去补 Apple 上线配置');
  });
  it('shows upload-closure card even before the first live sample exists', async () => {
    mockUploadQueue = [];
    mockPreflightOverallStatus = 'FAIL';
    mockPreflightBlockingCount = 1;
    mockPreflightNextActions = ['先补 Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets，再重新跑 npm run preflight:testflight。'];

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('当前还没有 LIVE 真回流样本');
    expect(textDump).toContain('上传入口已经就绪，但提测口径下仍缺至少一条 LIVE Gateway 真回流样本。');
    expect(textDump).toContain('先跑上传闭环');
  });

  it('keeps generated LIVE upload evidence visible even when current queue is empty', async () => {
    const now = Date.now();
    mockUploadQueue = [];
    mockRuntimeMode = 'live';
    mockGatewayConfigValid = true;
    mockApplePrerequisitesReady = true;
    mockAppStoreAssetsReady = true;
    mockAppleReleaseValidatedAt = now - 20 * 60 * 1000;
    mockAppStoreAssetsValidatedAt = now - 20 * 60 * 1000;
    mockPreflightOverallStatus = 'PASS';
    mockPreflightBlockingCount = 0;
    mockPreflightReportGeneratedAt = now - 20 * 60 * 1000;
    mockReleaseCompletedUploads = 1;
    mockReleaseLiveCompletedUploads = 1;
    mockReleaseLatestLiveUploadCompletedAt = now - 20 * 60 * 1000;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('最近已拿到 1 条 LIVE 真回流样本');
    expect(textDump).toContain('上传样本计数：LIVE完成 1 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 已拿到 LIVE done');
    expect(textDump).not.toContain('最近一条 LIVE 真回流证据：样本名未记录 · 来源 仓库预检回填');
    expect(textDump).toContain('首个 Build 三件套：Gateway LIVE 已就绪 · LIVE done 有效（1 条） · 总预检 PASS 有效');
    expect(textDump).toContain('当前主卡点：三件套已闭合');
  });

  it('shows generated release-status live trace when runtime queue has no live done sample', async () => {
    const now = Date.now();
    mockUploadQueue = [];
    mockReleaseCompletedUploads = 1;
    mockReleaseLiveCompletedUploads = 1;
    mockReleaseLatestLiveUploadCompletedAt = now - 20 * 60 * 1000;
    mockReleaseLatestLiveUpload = {
      id: 'generated-live-1',
      name: 'release-status-live.zip',
      dispatchId: 'dispatch-generated-live-1',
      agent: '助理',
      completedAt: now - 20 * 60 * 1000,
      source: 'release-status',
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('最近一条 LIVE 真回流证据：release-status-live.zip');
    expect(textDump).toContain('来源 仓库预检回填');
    expect(textDump).toContain('调度 dispatch-generated-live-1');
    expect(textDump).toContain('执行 助理');
    expect(textDump).toContain('仍可作为提测依据');
  });

  it('falls back to generic latest LIVE label when release-status only has timestamp', async () => {
    const now = Date.now();
    mockUploadQueue = [];
    mockReleaseCompletedUploads = 1;
    mockReleaseLiveCompletedUploads = 1;
    mockReleaseLatestLiveUploadCompletedAt = now - 20 * 60 * 1000;
    mockReleaseLatestLiveUpload = {
      completedAt: now - 20 * 60 * 1000,
      source: 'release-status',
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).not.toContain('最近一条 LIVE 真回流证据：样本名未记录');
    expect(textDump).toContain('最近一条 LIVE 真回流：');
  });

  it('warns simulated-only completions cannot satisfy live release evidence', async () => {
    const now = Date.now();
    mockUploadQueue = [
      {
        id: 'sim-only-1',
        name: '模拟完成.pdf',
        uri: 'demo://sim-only.pdf',
        type: 'document',
        mimeType: 'application/pdf',
        size: 2048,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '14:20',
        executionMode: 'simulated',
        completedAt: now - 10 * 60 * 1000,
        agent: '智联',
      },
    ];

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('当前焦点：模拟完成.pdf');
    expect(textDump).toContain('直传 · 模拟 · 已完成');
    expect(textDump).toContain('当前已完成里还有 1 条模拟回流');
    expect(textDump).toContain('这些模拟完成不能抵扣首条 LIVE done 缺口');
    expect(textDump).toContain('提测前仍要补一条真实 Gateway 回流');
    expect(textDump).toContain('提测准备度：');
    expect(textDump).toContain('LIVE完成 0');
  });

  it('warns live dispatched-only uploads are not final release evidence', async () => {
    mockUploadQueue = [
      {
        id: 'live-dispatched-1',
        name: '真实分派未完成.mov',
        uri: 'file:///live-dispatched.mov',
        type: 'video',
        mimeType: 'video/mp4',
        size: 4096,
        status: 'dispatched',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'dispatched',
        timestamp: '14:30',
        executionMode: 'live',
        agent: '黑金',
      },
    ];

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('当前焦点：真实分派未完成.mov');
    expect(textDump).toContain('直传 · LIVE · 已进入调度链');
    expect(textDump).toContain('另有 1 条 LIVE 附件只到“已分派”');
    expect(textDump).toContain('即便已经进入真实调度链，也不能计入提测真值');
    expect(textDump).toContain('LIVE仅分派 1');
  });

  it('marks stale LIVE sample and stale PASS preflight as needing refresh', async () => {
    const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    mockUploadQueue = [
      {
        id: 'live-stale-1',
        name: '过期回流.pdf',
        uri: 'file:///stale.pdf',
        type: 'document',
        mimeType: 'application/pdf',
        size: 8192,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '09:20',
        executionMode: 'live',
        completedAt: now - fourDaysMs,
        agent: '智联',
      },
    ];
    mockPreflightOverallStatus = 'PASS';
    mockPreflightBlockingCount = 0;
    mockPreflightReportGeneratedAt = now - fourDaysMs;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('已有 LIVE 真回流样本，但提测真值已经过期');
    expect(textDump).toContain('最近一条 LIVE 真回流已经过旧');
    expect(textDump).toContain('提测前建议补跑一条新样本');
    expect(textDump).toContain('PASS 记录已不够新鲜，触发 Build 前要重跑总预检');
    expect(textDump).toContain('总预检 PASS 也有 72 小时有效窗');
    expect(textDump).toContain('当前记录已过期，不能和新的上传样本一起作为触发 Build 的最终依据');
    expect(textDump).toContain('已过期');
  });

  it('shows build-trigger triplet gate on upload screen when gateway/upload/preflight are not all closed', async () => {
    const now = Date.now();
    mockRuntimeMode = 'fallback';
    mockGatewayConfigValid = false;
    mockUploadQueue = [
      {
        id: 'sim-only-gate-1',
        name: '模拟完成用于门禁.pdf',
        uri: 'demo://gate.pdf',
        type: 'document',
        mimeType: 'application/pdf',
        size: 2048,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '17:00',
        executionMode: 'simulated',
        completedAt: now - 30 * 60 * 1000,
        agent: '智联',
      },
    ];
    mockPreflightOverallStatus = 'FAIL';
    mockPreflightBlockingCount = 1;
    mockPreflightReportGeneratedAt = now - 30 * 60 * 1000;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('首个 Build 三件套：Gateway 仍在回退模式 · 只有模拟完成，缺 LIVE done · 总预检 FAIL');
    expect(textDump).toContain('当前主卡点：Gateway 门禁：Gateway 仍在回退模式');
    expect(textDump).toContain('剩余门禁数：3 / 3');
    expect(textDump).toContain('Gateway 门禁：Gateway 仍在回退模式');
    expect(textDump).toContain('上传门禁：只有模拟完成，缺 LIVE done');
    expect(textDump).toContain('预检门禁：总预检 FAIL');
    expect(textDump).toContain('三项必须同时为真，才能作为触发 TestFlight Build 的最终依据');
  });

  it('shows build-trigger triplet gate as closed when gateway/upload/preflight are all fresh and valid', async () => {
    const now = Date.now();
    mockRuntimeMode = 'live';
    mockGatewayConfigValid = true;
    mockApplePrerequisitesReady = true;
    mockAppStoreAssetsReady = true;
    mockAppleReleaseValidatedAt = now - 20 * 60 * 1000;
    mockAppStoreAssetsValidatedAt = now - 20 * 60 * 1000;
    mockUploadQueue = [
      {
        id: 'live-gate-1',
        name: '真实回流用于门禁.jpg',
        uri: 'file:///live-gate.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 4096,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '17:05',
        executionMode: 'live',
        completedAt: now - 20 * 60 * 1000,
        agent: '黑金',
      },
    ];
    mockPreflightOverallStatus = 'PASS';
    mockPreflightBlockingCount = 0;
    mockPreflightReportGeneratedAt = now - 20 * 60 * 1000;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('首个 Build 三件套：Gateway LIVE 已就绪 · LIVE done 有效（1 条） · 总预检 PASS 有效');
    expect(textDump).toContain('当前主卡点：三件套已闭合');
    expect(textDump).toContain('主卡点原因：三项运行态真值已同屏闭合，可进入触发 TestFlight Build 前最后确认。');
    expect(textDump).toContain('剩余门禁数：0 / 3');
    expect(textDump).toContain('Gateway 门禁：Gateway LIVE 已就绪');
    expect(textDump).toContain('上传门禁：LIVE done 有效（1 条）');
    expect(textDump).toContain('预检门禁：总预检 PASS 有效');
    expect(textDump).toContain('三项运行态真值已同屏闭合，可进入触发前最后确认');
  });

  it('keeps upload build gate open when fresh LIVE done still has dispatched-only tail', async () => {
    const now = Date.now();
    mockRuntimeMode = 'live';
    mockGatewayConfigValid = true;
    mockApplePrerequisitesReady = true;
    mockAppStoreAssetsReady = true;
    mockAppleReleaseValidatedAt = now - 20 * 60 * 1000;
    mockAppStoreAssetsValidatedAt = now - 20 * 60 * 1000;
    mockUploadQueue = [
      {
        id: 'live-done-with-tail-1',
        name: '已完成真实回流.jpg',
        uri: 'file:///live-done-with-tail.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 4096,
        status: 'done',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'done',
        timestamp: '18:50',
        executionMode: 'live',
        completedAt: now - 20 * 60 * 1000,
        agent: '黑金',
      },
      {
        id: 'live-dispatched-tail-1',
        name: '仍未最终回流.mov',
        uri: 'file:///live-dispatched-tail.mov',
        type: 'video',
        mimeType: 'video/mp4',
        size: 8192,
        status: 'dispatched',
        progress: 100,
        transferMode: 'direct',
        resumable: false,
        queueStage: 'dispatched',
        timestamp: '18:52',
        executionMode: 'live',
        agent: '黑金',
      },
    ];
    mockPreflightOverallStatus = 'PASS';
    mockPreflightBlockingCount = 0;
    mockPreflightReportGeneratedAt = now - 20 * 60 * 1000;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const textDump = tree!.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? ''))
      .join('\n');

    expect(textDump).toContain('首个 Build 三件套：Gateway LIVE 已就绪 · LIVE done 有效但仍有 1 条仅分派 · 总预检 PASS 有效');
    expect(textDump).toContain('当前主卡点：上传门禁：LIVE done 有效但仍有 1 条仅分派');
    expect(textDump).toContain('主卡点原因：虽然最近 72 小时内已有 LIVE 最终 done 回流，但仍有 1 条 LIVE 样本只到 dispatched');
    expect(textDump).toContain('剩余门禁数：1 / 3');
    expect(textDump).toContain('上传门禁：LIVE done 有效但仍有 1 条仅分派');
    expect(textDump).toContain('首个 Build 前应等它们 done 或明确清理队列');
    expect(textDump).toContain('三项必须同时为真，才能作为触发 TestFlight Build 的最终依据');
  });

  // ── Component structure ──────────────────────────────────────────────────────
  it('renders with correct title in header', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '📤 上传管理')).toBeDefined();
  });

  it('renders empty state subheading with automatic transfer hint text', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('自动选择直传或分片续传'))).toBeDefined();
  });
});
