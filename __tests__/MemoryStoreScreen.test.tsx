import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity, TextInput} from 'react-native';

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    dispatches: [],
    tasks: [],
    uploads: [],
    confirmations: [],
    registerMemoryCapture: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

const mockGatewayInvoke = jest.fn();
jest.mock('../src/data/api', () => ({
  gatewayInvoke: mockGatewayInvoke,
}));

import {MemoryStoreScreen} from '../src/screens/MemoryStoreScreen';

describe('MemoryStoreScreen', () => {
  beforeEach(() => {
    mockGatewayInvoke.mockReset();
    mockGatewayInvoke.mockRejectedValue(new Error('Gateway not configured'));
  });

  async function renderScreen() {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<MemoryStoreScreen />);
    });
    return tree!;
  }

  function getTexts(root: ReactTestRenderer.ReactTestInstance, substr: string) {
    return root.findAllByType(Text).filter(
      node => String(node.props.children ?? '').includes(substr),
    );
  }

  function findChip(root: ReactTestRenderer.ReactTestInstance, label: string) {
    return root.findAllByType(TouchableOpacity).find(node => {
      const texts = node.findAllByType(Text).map(t => String(t.props.children ?? ''));
      return texts.some(t => t.includes(label));
    });
  }

  it('renders screen title and seed entries', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    expect(getTexts(root, '记忆库').length).toBeGreaterThan(0);
    expect(getTexts(root, '偏好深色主题').length).toBeGreaterThan(0);
    expect(getTexts(root, '聚源三维智慧矿山').length).toBeGreaterThan(0);
  });

  it('renders composer section with new memory form', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    // Composer title: "新增记忆"
    expect(getTexts(root, '新增记忆').length).toBeGreaterThan(0);
    // Four category chips
    expect(findChip(root, '偏好')).toBeTruthy();
    expect(findChip(root, '决策')).toBeTruthy();
    expect(findChip(root, '事实')).toBeTruthy();
    expect(findChip(root, '规则')).toBeTruthy();
    // Save button text
    const saveBtn = root.findAllByType(TouchableOpacity).find(node => {
      const texts = node.findAllByType(Text).map(t => String(t.props.children ?? ''));
      return texts.some(t => t.includes('写入记忆'));
    });
    expect(saveBtn).toBeTruthy();
  });

  it('search input filters entries locally', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    // inputs[1] is the search input (inputs[0] is the composer input)
    const searchInput = root.findAllByType(TextInput)[1];
    expect(searchInput).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      searchInput.props.onChangeText?.('选矿');
    });

    expect(getTexts(root, '选矿').length).toBeGreaterThan(0);
  });

  it('gracefully shows result when gateway is offline and query has no match', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    const searchInput = root.findAllByType(TextInput)[1];
    await ReactTestRenderer.act(async () => {
      searchInput.props.onChangeText?.('完全不存在的xyz123');
    });

    // No crash — still renders
    expect(getTexts(root, '记忆库').length).toBeGreaterThan(0);
  });

  it('uses remote search results when gateway is connected', async () => {
    mockGatewayInvoke.mockReset();
    mockGatewayInvoke.mockResolvedValue({
      results: [
        {
          id: 'remote-m1',
          text: '钨矿 AI 大脑已连通信用评分 API',
          category: 'fact',
          scope: 'renzhi',
        },
      ],
    });

    const tree = await renderScreen();
    const root = tree.root;

    const searchInput = root.findAllByType(TextInput)[1];
    await ReactTestRenderer.act(async () => {
      searchInput.props.onChangeText?.('钨矿 信用');
    });

    // Remote result appears
    expect(getTexts(root, '钨矿 AI 大脑已连通信用评分 API').length).toBeGreaterThan(0);
    expect(mockGatewayInvoke).toHaveBeenCalledWith(
      'memory_recall',
      'search',
      expect.objectContaining({query: '钨矿 信用', limit: 10}),
    );
  });

  it('save button does not crash when gateway is offline', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    const saveBtn = root.findAllByType(TouchableOpacity).find(node => {
      const texts = node.findAllByType(Text).map(t => String(t.props.children ?? ''));
      return texts.some(t => t.includes('写入记忆'));
    });
    expect(saveBtn).toBeTruthy();

    const composerInput = root.findAllByType(TextInput)[0];
    await ReactTestRenderer.act(async () => {
      composerInput.props.onChangeText?.('一条测试记忆');
    });

    // Save should not throw
    await ReactTestRenderer.act(async () => {
      saveBtn!.props.onPress();
    });

    // Screen still rendered
    expect(getTexts(root, '记忆库').length).toBeGreaterThan(0);
  });
});
