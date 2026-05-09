import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Alert, Text, TouchableOpacity} from 'react-native';
import {FileLibraryScreen} from '../src/screens/FileLibraryScreen';

const mockNavigate = jest.fn();
const mockMarkFileForNextDispatch = jest.fn();
const mockRetryUpload = jest.fn();
const mockRemoveFile = jest.fn();

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    uploads: [
      {
        id: 'u1',
        name: '项目方案.pdf',
        type: 'document',
        status: 'done',
        progress: 100,
        timestamp: '10:22',
        agent: '助理',
        size: 2 * 1024 * 1024,
        uri: 'file:///test.pdf',
        dispatchId: 'upload-dp-u1',
      },
      {
        id: 'u2',
        name: '航拍照片.jpg',
        type: 'image',
        status: 'uploading',
        progress: 60,
        timestamp: '10:21',
        agent: '黑金',
        size: 12 * 1024 * 1024,
        uri: 'file:///test.jpg',
      },
      {
        id: 'u3',
        name: '会议录音.mp4',
        type: 'video',
        status: 'queued',
        progress: 0,
        timestamp: '10:20',
        agent: '寻龙',
        size: 88 * 1024 * 1024,
        uri: 'file:///test.mp4',
      },
    ],
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

jest.mock('../src/services/uploadService', () => {
  const actual = jest.requireActual('../src/services/uploadService');
  return {
    ...actual,
    enqueueUpload: jest.fn(),
    uploadService: {
      ...actual.uploadService,
      markFileForNextDispatch: (...args: unknown[]) => mockMarkFileForNextDispatch(...args),
      retryUpload: (...args: unknown[]) => mockRetryUpload(...args),
      removeFile: (...args: unknown[]) => mockRemoveFile(...args),
    },
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  isCancel: jest.fn(),
}));

describe('FileLibraryScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockMarkFileForNextDispatch.mockClear();
    mockRetryUpload.mockClear();
    mockRemoveFile.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function collectText(node: ReactTestRenderer.ReactTestInstance): string[] {
    return node.findAllByType(Text).map(textNode => {
      const child = textNode.props.children;
      return Array.isArray(child) ? child.join('') : String(child);
    });
  }

  it('renders header with total and uploading counts', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('附件库'))).toBe(true);
    expect(texts.some(t => t.includes('3 个文件'))).toBe(true);
    expect(texts.some(t => t.includes('2 个上传中'))).toBe(true);
    expect(texts.some(t => t.includes('无大小限制'))).toBe(true);
  });

  it('renders filter chips for all file types', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('全部');
    expect(texts).toContain('图片');
    expect(texts).toContain('视频');
    expect(texts).toContain('文档');
    expect(texts).toContain('压缩包');
  });

  it('shows uploading banner when files are in progress', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts).toContain('2 个文件正在上传/处理中');
  });

  it('renders file cards sorted by timestamp', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    // u1: 项目方案.pdf — done
    expect(texts.some(t => t.includes('项目方案.pdf'))).toBe(true);
    expect(texts.some(t => t.includes('已完成'))).toBe(true);
    // u2: 航拍照片.jpg — uploading, large file (12MB)
    expect(texts.some(t => t.includes('航拍照片.jpg'))).toBe(true);
    expect(texts.some(t => t.includes('上传中'))).toBe(true);
    // u3: 会议录音.mp4 — queued, very large (88MB)
    expect(texts.some(t => t.includes('会议录音.mp4'))).toBe(true);
    expect(texts.some(t => t.includes('排队中'))).toBe(true);
  });

  it('shows large file badge for files over 10MB', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    // 12MB and 88MB files should show large file badge
    expect(texts).toContain('大文件');
  });

  it('shows pipeline step for chunked upload progress', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    // u2 is uploading and is large — should show upload percentage
    expect(texts.some(t => t.includes('上传') && t.includes('%'))).toBe(true);
  });

  it('filters files by type when chip is tapped', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    // initially shows all 3
    let texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('项目方案.pdf'))).toBe(true);
    expect(texts.some(t => t.includes('航拍照片.jpg'))).toBe(true);
    expect(texts.some(t => t.includes('会议录音.mp4'))).toBe(true);

    // tap "图片" filter
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const imageFilter = touchables.find(t => collectText(t).includes('图片'));
    await ReactTestRenderer.act(async () => { imageFilter!.props.onPress(); });

    texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('航拍照片.jpg'))).toBe(true);
    expect(texts.some(t => t.includes('项目方案.pdf'))).toBe(false);
    expect(texts.some(t => t.includes('会议录音.mp4'))).toBe(false);
  });

  it('shows empty state when switching to a type with no files', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    // tap "压缩包" which has no files
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const archiveFilter = touchables.find(t => collectText(t).includes('压缩包'));
    await ReactTestRenderer.act(async () => { archiveFilter!.props.onPress(); });

    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('没有') && t.includes('压缩包'))).toBe(true);
  });

  it('renders upload button in header', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    // Upload button text
    expect(texts.some(t => t.includes('+ 上传'))).toBe(true);
  });

  it('opens dispatch chain from a completed file with dispatch id', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    const dispatchBtn = tree!.root.findAllByType(TouchableOpacity)
      .find(t => collectText(t).includes('调度链'));
    expect(dispatchBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      dispatchBtn!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('DispatchChain', {
      focusDispatchId: 'upload-dp-u1',
      focusTaskId: 'upload-u1',
      focusSessionKey: 'upload-dp-u1',
    });
  });

  it('marks a processed file for next dispatch and navigates to chat', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    const chatBtn = tree!.root.findAllByType(TouchableOpacity)
      .find(t => collectText(t).includes('带入对话'));
    expect(chatBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      chatBtn!.props.onPress();
    });

    expect(mockMarkFileForNextDispatch).toHaveBeenCalledWith('u1');
    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {screen: 'Chat'});
  });

  it('confirms before removing a file', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      const removeBtn = buttons?.find(button => button.text === '移除');
      removeBtn?.onPress?.();
    });

    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    const removeBtn = tree!.root.findAllByType(TouchableOpacity)
      .find(t => collectText(t).includes('移除'));
    expect(removeBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      removeBtn!.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockRemoveFile).toHaveBeenCalledWith('u1');
  });
});
