import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {ProfileScreen} from '../src/screens/ProfileScreen';

const mockNavigate = jest.fn();
const mockRefresh = jest.fn();

function buildContextOverrides(): any {
  return {
    agents: [
      {id: 'zhuli', name: '助理', role: 'AI 总指挥', status: 'working', focus: '指令', accent: '#22d3ee', current: 'P1', sourceMode: 'live'},
      {id: 'heijin', name: '黑金', role: 'AI 项目工程师', status: 'idle', focus: '平台', accent: '#f97316', current: '待命', sourceMode: 'live'},
    ],
    tasks: [
      {id: 't1', title: 'P1 闭环验证', owner: '助理', state: 'running', eta: '5m', next: '等待结果', priority: 'P1', sourceType: 'chat', updatedAt: Date.now()},
      {id: 't2', title: '构建验证', owner: '助理', state: 'done', eta: '已完成', next: '完成', priority: 'P1', sourceType: 'chat', updatedAt: Date.now()},
    ],
    dispatches: [
      {id: 'd1', userText: '验证 P1 闭环', reply: '已完成', status: 'completed', taskId: 't2', dispatchId: 'dispatch-1', agentId: 'zhuli', createdAt: Date.now(), updatedAt: Date.now()},
    ],
    uploads: [
      {id: 'u1', name: 'test.pdf', type: 'document', status: 'uploading', progress: 30, timestamp: '11:00', agent: '助理', executionMode: 'simulated'},
      {id: 'u2', name: 'live-dispatched.pdf', type: 'document', status: 'dispatched', progress: 100, timestamp: '11:01', agent: '助理', executionMode: 'live'},
      {id: 'u3', name: 'live-done.pdf', type: 'document', status: 'done', progress: 100, timestamp: '11:02', agent: '黑金', executionMode: 'live', completedAt: Date.now() - 60_000, dispatchId: 'dispatch-live-done'},
    ],
    pendingConfirmations: 1,
    refreshing: false,
    refresh: mockRefresh,
    runtimeMode: 'fallback',
    runtimeError: 'Gateway 未连接',
    lastSyncedAt: Date.now(),
    sessionCount: 0,
    gatewaySummary: 'Gateway 未配置',
    gatewayConfigValid: false,
    gatewayWarningCount: 2,
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
    releaseActiveUploads: 0,
    releaseCompletedUploads: 0,
    releaseLiveCompletedUploads: 0,
    releaseSimulatedCompletedUploads: 0,
    releaseLiveDispatchedOnlyUploads: 0,
    releaseLatestLiveUploadCompletedAt: undefined,
    releaseLatestLiveUpload: undefined,
    releaseUploadEvidenceSummary: undefined,
    appleValidationDetail: undefined,
    assetsValidationDetail: undefined,
    preflightValidationDetail: undefined,
  };
}

let mockContext: any = buildContextOverrides();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => mockContext,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

jest.spyOn(require('react-native'), 'Alert').mockImplementation(() => {});

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRefresh.mockClear();
    mockContext = buildContextOverrides();
  });

  function collectText(node: ReactTestRenderer.ReactTestInstance): string[] {
    return node.findAllByType(Text).map(textNode => {
      const child = textNode.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });
  }

  it('renders profile header and quick access strip', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('用户');
    expect(texts).toContain('AI 大脑驾驶舱');
    expect(texts).toContain('记忆库');
    expect(texts).toContain('知识库');
    expect(texts).toContain('附件库');
    expect(texts).toContain('调度链');
  });

  it('shows stats grid with live task counts', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('总任务');
    expect(texts).toContain('已完成');
    expect(texts).toContain('活跃 Agent');
  });

  it('renders runtime board in fallback mode', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('运行态') || t.includes('runtime') || t.includes('Runtime'))).toBe(true);
    expect(texts).toContain('OpenClaw 直连健康度');
    expect(texts).toContain('本地');
    expect(texts.some(t => t.includes('本地演示运行态') || t.includes('fallback') || t.includes('FALLBACK'))).toBe(true);
  });

  it('renders five information layer menu items', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('记忆库');
    expect(texts).toContain('知识库');
    expect(texts).toContain('附件库');
    expect(texts).toContain('调度链');
    expect(texts).toContain('项目库');
  });

  it('shows TestFlight readiness card with blockers listed', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('最近一条 LIVE 真回流证据：live-done.pdf'))).toBe(true);
    expect(texts.some(t => t.includes('来源 运行态真回流'))).toBe(true);
    expect(texts.some(t => t.includes('调度 dispatch-live-done'))).toBe(true);
    expect(texts.some(t => t.includes('执行 黑金'))).toBe(true);
    expect(texts.some(t => t.includes('仍可作为提测依据'))).toBe(true);
    expect(texts).toContain('🚀 上线准备');
    expect(texts).toContain('AI协作平台');
    expect(texts.some(t => t.includes('提测收口进度') || t.includes('收口进度'))).toBe(true);
    expect(texts.some(t => t.includes('首个 Build 动作状态'))).toBe(true);
    expect(texts.some(t => t.includes('距离首个 TestFlight Build 还差最后几步'))).toBe(true);
    expect(texts.some(t => t.includes('当前主动作：🛰️ 先补 Gateway 配置'))).toBe(true);
    expect(texts.some(t => t.includes('还差什么才能触发 Build'))).toBe(true);
    expect(texts.some(t => t.includes('Gateway / 运行态：Gateway 仍在回退模式'))).toBe(true);
    expect(texts.some(t => t.includes('上传回流真值：LIVE done 可作为提测真值'))).toBe(true);
    expect(texts.some(t => t.includes('TestFlight 总预检：总预检尚未形成真值'))).toBe(true);
    expect(texts.some(t => t.includes('Apple 账号与提测前置：Apple 前置未补齐'))).toBe(true);
    expect(texts.some(t => t.includes('App Store 素材：App Store 素材真值未通过'))).toBe(true);
    expect(texts.some(t => t.includes('校验来源：默认未配置'))).toBe(true);
    expect(texts.some(t => t.includes('素材校验新鲜度：素材真值尚未形成可校验记录'))).toBe(true);
    expect(texts.some(t => t.includes('Apple 当前状态：Apple 前置未补齐'))).toBe(true);
    expect(texts.some(t => t.includes('Apple 预检详情：Apple 预检尚未产生详细日志'))).toBe(true);
    expect(texts.some(t => t.includes('总预检状态：总预检尚未形成真值'))).toBe(true);
    expect(texts.some(t => t.includes('总预检新鲜度：未记录最近一次总预检时间'))).toBe(true);
    expect(texts.some(t => t.includes('总预检失败项：TestFlight 输入预检'))).toBe(true);
    expect(texts.some(t => t.includes('总预检建议动作：先补齐 Apple API Key / Issuer ID / Team ID，再重跑 npm run preflight:testflight'))).toBe(true);
    expect(texts.some(t => t.includes('素材当前状态：App Store 素材真值未通过'))).toBe(true);
    expect(texts.some(t => t.includes('素材预检详情：App Store 素材预检尚未产生详细日志'))).toBe(true);
    expect(texts.some(t => t.includes('TestFlight 当前状态：首个 TestFlight Build 仍不可触发'))).toBe(true);
    expect(texts.some(t => t.includes('仓库触发摘要：仓库触发门禁未过（v0.1.0） · 阻塞 2 项'))).toBe(true);
    expect(texts.some(t => t.includes('仓库态说明：工作区仍有未提交改动，当前不会安全触发 v0.1.0；origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(texts.some(t => t.includes('仓库剩余门禁数：2 / 4'))).toBe(true);
    expect(texts.some(t => t.includes('仓库触发责任：封版 / 改版本 1 项；仓库封版清理 1 项'))).toBe(true);
    expect(texts.some(t => t.includes('当前触发 tag：v0.1.0'))).toBe(true);
    expect(texts.some(t => t.includes('仓库态阻塞：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
    expect(texts.some(t => t.includes('仓库态阻塞：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(texts.some(t => t.includes('待封版 / 改版本：origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'))).toBe(true);
    expect(texts.some(t => t.includes('待仓库封版清理：工作区仍有未提交改动，当前不会安全触发 v0.1.0'))).toBe(true);
    expect(texts.some(t => t.includes('上传闭环状态：上传闭环已验证，当前仍有队列在跑'))).toBe(true);
    expect(texts.some(t => t.includes('上传回流真值：LIVE done 可作为提测真值'))).toBe(true);
    expect(texts.some(t => t.includes('上传真值说明：最近 72 小时内已有 LIVE Gateway 最终 done 回流，可抵扣 TestFlight 上传闭环门槛。'))).toBe(true);
    expect(texts.some(t => t.includes('首个 Build 三件套：Gateway 仍在回退模式 · LIVE done 有效但仍有 1 条仅分派 · 总预检未生成'))).toBe(true);
    expect(texts.some(t => t.includes('当前主卡点：Gateway 门禁：Gateway 仍在回退模式'))).toBe(true);
    expect(texts.some(t => t.includes('主卡点原因：首个 Build 前必须先确认真机不再停留在 fallback'))).toBe(true);
    expect(texts.some(t => t.includes('剩余门禁数：3 / 3'))).toBe(true);
    expect(texts.some(t => t.includes('Gateway 门禁：Gateway 仍在回退模式'))).toBe(true);
    expect(texts.some(t => t.includes('上传门禁：LIVE done 有效但仍有 1 条仅分派'))).toBe(true);
    expect(texts.some(t => t.includes('预检门禁：总预检未生成'))).toBe(true);
    expect(texts.some(t => t.includes('上传样本计数：LIVE完成 1 · LIVE仅分派 1 · 模拟完成 0 · 处理中 1 · 提测真值 LIVE done 仍有 dispatched-only 尾巴'))).toBe(true);
    expect(texts.some(t => t.includes('上传样本口径：LIVE完成 1 · LIVE仅分派 1 · 模拟完成 0 · 处理中 1 · 提测真值 已拿到 LIVE done'))).toBe(true);
    // Fallback mode blocker + pending confirmations
    expect(texts.some(t => t.includes('未就绪') || t.includes('待收口'))).toBe(true);
  });

  it('prefers runtime release upload evidence summary when present', async () => {
    mockContext = {
      ...buildContextOverrides(),
      releaseUploadEvidenceSummary: 'LIVE完成 8 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准',
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('上传样本口径：LIVE完成 8 · LIVE仅分派 0 · 模拟完成 0 · 处理中 0 · 提测真值 以 runtime 发布产物为准'))).toBe(true);
  });

  it('shows readiness checklist with correct done/pending items', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    // P1 done items
    expect(texts).toContain('React Native 主工程 + iOS 构建');
    expect(texts).toContain('五主功能（总览 / 对话 / 智能体 / 任务 / 我的）');
    // runtimeMode !== live so this should be pending
    expect(texts).toContain('至少完成一轮 LIVE 网关闭环验证');
  });

  it('routes release primary CTA to Gateway settings while runtime is still fallback', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });

    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const releaseCta = touchables.find(t =>
      collectText(t).some(s => s.includes('先补 Gateway 配置')),
    );

    expect(releaseCta).toBeTruthy();
    await ReactTestRenderer.act(async () => { releaseCta!.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('GatewaySettings');
  });

  it('navigates to sub-screens on menu item press', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });

    const touchables = tree!.root.findAllByType(TouchableOpacity);

    const memoryItem = touchables.find(t =>
      collectText(t).some(s => s.includes('记忆库') && !s.includes('附件库')),
    );
    expect(memoryItem).toBeTruthy();
    await ReactTestRenderer.act(async () => { memoryItem!.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('MemoryStore');

    mockNavigate.mockClear();
    const confirmItem = touchables.find(t =>
      collectText(t).some(s => s.includes('需确认项')),
    );
    expect(confirmItem).toBeTruthy();
    await ReactTestRenderer.act(async () => { confirmItem!.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('Confirmations');
  });

  it('falls back to generated release-status LIVE trace when runtime trace is absent', async () => {
    mockContext = {
      ...buildContextOverrides(),
      uploads: [
        {id: 'u1', name: 'test.pdf', type: 'document', status: 'uploading', progress: 30, timestamp: '11:00', agent: '助理', executionMode: 'simulated'},
      ],
      releaseCompletedUploads: 1,
      releaseLiveCompletedUploads: 1,
      releaseLatestLiveUploadCompletedAt: Date.now() - 30_000,
      releaseLatestLiveUpload: {
        id: 'generated-live-1',
        name: 'release-status-live.zip',
        dispatchId: 'dispatch-generated-live-1',
        agent: '助理',
        completedAt: Date.now() - 30_000,
        source: 'release-status',
      },
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });

    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('最近一条 LIVE 真回流证据：release-status-live.zip'))).toBe(true);
    expect(texts.some(t => t.includes('来源 仓库预检回填'))).toBe(true);
    expect(texts.some(t => t.includes('调度 dispatch-generated-live-1'))).toBe(true);
    expect(texts.some(t => t.includes('执行 助理'))).toBe(true);
  });

  it('navigates upload evidence CTA with focused live upload context', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });

    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const uploadEvidenceBtn = touchables.find(t =>
      collectText(t).some(s => s.includes('看上传闭环证据')),
    );

    expect(uploadEvidenceBtn).toBeTruthy();
    await ReactTestRenderer.act(async () => { uploadEvidenceBtn!.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('Upload', {
      focusFileId: 'u3',
      focusDispatchId: 'dispatch-live-done',
    });
  });

  it('falls back to generated LIVE upload focus target when runtime queue has no matching sample', async () => {
    mockContext = {
      ...buildContextOverrides(),
      uploads: [],
      releaseCompletedUploads: 1,
      releaseLiveCompletedUploads: 1,
      releaseLatestLiveUploadCompletedAt: Date.now() - 30_000,
      releaseLatestLiveUpload: {
        id: 'generated-live-1',
        name: 'release-status-live.zip',
        dispatchId: 'dispatch-generated-live-1',
        agent: '助理',
        completedAt: Date.now() - 30_000,
        source: 'release-status',
      },
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });

    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const uploadEvidenceBtn = touchables.find(t =>
      collectText(t).some(s => s.includes('看上传闭环证据')),
    );

    expect(uploadEvidenceBtn).toBeTruthy();
    await ReactTestRenderer.act(async () => { uploadEvidenceBtn!.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('Upload', {
      focusFileId: 'generated-live-1',
      focusDispatchId: 'dispatch-generated-live-1',
    });
  });

  it('keeps fallback active uploads visible when runtime queue is empty', async () => {
    mockContext = {
      ...buildContextOverrides(),
      uploads: [],
      releaseActiveUploads: 2,
    };

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });

    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('上传样本计数：LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 2 · 提测真值 等待回流'))).toBe(true);
    expect(texts.some(t => t.includes('上传样本口径：LIVE完成 0 · LIVE仅分派 0 · 模拟完成 0 · 处理中 2 · 提测真值 等待回流'))).toBe(true);
    expect(texts.some(t => t.includes('上传闭环状态：上传链路执行中，仍待首个真实回流样本'))).toBe(true);
  });

  it('does not render placeholder latest LIVE trace copy when fallback only has timestamp', async () => {
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
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });

    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('最近一条 LIVE 真回流证据：样本名未记录'))).toBe(false);
    expect(texts.some(t => t.includes('最近一条 LIVE 真回流：'))).toBe(true);
  });

  it('shows system status section with Gateway settings link', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('⚙️ 系统');
    expect(texts).toContain('需确认项');
    expect(texts).toContain('上传管理');
    expect(texts).toContain('Gateway 连接配置');
  });

  it('renders privacy and settings menu items', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('🔧 设置');
    expect(texts).toContain('隐私与安全');
    expect(texts).toContain('AI 模型配置');
    expect(texts).toContain('通知与提醒');
  });

  it('renders logout button', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ProfileScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('退出登录');
  });
});
