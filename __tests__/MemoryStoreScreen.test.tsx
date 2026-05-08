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

  it('renders composer section with category chips and save button', async () => {
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

  it('search input is present and accessible', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    // inputs[1] is the search input (inputs[0] is the composer input)
    const searchInput = root.findAllByType(TextInput)[1];
    expect(searchInput).toBeTruthy();
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
