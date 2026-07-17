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
