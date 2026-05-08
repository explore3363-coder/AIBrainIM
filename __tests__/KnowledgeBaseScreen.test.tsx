import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity, TextInput, Alert} from 'react-native';

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    agents: [],
    tasks: [],
    uploads: [],
    dispatches: [],
    confirmations: [],
    registerKnowledgeCapture: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

const mockGatewayInvoke = jest.fn();
jest.mock('../src/data/api', () => ({
  gatewayInvoke: mockGatewayInvoke,
}));

// Import KnowledgeBaseScreen after mocks are set up
import {KnowledgeBaseScreen} from '../src/screens/KnowledgeBaseScreen';

describe('KnowledgeBaseScreen', () => {
  beforeEach(() => {
    mockGatewayInvoke.mockReset();
    mockGatewayInvoke.mockResolvedValue(null);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderScreen() {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<KnowledgeBaseScreen />);
    });
    return tree!;
  }

  function getTexts(root: ReactTestRenderer.ReactTestInstance, substr: string) {
    return root.findAllByType(Text).filter(
      node => String(node.props.children ?? '').includes(substr),
    );
  }

  function findBtn(root: ReactTestRenderer.ReactTestInstance, labelSubstr: string) {
    return root.findAllByType(TouchableOpacity).find(node => {
      const texts = node.findAllByType(Text).map(t => String(t.props.children ?? ''));
      return texts.some(t => t.includes(labelSubstr));
    });
  }

  it('renders the screen title and static KB docs', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    expect(getTexts(root, '知识库').length).toBeGreaterThan(0);
    expect(getTexts(root, '中国钨矿资源分布').length).toBeGreaterThan(0);
    expect(getTexts(root, '智慧矿山数字孪生技术路线').length).toBeGreaterThan(0);
    expect(getTexts(root, 'OpenClaw Agent Runtime 架构').length).toBeGreaterThan(0);
  });

  it('renders all four category filter chips', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    expect(findBtn(root, '矿业')).toBeTruthy();
    expect(findBtn(root, '工程')).toBeTruthy();
    expect(findBtn(root, '技术')).toBeTruthy();
    expect(findBtn(root, '政策')).toBeTruthy();
  });

  it('filters docs by category when a chip is tapped', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    // Initially technical docs are visible
    expect(getTexts(root, 'OpenClaw Agent Runtime').length).toBeGreaterThan(0);

    // Tap 矿业 chip
    const miningChip = findBtn(root, '矿业');
    await ReactTestRenderer.act(async () => {
      miningChip!.props.onPress();
    });

    // After filtering to 矿业, technical doc should not appear
    expect(getTexts(root, 'OpenClaw Agent Runtime').length).toBe(0);
  });

  it('performs local search across title and summary', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    // Find the search TextInput
    const searchInput = root.findAllByType(TextInput)[0];
    expect(searchInput).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      searchInput.props.onChangeText?.('选矿');
    });

    expect(getTexts(root, 'XRT').length).toBeGreaterThan(0);
  });

  it('shows fallback alert when "查看全文" is tapped without real gateway', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    const readBtn = findBtn(root, '查看全文');
    expect(readBtn).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      readBtn!.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('calls feishu_wiki + feishu_doc when gateway is connected and wikiQuery exists', async () => {
    // Setup: wiki search returns a token, doc read returns content
    mockGatewayInvoke
      .mockResolvedValueOnce({nodes: [{node_token: 'fake_wiki_token'}]})
      .mockResolvedValueOnce('这是 OpenClaw Agent Runtime 的完整技术架构正文内容。');

    const tree = await renderScreen();
    const root = tree.root;

    const readBtn = findBtn(root, '查看全文');
    expect(readBtn).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      readBtn!.props.onPress();
    });

    expect(mockGatewayInvoke).toHaveBeenNthCalledWith(
      1,
      'feishu_wiki',
      'search',
      expect.objectContaining({query: 'OpenClaw Agent Runtime'}),
    );
    expect(mockGatewayInvoke).toHaveBeenNthCalledWith(
      2,
      'feishu_doc',
      'read',
      expect.objectContaining({doc_token: 'fake_wiki_token'}),
    );
  });

  it('calls memory_store when "收录到记忆" is tapped', async () => {
    const tree = await renderScreen();
    const root = tree.root;

    const saveBtn = findBtn(root, '收录到记忆');
    expect(saveBtn).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      saveBtn!.props.onPress();
    });

    expect(mockGatewayInvoke).toHaveBeenCalledWith(
      'memory_store',
      'remember',
      expect.objectContaining({
        category: expect.stringMatching(/^(fact|decision|rule)$/),
        text: expect.any(String),
      }),
    );
  });

  it('falls back to summary alert when wiki search returns empty results', async () => {
    mockGatewayInvoke.mockReset();
    mockGatewayInvoke.mockResolvedValue({nodes: []});

    const tree = await renderScreen();
    const root = tree.root;

    const readBtn = findBtn(root, '查看全文');
    await ReactTestRenderer.act(async () => {
      readBtn!.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
  });
});
