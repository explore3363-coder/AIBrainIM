import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {TaskScreen} from '../src/screens/TaskScreen';

const mockNavigate = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    tasks: [
      {
        id: 'confirm-1',
        title: '确认 TestFlight 上线路径',
        owner: '助理',
        state: 'blocked',
        eta: '待确认',
        next: '先去确认项拍板',
        priority: 'P0',
        sourceType: 'confirmation',
      },
      {
        id: 'upload-task-1',
        title: '处理矿山巡检视频',
        owner: '黑金',
        state: 'running',
        eta: '8m',
        next: '等待附件链路处理完成',
        priority: 'P1',
        sourceType: 'upload',
        sessionKey: 'upload-session-1',
      },
      {
        id: 'dispatch-task-1',
        title: '推进 AIBrainIM P1 真闭环',
        owner: '黑金',
        state: 'todo',
        eta: '20m',
        next: '继续补真实协议字段映射',
        priority: 'P0',
        sourceType: 'chat',
        sessionKey: 'dispatch-session-1',
      },
    ],
    dispatches: [
      {
        id: 'dispatch-1',
        userText: '继续推进 AIBrainIM P1 可用版',
        reply: '调度链还在执行，首页与任务页已经共用运行态。',
        status: 'processing',
        taskId: 'dispatch-task-1',
        dispatchId: 'dispatch-runtime-1',
        sessionKey: 'dispatch-session-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    uploads: [
      {
        id: 'upload-1',
        name: 'mine-video.mp4',
        type: 'video',
        status: 'uploading',
        progress: 42,
        timestamp: '17:40',
        dispatchId: 'upload-dispatch-1',
      },
    ],
    pendingConfirmations: 1,
    runtimeMode: 'fallback',
    runtimeError: 'Gateway 未连接',
    gatewayConfigValid: false,
    refreshing: false,
    refresh: mockRefresh,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

describe('TaskScreen', () => {
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

  function findPressableByLabel(root: ReactTestRenderer.ReactTestInstance, label: string) {
    return root.findAllByType(TouchableOpacity).find(node => collectText(node).includes(label));
  }

  it('renders the new action queue priorities on the task hub', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<TaskScreen />);
    });

    const texts = tree!.root.findAllByType(Text).map(node => {
      const child = node.props.children;
      return Array.isArray(child) ? child.join('') : child;
    });

    expect(texts).toContain('TASK FOCUS');
    expect(texts).toContain('先处理最影响闭环的那一条');
    expect(texts).toContain('先补齐 Gateway 配置');
    expect(texts).toContain('还有 1 条待拍板');
    expect(texts).toContain('上传中的附件：mine-video.mp4');
  });

  it('routes blocked confirmation tasks to confirmations screen', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<TaskScreen />);
    });

    const cta = findPressableByLabel(tree!.root, '确认 TestFlight 上线路径');
    expect(cta).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      cta!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Confirmations', {
      focusConfirmationId: '1',
      focusTaskId: 'confirm-1',
    });
  });

  it('routes upload tasks to upload screen and chat tasks to dispatch chain', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<TaskScreen />);
    });

    const uploadCard = findPressableByLabel(tree!.root, '处理矿山巡检视频');
    expect(uploadCard).toBeTruthy();
    await ReactTestRenderer.act(async () => {
      uploadCard!.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Upload', {
      focusDispatchId: 'upload-session-1',
    });

    mockNavigate.mockClear();

    const dispatchCard = findPressableByLabel(tree!.root, '推进 AIBrainIM P1 真闭环');
    expect(dispatchCard).toBeTruthy();
    await ReactTestRenderer.act(async () => {
      dispatchCard!.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('DispatchChain', {
      focusTaskId: 'dispatch-task-1',
      focusSessionKey: 'dispatch-session-1',
    });
  });
});
