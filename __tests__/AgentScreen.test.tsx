import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import {AgentScreen} from '../src/screens/AgentScreen';


const mockNavigate = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    agents: [
      {
        id: 'zhuli',
        name: '助理',
        role: 'AI 总指挥',
        status: 'working',
        focus: '接收指令、拆任务、调度',
        accent: '#22d3ee',
        current: '[测试任务] 推进 P1 闭环',
        sourceMode: 'live',
        sessionKey: 'agent:zhuli:feishu:direct:123',
        runtimeMs: 5000,
      },
      {
        id: 'heijin',
        name: '黑金',
        role: 'AI 项目工程师',
        status: 'online',
        focus: 'AI协作平台开发',
        accent: '#f97316',
        current: '待命',
        sourceMode: 'live',
      },
      {
        id: 'xunlong',
        name: '寻龙',
        role: '矿业研究员',
        status: 'idle',
        focus: '钨价、政策、全球矿业信源',
        accent: '#fbbf24',
        current: '待命',
        sourceMode: 'live',
      },
    ],
    tasks: [
      {
        id: 't1',
        title: '推进 AIBrainIM P1 可用版',
        owner: '助理',
        state: 'running',
        eta: '12m',
        next: '继续补真实协议字段映射',
        priority: 'P1',
        agentId: 'zhuli',
        sessionKey: 'agent:zhuli:feishu:direct:123',
        sourceType: 'chat',
        updatedAt: Date.now(),
      },
    ],
    dispatches: [
      {
        id: 'd1',
        userText: '继续推进 AIBrainIM P1 可用版',
        reply: '✓ 助理 [测试任务] 已完成本轮执行。',
        status: 'completed',
        taskId: 't1',
        dispatchId: 'dispatch-1',
        sessionKey: 'agent:zhuli:feishu:direct:123',
        agentId: 'zhuli',
        createdAt: Date.now() - 60000,
        updatedAt: Date.now() - 60000,
      },
    ],
    pendingConfirmations: 1,
    refreshing: false,
    refresh: mockRefresh,
    runtimeMode: 'live',
    runtimeError: undefined,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

describe('AgentScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRefresh.mockClear();
  });

  function getTexts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
    return tree.root.findAllByType(Text).map((t: ReactTestRenderer.ReactTestInstance) => {
      const child = (t.props as {children?: React.ReactNode}).children;
      return Array.isArray(child) ? child.join('') : String(child ?? '');
    });
  }

  it('renders header with agent count and live sync text', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<AgentScreen />);
    });
    const texts = getTexts(tree!);
    expect(texts.some(t => t.includes('智能体'))).toBe(true);
    expect(texts.some(t => t.includes('3 个 Agent'))).toBe(true);
    expect(texts.some(t => t.includes('已连接') || t.includes('实时同步'))).toBe(true);
  });

  it('renders focus board and summary cards', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<AgentScreen />);
    });
    const texts = getTexts(tree!);
    expect(texts.some(t => t.includes('AGENT CONTROL'))).toBe(true);
    expect(texts.some(t => t.includes('先判断谁在工作'))).toBe(true);
    expect(texts.some(t => t.includes('执行中') || t.includes('1 个执行中'))).toBe(true);
  });

  it('renders agent grid with all three agents', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<AgentScreen />);
    });
    const texts = getTexts(tree!);
    expect(texts.some(t => t.includes('助理'))).toBe(true);
    expect(texts.some(t => t.includes('黑金'))).toBe(true);
    expect(texts.some(t => t.includes('寻龙'))).toBe(true);
  });

  it('renders action cards and their texts', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<AgentScreen />);
    });
    const texts = getTexts(tree!);
    expect(texts.some(t => t.includes('看调度链'))).toBe(true);
    expect(texts.some(t => t.includes('处理确认项'))).toBe(true);
    expect(texts.some(t => t.includes('盯执行位'))).toBe(true);
  });

  it('renders detail panel with selected agent info', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<AgentScreen />);
    });
    const texts = getTexts(tree!);
    expect(texts.some(t => t.includes('专注领域'))).toBe(true);
    expect(texts.some(t => t.includes('接收指令'))).toBe(true);
    expect(texts.some(t => t.includes('实时链路'))).toBe(true);
    expect(texts.some(t => t.includes('session='))).toBe(true);
    expect(texts.some(t => t.includes('执行负载'))).toBe(true);
  });

  it('renders task and dispatch records in detail panel', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<AgentScreen />);
    });
    const texts = getTexts(tree!);
    expect(texts.some(t => t.includes('正在处理的任务'))).toBe(true);
    expect(texts.some(t => t.includes('推进 AIBrainIM P1 可用版'))).toBe(true);
    expect(texts.some(t => t.includes('最近回流'))).toBe(true);
  });
});
