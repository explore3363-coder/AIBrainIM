import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Alert, Text, TouchableOpacity} from 'react-native';
import {FileLibraryScreen} from '../src/screens/FileLibraryScreen';

const mockNavigate = jest.fn();
const mockMarkFileForNextDispatch = jest.fn();
const mockRetryUpload = jest.fn();
const mockRemoveFile = jest.fn();
const mockUnmarkFileForNextDispatch = jest.fn();
let mockQueuedFileIds = ['u1'];

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
        transferMode: 'direct',
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
        transferMode: 'chunked',
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
        transferMode: 'chunked',
      },
      {
        id: 'u4',
        name: '长文本传感器数据.csv',
        type: 'document',
        status: 'queued',
        progress: 0,
        timestamp: '10:19',
        agent: '智联',
        size: 0,
        uri: 'file:///test.csv',
        transferMode: 'chunked',
      },
      {
        id: 'u5',
        name: '失败样本.zip',
        type: 'document',
        status: 'error',
        progress: 35,
        timestamp: '10:18',
        agent: '寻龙',
        size: 22 * 1024 * 1024,
        uri: 'file:///failed.zip',
        transferMode: 'chunked',
        error: '分片 2/11 上传失败，已达最大重试次数',
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
      unmarkFileForNextDispatch: (...args: unknown[]) => mockUnmarkFileForNextDispatch(...args),
      getFilesForNextDispatch: () => mockQueuedFileIds.includes('u1') ? [
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
          transferMode: 'direct',
        },
      ] : [],
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
    mockQueuedFileIds = ['u1'];
    mockNavigate.mockClear();
    mockMarkFileForNextDispatch.mockClear();
    mockRetryUpload.mockClear();
    mockRemoveFile.mockClear();
    mockUnmarkFileForNextDispatch.mockClear();
    mockUnmarkFileForNextDispatch.mockImplementation((id: string) => {
      mockQueuedFileIds = mockQueuedFileIds.filter(item => item !== id);
    });
    mockMarkFileForNextDispatch.mockImplementation((id: string) => {
      if (!mockQueuedFileIds.includes(id)) {
        mockQueuedFileIds = [...mockQueuedFileIds, id];
      }
    });
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

  function getFileCard(tree: ReactTestRenderer.ReactTestRenderer, fileName: string) {
    return tree.root.findAll(node => node.props?.style && collectText(node).some(t => t.includes(fileName)))[0];
  }

  it('renders header with total and uploading counts', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('附件库'))).toBe(true);
    expect(texts.some(t => t.includes('5 个文件'))).toBe(true);
    expect(texts.some(t => t.includes('3 个上传中'))).toBe(true);
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
    expect(texts).toContain('3 个文件正在上传/处理中');
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
    expect(texts.some(t => t.includes('长文本传感器数据.csv'))).toBe(true);
    expect(texts.some(t => t.includes('失败样本.zip'))).toBe(true);
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
    expect(texts.some(t => t.includes('分片上传中') && t.includes('60%'))).toBe(true);
  });

  it('treats unknown-size chunked files as large-file pipeline items', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('长文本传感器数据.csv'))).toBe(true);
    expect(texts.filter(t => t === '大文件').length).toBeGreaterThanOrEqual(4);
    expect(texts).toContain('分片中');
    expect(texts.some(t => t.includes('分片准备中'))).toBe(true);
  });

  it('shows readable failure reason for errored files', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('失败样本.zip'))).toBe(true);
    expect(texts.some(t => t.includes('失败原因：分片 2/11 上传失败，已达最大重试次数'))).toBe(true);
    expect(texts.some(t => t.includes('有 1 个附件处理失败'))).toBe(true);
    expect(texts.some(t => t.includes('全部重试'))).toBe(true);
  });

  it('retries all failed files from the error banner', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    const retryAllBtn = tree!.root.findAllByType(TouchableOpacity)
      .find(t => collectText(t).includes('全部重试'));
    expect(retryAllBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      retryAllBtn!.props.onPress();
    });

    expect(mockRetryUpload).toHaveBeenCalledWith('u5');
  });

  it('filters files by type when chip is tapped', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    // initially shows all 5
    let texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('项目方案.pdf'))).toBe(true);
    expect(texts.some(t => t.includes('航拍照片.jpg'))).toBe(true);
    expect(texts.some(t => t.includes('会议录音.mp4'))).toBe(true);
    expect(texts.some(t => t.includes('长文本传感器数据.csv'))).toBe(true);

    // tap "图片" filter
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const imageFilter = touchables.find(t => collectText(t).includes('图片'));
    await ReactTestRenderer.act(async () => { imageFilter!.props.onPress(); });

    texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('航拍照片.jpg'))).toBe(true);
    expect(texts.some(t => t.includes('会议录音.mp4'))).toBe(false);
    const fileCards = tree!.root.findAll(node => collectText(node).some(t => t.includes('项目方案.pdf')));
    expect(fileCards.some(node => collectText(node).includes('调度链'))).toBe(false);
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

  it('shows queued context banner when files are selected for next dispatch', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('已加入下一轮对话上下文'))).toBe(true);
    expect(texts.some(t => t.includes('项目方案.pdf'))).toBe(true);
    expect(texts.some(t => t.includes('去对话'))).toBe(true);
    expect(texts.some(t => t.includes('已带入下一轮对话'))).toBe(true);
  });

  it('opens chat from queued context banner', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    const goChatBtn = tree!.root.findAllByType(TouchableOpacity)
      .find(t => collectText(t).includes('去对话'));
    expect(goChatBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      goChatBtn!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {screen: 'Chat'});
  });

  it('can clear all queued files from the context banner', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    const clearBtn = tree!.root.findAllByType(TouchableOpacity)
      .find(t => collectText(t).includes('全部移出'));
    expect(clearBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      clearBtn!.props.onPress();
    });

    expect(mockUnmarkFileForNextDispatch).toHaveBeenCalledWith('u1');
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('已加入下一轮对话上下文'))).toBe(false);
  });

  it('can remove a file from next dispatch context', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FileLibraryScreen />);
    });

    const cancelQueuedBtn = tree!.root.findAllByType(TouchableOpacity)
      .find(t => collectText(t).includes('取消带入'));
    expect(cancelQueuedBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      cancelQueuedBtn!.props.onPress();
    });

    expect(mockUnmarkFileForNextDispatch).toHaveBeenCalledWith('u1');
    const texts = collectText(tree!.root);
    expect(texts.some(t => t.includes('已加入下一轮对话上下文'))).toBe(false);
    expect(texts.some(t => t.includes('已带入下一轮对话'))).toBe(false);
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
    mockQueuedFileIds = [];

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
