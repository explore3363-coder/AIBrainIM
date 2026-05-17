import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {DashboardScreen} from '../src/screens/DashboardScreen';

const mockNavigate = jest.fn();
const mockRefresh = jest.fn();
let mockUploads: any[] = [
  {id: 'upload-1', name: 'roadmap.pdf', type: 'document', status: 'processing', progress: 60, timestamp: '17:28', agent: 'heijin', executionMode: 'simulated'},
  {id: 'upload-dispatched-live', name: 'live-dispatched.jpg', type: 'image', status: 'dispatched', progress: 100, timestamp: '17:31', agent: 'heijin', executionMode: 'live'},
];
let mockReleaseActiveUploads = 0;

function buildContextOverrides(): any {
  return {
    agents: [
      {id: 'heijin', name: '黑金', role: 'AI 项目工程师', status: 'working', focus: 'AIBrainIM', accent: '#f97316', current: '处理中'},
      {id: 'zhuli', name: '助理', role: '协调者', status: 'online', focus: '调度', accent: '#22d3ee', current: '待命'},
    ],
    tasks: [
      {id: 'task-1', title: '推进移动端闭环', owner: '黑金', state: 'running', eta: '10m', next: '继续补首页驾驶舱', priority: 'P0', sourceType: 'chat'},
      {id: 'task-2', title: '等待人工确认', owner: '助理', state: 'blocked', eta: '待确认', next: '等待拍板', priority: 'P1', sourceType: 'confirmation'},
    ],
    confirmations: [
      {id: 'confirm-1', title: '确认 TestFlight 路径', description: '还差 Apple 侧配置与物料', agent: '助理', urgency: 'high', timestamp: '17:30', status: 'pending'},
    ],
    dispatches: [
      {
        id: 'dispatch-1',
        userText: '继续推进 AIBrainIM P1',
        reply: '首页现在会优先展示 AI 产出流、调度状态和待确认项。',
        status: 'processing',
        taskId: 'task-runtime-1',
        dispatchId: 'dispatch-runtime-1',
        sessionKey: 'feishu:heijin:runtime',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        agentId: 'heijin',
        source: 'chat',
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
        agentId: 'heijin',
        source: 'upload',
      },
    ],
    uploads: mockUploads,
    pendingConfirmations: 1,
    refreshing: false,
    refresh: mockRefresh,
    runtimeMode: 'live',
    recentCaptures: [],
    lastSyncedAt: Date.now(),
    sessionCount: 3,
    gatewaySummary: 'OpenClaw Gateway 已连接',
    gatewayConfigValid: true,
    gatewayWarningCount: 0,
    applePrerequisitesReady: false,
    firstTestFlightBuildUploaded: false,
    appStoreAssetsReady: false,
    appleReleaseSummary: 'Apple Developer / App Store Connect / GitHub CI 变量仍待补齐',
    appleReleaseSource: 'default',
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
    releaseUploadEvidenceSummary: undefined,
    appleValidationDetail: 'Missing Apple inputs: APPLE_API_KEY_ID, APPLE_API_ISSUER_ID',
    assetsValidationDetail: 'App Store 素材预检尚未产生详细日志',
    preflightValidationDetail: 'TestFlight 总预检尚未产生详细报告',
    refreshGatewayStatus: jest.fn(),
    confirmItem: jest.fn(),
    deferItem: jest.fn(),
    reopenItem: jest.fn(),
    registerDispatch: jest.fn(),
    markLatestDispatchActive: jest.fn(),
    finalizeLatestDispatch: jest.fn(),
    registerKnowledgeCapture: jest.fn(),
    registerMemoryCapture: jest.fn(),
  };
}

let mockContext: any = buildContextOverrides();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => mockContext,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

jest.mock('../src/services/uploadService', () => ({
  uploadService: {
    getFiles: () => [],
    subscribe: () => () => {},
  },
}));

describe('DashboardScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRefresh.mockClear();
    mockUploads = [
      {id: 'upload-1', name: 'roadmap.pdf', type: 'document', status: 'processing', progress: 60, timestamp: '17:28', agent: 'heijin', executionMode: 'simulated'},
      {id: 'upload-dispatched-live', name: 'live-dispatched.jpg', type: 'image', status: 'dispatched', progress: 100, timestamp: '17:31', agent: 'heijin', executionMode: 'live'},
    ];
    mockReleaseActiveUploads = 0;
    mockContext = buildContextOverrides();
  });

  function findPressableByLabel(root: ReactTestRenderer.ReactTestInstance, label: string) {
    const pressables = root.findAllByType(TouchableOpacity);
    return pressables.find(node => {
      const texts = node.findAllByType(Text).map(textNode => {
        const child = textNode.props.children;
        return Array.isArray(child) ? child.join('') : child;
      });
      return texts.includes(label);
    });
  }

  it('renders the new dashboard spotlight content', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const root = tree!.root;
    expect(root.findAllByType(Text).some(node => node.props.children === '首页重点')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '首屏只保留用户真会关心的三件事')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === 'P1 正在从样板走向可用驾驶舱')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === 'TestFlight / App Store 还有 1 项待拍板')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '首个 Build 动作状态')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '未就绪')).toBe(true);
    const renderedTexts = root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });
    expect(renderedTexts.some(text => text.includes('距离首个 TestFlight Build 还差最后几步'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('主按钮动作：去补 Apple 上线配置'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('下一步：去补 Apple 上线配置'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('还差什么才能触发 Build'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传回流真值：LIVE dispatched-only 不能作为提测真值'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('TestFlight 总预检：总预检尚未形成真值'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('Apple 账号与提测前置：Apple 前置未补齐'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('App Store 素材：App Store 素材真值未通过'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('Apple 当前状态：Apple 前置未补齐'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('Apple 预检详情：Missing Apple inputs: APPLE_API_KEY_ID, APPLE_API_ISSUER_ID'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('总预检状态：总预检尚未形成真值'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('总预检新鲜度：未记录最近一次总预检时间'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('总预检详情：TestFlight 总预检尚未产生详细报告'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('总预检失败项：TestFlight 输入预检'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('总预检建议动作：先补齐 Apple API Key / Issuer ID / Team ID，再重跑 npm run preflight:testflight'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('素材当前状态：App Store 素材真值未通过'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('素材预检详情：App Store 素材预检尚未产生详细日志'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('TestFlight 当前状态：首个 TestFlight Build 仍不可触发'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库触发摘要：仓库触发门禁未过（v0.1.0） · 阻塞 2 项'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库当前卡点：仓库触发门禁未过（v0.1.0）：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库卡点原因：工作区门禁未通过：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库态说明：工作区仍有未提交改动，当前不会安全触发 v0.1.0；origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库剩余门禁数：2 / 4'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库触发责任：封版 / 改版本 1 项；仓库封版清理 1 项'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('当前触发 tag：v0.1.0'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库态阻塞：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('仓库态阻塞：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('待封版 / 改版本：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('待仓库封版清理：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传闭环状态：上传链路执行中，仍待首个真实回流样本'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传回流真值：LIVE dispatched-only 不能作为提测真值'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传真值说明：已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('首个 Build 三件套：Gateway LIVE 已就绪 · LIVE 仅分派，缺 done · 总预检未生成'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('当前主卡点：上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('主卡点原因：已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('剩余门禁数：2 / 3'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('Gateway 门禁：Gateway LIVE 已就绪'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('预检门禁：总预检未生成'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传样本计数：LIVE完成 0 · LIVE仅分派 1 · 模拟完成 0 · 处理中 1 · 提测真值 缺最终 done 回流'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传样本口径：LIVE完成 0 · LIVE仅分派 1 · 模拟完成 0 · 处理中 1 · LIVE dispatched-only 不能作为提测真值'))).toBe(true);
  });

  it('prefers runtime release upload evidence summary when present', async () => {
    mockContext = {
      ...buildContextOverrides(),
      releaseUploadEvidenceSummary: 'LIVE完成 9 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准',
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const renderedTexts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(renderedTexts.some(text => text.includes('上传样本口径：LIVE完成 9 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准'))).toBe(true);
  });

  it('does not count dispatched-only upload records as completed release evidence', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const renderedTexts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(renderedTexts.some(text => text.includes('上传闭环状态：上传链路执行中，仍待首个真实回流样本'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传回流真值：LIVE dispatched-only 不能作为提测真值'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('首个 Build 三件套：Gateway LIVE 已就绪 · LIVE 仅分派，缺 done · 总预检未生成'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('当前主卡点：上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('主卡点原因：已有 1 条 LIVE 上传只到 dispatched，还缺最终 done 回流'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('剩余门禁数：2 / 3'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('Gateway 门禁：Gateway LIVE 已就绪'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传门禁：LIVE 仅分派，缺 done'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('预检门禁：总预检未生成'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传样本计数：LIVE完成 0 · LIVE仅分派 1 · 模拟完成 0 · 处理中 1 · 提测真值 缺最终 done 回流'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传样本口径：LIVE完成 0 · LIVE仅分派 1 · 模拟完成 0 · 处理中 1 · LIVE dispatched-only 不能作为提测真值'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传闭环状态：上传闭环已验证'))).toBe(false);
  });

  it('keeps fallback active uploads visible when runtime uploads are empty', async () => {
    mockUploads = [];
    mockReleaseActiveUploads = 2;
    mockContext = buildContextOverrides();

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const renderedTexts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(renderedTexts.some(text => text.includes('上传样本计数：LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 2 · 提测真值 等待回流'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传样本口径：LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 2 · 提测真值 等待回流'))).toBe(true);
    expect(renderedTexts.some(text => text.includes('上传闭环状态：上传链路执行中，仍待首个真实回流样本'))).toBe(true);
  });

  it('does not render placeholder latest LIVE trace copy when fallback only has timestamp', async () => {
    mockUploads = [];
    mockReleaseActiveUploads = 0;
    mockContext = {
      ...buildContextOverrides(),
      uploads: [],
      releaseCompletedUploads: 1,
      releaseLiveCompletedUploads: 1,
      releaseLatestLiveUploadCompletedAt: Date.now() - 30_000,
      releaseLatestLiveUpload: {
        completedAt: Date.now() - 30_000,
        source: 'release-status',
      },
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const renderedTexts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });

    expect(renderedTexts.some(text => text.includes('最近一条 LIVE 真回流证据：样本名未记录'))).toBe(false);
    expect(renderedTexts.some(text => text.includes('最近一条 LIVE 真回流：'))).toBe(true);
  });

  it('navigates to confirmations from launch spotlight when launch path is blocked', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const cta = findPressableByLabel(tree!.root, 'TestFlight / App Store 还有 1 项待拍板');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Confirmations', {
      focusConfirmationId: 'confirm-1',
      focusTaskId: undefined,
      focusDispatchId: undefined,
    });
  });

  it('navigates to project library from spotlight card', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const cta = findPressableByLabel(tree!.root, 'P1 正在从样板走向可用驾驶舱');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProjectLibrary');
  });

  it('routes release readiness CTA to profile when Apple setup is the top blocker', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '去补 Apple 上线配置');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {screen: 'Profile'});
  });

  it('surfaces release next step card in action queue', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '下一步：去补 Apple 上线配置');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {screen: 'Profile'});
  });

  it('keeps dispatch chain quick action available', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '看调度链');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('DispatchChain', {
      focusDispatchId: 'dispatch-runtime-1',
      focusTaskId: 'task-runtime-1',
      focusSessionKey: 'feishu:heijin:runtime',
    });
  });
});
