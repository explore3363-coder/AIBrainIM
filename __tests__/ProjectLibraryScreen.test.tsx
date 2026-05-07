import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {ProjectLibraryScreen} from '../src/screens/ProjectLibraryScreen';

const mockNavigate = jest.fn();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    tasks: [
      {id: 'task-1', title: '任务A', owner: '黑金', state: 'running', eta: '10m', next: '继续推进', priority: 'P0'},
      {id: 'task-2', title: '任务B', owner: '助理', state: 'blocked', eta: '待确认', next: '等待拍板', priority: 'P1'},
    ],
    uploads: [
      {id: 'upload-1', name: 'report.pdf', type: 'document', status: 'processing', progress: 60},
    ],
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
    expect(root.findAllByType(Text).some(node => node.props.children === '回首页看总览')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '检查 Gateway 连接')).toBe(true);
    expect(root.findAllByType(Text).some(node => node.props.children === '去清确认项')).toBe(true);
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
