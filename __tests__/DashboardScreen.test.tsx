import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {DashboardScreen} from '../src/screens/DashboardScreen';

const mockNavigate = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
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
    ],
    uploads: [
      {id: 'upload-1', name: 'roadmap.pdf', type: 'document', status: 'processing', progress: 60, timestamp: '17:28', agent: 'heijin'},
    ],
    pendingConfirmations: 1,
    refreshing: false,
    refresh: mockRefresh,
    runtimeMode: 'live',
    recentCaptures: [],
  }),
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

    expect(mockNavigate).toHaveBeenCalledWith('Confirmations');
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

    expect(mockNavigate).toHaveBeenCalledWith('DispatchChain');
  });
});
