import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {ProjectLibraryScreen} from '../src/screens/ProjectLibraryScreen';

const mockNavigate = jest.fn();
let mockUploads: any[] = [
  {id: 'upload-1', name: 'report.pdf', type: 'document', status: 'processing', progress: 60, executionMode: 'simulated'},
  {id: 'upload-2', name: '现场回流.png', type: 'image', status: 'done', progress: 100, executionMode: 'simulated', completedAt: Date.now()},
  {id: 'upload-3', name: 'LIVE已分派但未完成.png', type: 'image', status: 'dispatched', progress: 100, executionMode: 'live'},
];
let mockReleaseActiveUploads = 0;
let mockReleaseUploadEvidenceSummary: string | undefined;

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    runtimeMode: 'live',
    applePrerequisitesReady: false,
    firstTestFlightBuildUploaded: false,
    appStoreAssetsReady: false,
    appleReleaseSummary: 'Apple Developer / App Store Connect / GitHub CI 变量仍待补齐',
    appleReleaseValidatedAt: undefined,
    appStoreAssetsValidatedAt: undefined,
    preflightReportGeneratedAt: undefined,
    preflightOverallStatus: undefined,
    preflightBlockingCount: undefined,
    preflightFailedChecks: ['TestFlight 输入预检'],
    preflightNextActions: ['先补齐 Apple API Key / Issuer ID / Team ID，再重跑 npm run preflight:testflight'],
    appleMissingInputs: [],
    triggerTagName: 'v0.1.0',
    triggerGateReady: false,
    triggerGateFailures: [
      '工作区仍有未提交改动，当前不会安全触发 v0.1.0',
      'origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build',
    ],
    releaseActiveUploads: mockReleaseActiveUploads,
    releaseCompletedUploads: 0,
    releaseLiveCompletedUploads: 0,
    releaseSimulatedCompletedUploads: 0,
    releaseLiveDispatchedOnlyUploads: 0,
    releaseLatestLiveUploadCompletedAt: undefined,
    releaseLatestLiveUpload: undefined,
    releaseUploadEvidenceSummary: mockReleaseUploadEvidenceSummary,
    appleValidationDetail: 'Missing Apple inputs: APPLE_API_KEY_ID, APPLE_API_ISSUER_ID',
    assetsValidationDetail: 'App Store 素材预检尚未产生详细日志',
    preflightValidationDetail: 'TestFlight 总预检尚未产生详细报告',
    tasks: [
      {id: 'task-1', title: '推进 AIBrainIM P1 闭环', owner: '黑金', state: 'running', eta: '10m', next: '继续推进移动端驾驶舱', priority: 'P0'},
      {id: 'task-2', title: '任务B', owner: '助理', state: 'blocked', eta: '待确认', next: '等待拍板', priority: 'P1'},
    ],
    uploads: mockUploads,
    dispatches: [
      {
        id: 'dispatch-1',
        userText: '推进 AIBrainIM P1',
        reply: '调度链正在执行中',
        status: 'processing',
        taskId: 'task-runtime-1',
        dispatchId: 'dispatch-runtime-1',
        sessionKey: 'feishu:heijin:runtime',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'dispatch-upload-dispatched-only',
        userText: '附件已分派但未完成',
        reply: '附件只进入了调度链，还没有最终处理结果。',
        status: 'dispatched',
        taskId: 'task-upload-dispatched-only',
        dispatchId: 'dispatch-upload-dispatched-only',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'upload',
      },
    ],
    confirmations: [
      {id: 'confirm-1', title: '确认上线路径', description: '等待确认', agent: '助理', urgency: 'high', timestamp: '17:30', status: 'pending'},
    ],
    agents: [
      {id: 'heijin', name: '黑金', role: 'AI 项目工程师', status: 'working', focus: 'AIBrainIM', accent: '#f97316', current: '处理中'},
      {id: 'zhuli', name: '助理', role: '协调者', status: 'online', focus: '调度', accent: '#22d3ee', current: '待命'},
    ],
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
}));

describe('ProjectLibraryScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUploads = [
      {id: 'upload-1', name: 'report.pdf', type: 'document', status: 'processing', progress: 60, executionMode: 'simulated'},
      {id: 'upload-2', name: '现场回流.png', type: 'image', status: 'done', progress: 100, executionMode: 'simulated', completedAt: Date.now()},
      {id: 'upload-3', name: 'LIVE已分派但未完成.png', type: 'image', status: 'dispatched', progress: 100, executionMode: 'live'},
    ];
    mockReleaseActiveUploads = 0;
    mockReleaseUploadEvidenceSummary = undefined;
  });

  function findPressableByLabel(
    root: ReactTestRenderer.ReactTestInstance,
    label: string,
  ) {
    const pressables = root.findAllByType(TouchableOpacity);
    return pressables.find(node => {
      const texts = node.findAllByType(Text).map(textNode => {
        const child = textNode.props.children;
        return Array.isArray(child) ? child.join('') : child;
      });
      return texts.includes(label);
    });
  }

  it('renders runtime projects and catalog CTAs', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const root = tree!.root;
    expect(root.findAllByType(Text).some(node => node.props.children === '📁 项目库')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '聚源三维运行投影')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '回首页看总览')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '看上传队列')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '检查 Gateway 连接')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '看最近调度')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '去清确认项')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === 'TestFlight / Apple 上线准备')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '🚀 去补 Apple 上线配置')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '看上传队列')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '距离首个 TestFlight Build 还差最后几步')).toBe(true);
    const texts = root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });
    expect(texts.some(text => text.includes('当前阻塞'))).toBe(true);
    expect(texts.some(text => text.includes('上传回流真值：LIVE dispatched-only 不能作为提测真值'))).toBe(true);
    expect(texts.some(text => text.includes('上传真值'))).toBe(true);
    expect(texts.some(text => text.includes('下一步'))).toBe(true);
    expect(texts.some(text => text.includes('已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('LIVE完成 0 · LIVE仅分派 1 · 模拟完成 1 · 处理中 1 · 提测真值 缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('先补齐 Apple API Key / Issuer ID / Team ID，再重跑 npm run preflight:testflight'))).toBe(true);
    expect(texts.some(text => text.includes('当前主卡点：上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(texts.some(text => text.includes('主卡点原因：已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('主卡点原因：已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('剩余门禁数：2 / 3'))).toBe(true);
    expect(texts.some(text => text.includes('Gateway 门禁：Gateway LIVE 已就绪'))).toBe(true);
    expect(texts.some(text => text.includes('上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(texts.some(text => text.includes('预检门禁：总预检未生成'))).toBe(true);
    expect(texts.some(text => text.includes('上传样本新鲜度：已有 1 条 LIVE 仅分派样本，仍缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('暂无 LIVE 真回流样本；1 条 LIVE 仍停在已分派'))).toBe(true);
    expect(texts.some(text => text.includes('最近一条 LIVE 真回流证据：样本名未记录'))).toBe(false);
    expect(texts.some(text => text.includes('Apple 校验新鲜度：Apple 前置未形成可校验真值'))).toBe(true);
    expect(texts.some(text => text.includes('总预检新鲜度：未记录最近一次总预检时间'))).toBe(true);
    expect(texts.some(text => text.includes('Build：首个 TestFlight Build 仍不可触发'))).toBe(true);
    expect(texts.some(text => text.includes('仓库触发摘要：仓库触发门禁未过（v0.1.0）'))).toBe(true);
    expect(texts.some(text => text.includes('仓库剩余门禁数：'))).toBe(true);
    expect(texts.some(text => text.includes('仓库触发责任：封版 / 改版本 1 项；仓库封版清理 1 项'))).toBe(true);
    expect(texts.some(text => text.includes('当前触发 tag：v0.1.0'))).toBe(true);
    expect(texts.some(text => text.includes('仓库态阻塞：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
    expect(texts.some(text => text.includes('仓库态阻塞：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(texts.some(text => text.includes('待封版 / 改版本：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(texts.some(text => text.includes('待仓库封版清理：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
  });

  it('prefers runtime release upload evidence summary in project cards when present', async () => {
    mockReleaseUploadEvidenceSummary = 'LIVE完成 7 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准';

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const texts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(texts.some(text => text.includes('上传样本口径：LIVE完成 7 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准'))).toBe(true);
  });

  it('routes project signals into AIBrainIM and 聚源三维 runtime cards', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const root = tree!.root;
    const texts = root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(texts.some(text => text.includes('已识别 1 个移动端相关任务、1 条调度、0 个相关附件'))).toBe(true);
    expect(texts.some(text => text.includes('已识别 0 个聚源三维相关任务、0 条调度信号'))).toBe(true);
    expect(texts.some(text => text.includes('当前提测收口进度'))).toBe(true);
    expect(texts.some(text => text.includes('当前阻塞'))).toBe(true);
    expect(texts.some(text => text.includes('上传回流真值：LIVE dispatched-only 不能作为提测真值'))).toBe(true);
    expect(texts.some(text => text.includes('上传真值'))).toBe(true);
    expect(texts.some(text => text.includes('下一步'))).toBe(true);
    expect(texts.some(text => text.includes('已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('LIVE完成 0 · LIVE仅分派 1 · 模拟完成 1 · 处理中 1 · 提测真值 缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('先补齐 Apple API Key / Issuer ID / Team ID，再重跑 npm run preflight:testflight'))).toBe(true);
    expect(texts.some(text => text.includes('当前主卡点：上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(texts.some(text => text.includes('剩余门禁数：2 / 3'))).toBe(true);
    expect(texts.some(text => text.includes('Gateway 门禁：Gateway LIVE 已就绪'))).toBe(true);
    expect(texts.some(text => text.includes('上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(texts.some(text => text.includes('预检门禁：总预检未生成'))).toBe(true);
    expect(texts.some(text => text.includes('上传样本新鲜度：已有 1 条 LIVE 仅分派样本，仍缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('暂无 LIVE 真回流样本；1 条 LIVE 仍停在已分派'))).toBe(true);
    expect(texts.some(text => text.includes('最近一条 LIVE 真回流证据：样本名未记录'))).toBe(false);
    expect(texts.some(text => text.includes('Apple 校验新鲜度：Apple 前置未形成可校验真值'))).toBe(true);
    expect(texts.some(text => text.includes('总预检新鲜度：未记录最近一次总预检时间'))).toBe(true);
    expect(texts.some(text => text.includes('Build：首个 TestFlight Build 仍不可触发'))).toBe(true);
    expect(texts.some(text => text.includes('仓库触发摘要：仓库触发门禁未过（v0.1.0）'))).toBe(true);
    expect(texts.some(text => text.includes('仓库剩余门禁数：'))).toBe(true);
    expect(texts.some(text => text.includes('仓库触发责任：封版 / 改版本 1 项；仓库封版清理 1 项'))).toBe(true);
    expect(texts.some(text => text.includes('仓库态说明：工作区仍有未提交改动，当前不会安全触发 v0.1.0；origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(texts.some(text => text.includes('当前触发 tag：v0.1.0'))).toBe(true);
  });

  it('does not treat simulated upload-only completion as release-ready evidence in project library', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const texts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    // Keep this strict: the project library must inherit the same LIVE-only
    // readiness gate as Dashboard/Profile instead of counting simulated uploads.
    expect(texts.some(text => text.includes('上传闭环已验证'))).toBe(false);
    expect(texts.some(text => text.includes('上传真值'))).toBe(true);
    expect(texts.some(text => text.includes('已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(texts.some(text => text.includes('Build：首个 TestFlight Build 仍不可触发'))).toBe(true);
  });

  it('does not treat dispatched-only LIVE uploads as final release evidence in project library', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const texts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(texts.some(text => text.includes('距离首个 TestFlight Build 还差最后几步'))).toBe(true);
    expect(texts.some(text => text.includes('上传真值'))).toBe(true);
    expect(texts.some(text => text.includes('Build：首个 TestFlight Build 仍不可触发'))).toBe(true);
    expect(texts.some(text => text.includes('上传：上传闭环已验证'))).toBe(false);
    expect(texts.some(text => text.includes('下一步'))).toBe(true);
  });

  it('keeps fallback active uploads visible when runtime uploads are empty', async () => {
    mockUploads = [];
    mockReleaseActiveUploads = 2;

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const texts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(texts.some(text => text.includes('LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 2 · 提测真值 等待回流'))).toBe(true);
    expect(texts.some(text => text.includes('上传样本新鲜度：还没有首个真实回流样本'))).toBe(true);
    expect(texts.some(text => text.includes('暂无 LIVE 真回流样本'))).toBe(true);
  });

  it('routes TestFlight project CTA to release readiness when Apple setup is the top blocker', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '🚀 去补 Apple 上线配置');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {screen: 'Profile'});
  });

  it('opens the release path board toward release readiness when Apple setup is the primary blocker', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const board = findPressableByLabel(tree!.root, '距离首个 TestFlight Build 还差最后几步');
    expect(board).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      board!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {screen: 'Profile'});
  });

  it('surfaces the top project focus queue for current closure priorities', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const root = tree!.root;
    const texts = root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(texts.some(text => text.includes('先做什么'))).toBe(true);
    expect(texts.some(text => text.includes('人工确认与收口'))).toBe(true);
    expect(texts.some(text => text.includes('当前有 1 个阻塞任务、1 项待确认'))).toBe(true);
    expect(texts.some(text => text.includes('Apple Developer / App Store Connect'))).toBe(true);
    expect(texts.some(text => text.includes('补齐 Apple Developer'))).toBe(true);
    expect(texts.some(text => text.includes('上传闭环') || text.includes('真实附件回流样本'))).toBe(true);
  });

  it('navigates to tab route with params when tapping dashboard CTA', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '回首页看总览');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {screen: 'Dashboard'});
  });

  it('navigates to upload queue when tapping secondary AIBrainIM CTA', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '看上传队列');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Upload', {
      focusDispatchId: undefined,
      focusFileId: 'upload-3',
    });
  });

  it('keeps a secondary path to upload validation when release closure still lacks a real upload sample', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '看上传队列');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Upload', {
      focusDispatchId: undefined,
      focusFileId: 'upload-3',
    });
  });

  it('navigates to recent dispatch when tapping secondary runtime CTA', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '看最近调度');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('DispatchChain', {
      focusDispatchId: 'dispatch-runtime-1',
    });
  });

  it('navigates to non-tab route directly when tapping gateway CTA', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProjectLibraryScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '检查 Gateway 连接');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('GatewaySettings');
  });
});
