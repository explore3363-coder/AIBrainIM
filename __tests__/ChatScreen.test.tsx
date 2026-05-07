import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import {ChatScreen} from '../src/screens/ChatScreen';

const mockNavigate = jest.fn();
const mockRegisterDispatch = jest.fn();
const mockRefresh = jest.fn();
const mockSendMessage = jest.fn();
const mockEnqueueUpload = jest.fn();
const mockLaunchImageLibrary = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    dispatches: [],
    registerDispatch: mockRegisterDispatch,
    runtimeMode: 'live',
    runtimeError: undefined,
    refreshing: false,
    refresh: mockRefresh,
  }),
}));

jest.mock('../src/data/api', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

jest.mock('../src/services/uploadService', () => ({
  enqueueUpload: (...args: unknown[]) => mockEnqueueUpload(...args),
  retryUpload: jest.fn(),
  uploadService: {
    getQueue: () => ([
      {
        id: 'uf-1',
        name: '矿山日报.pdf',
        type: 'document',
        size: 12 * 1024 * 1024,
        progress: 100,
        status: 'processing',
      },
    ]),
    getFilesForNextDispatch: () => ([
      {
        id: 'uf-1',
        name: '矿山日报.pdf',
        type: 'document',
        size: 12 * 1024 * 1024,
        progress: 100,
        status: 'processing',
      },
    ]),
    getFile: jest.fn(),
    markFileForNextDispatch: jest.fn(),
    unmarkFileForNextDispatch: jest.fn(),
    formatBytes: (size: number) => `${Math.round(size / (1024 * 1024))} MB`,
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  isCancel: jest.fn(() => false),
}));

describe('ChatScreen attachment dispatch', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRegisterDispatch.mockClear();
    mockRefresh.mockClear();
    mockSendMessage.mockReset();
    mockEnqueueUpload.mockReset();
    mockLaunchImageLibrary.mockReset();
    mockEnqueueUpload.mockResolvedValue({id: 'uf-1'});
    mockLaunchImageLibrary.mockImplementation((_options: unknown, callback: (response: {assets?: Array<{uri: string; fileName?: string; fileSize?: number; type?: string}>}) => void) => {
      callback({
        assets: [
          {
            uri: 'file:///tmp/mining-report.pdf',
            fileName: '矿山日报.pdf',
            fileSize: 12 * 1024 * 1024,
            type: 'application/pdf',
          },
        ],
      });
    });
    mockSendMessage.mockResolvedValue({
      reply: '已开始分析附件。',
      sent: true,
      taskId: 'task-1',
      dispatchId: 'dispatch-1',
      sessionKey: 'session-1',
    });
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

  it('allows sending attachment-only analysis request', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ChatScreen />);
      await Promise.resolve();
    });

    const root = tree!.root;
    const pickImageBtn = findPressableByLabel(root, '图片');
    expect(pickImageBtn).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      pickImageBtn!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const sendBtn = findPressableByLabel(root, '分析附件');
    expect(sendBtn).toBeTruthy();
    expect(sendBtn?.props.disabled).toBe(false);

    await ReactTestRenderer.act(async () => {
      sendBtn!.props.onPress();
      await Promise.resolve();
    });

    expect(mockSendMessage).toHaveBeenCalled();
    expect(String(mockSendMessage.mock.calls[0][0])).toContain('请先分析我刚上传的附件');
    expect(String(mockSendMessage.mock.calls[0][0])).toContain('[附件上下文]');
    // source is 'upload' when the message carries attachments (correct new behavior)
    expect(mockRegisterDispatch).toHaveBeenCalledWith(expect.objectContaining({
      userText: expect.stringContaining('携带 1 个附件'),
      source: 'upload',
    }));
  });
});
