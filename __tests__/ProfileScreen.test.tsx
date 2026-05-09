import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {ProfileScreen} from '../src/screens/ProfileScreen';

const mockNavigate = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
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
      {id: 'u1', name: 'test.pdf', type: 'document', status: 'uploading', progress: 30, timestamp: '11:00', agent: '助理'},
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
    appleReleaseSummary: 'Apple Developer / App Store Connect / GitHub CI 变量仍待补齐',
    appleReleaseSource: 'default',
    appleReleaseValidatedAt: undefined,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

jest.spyOn(require('react-native'), 'Alert').mockImplementation(() => {});

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRefresh.mockClear();
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
    expect(texts).toContain('FALLBACK');
    expect(texts.some(t => t.includes('本地回退') || t.includes('fallback') || t.includes('FALLBACK'))).toBe(true);
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
    expect(texts).toContain('🚀 上线准备');
    expect(texts).toContain('AI协作平台');
    expect(texts.some(t => t.includes('提测收口进度') || t.includes('收口进度'))).toBe(true);
    expect(texts.some(t => t.includes('校验来源：默认未配置'))).toBe(true);
    // Fallback mode blocker + pending confirmations
    expect(texts.some(t => t.includes('未就绪') || t.includes('待收口'))).toBe(true);
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
