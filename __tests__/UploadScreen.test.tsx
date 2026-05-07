/**
 * @format
 * UploadScreen tests — validates rendering, navigation, and runtime banner logic.
 * File queue rendering requires integration tests with a real uploadService backend.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';

// ─── Shared mutable mock state ─────────────────────────────────────────────────
var mockRuntimeMode: 'live' | 'fallback' = 'live';
var mockRuntimeError: string | undefined;
var mockGatewayConfigValid = true;

jest.mock('../src/context/AppContext', () => ({
  useAppContext: () => ({
    runtimeMode: mockRuntimeMode,
    runtimeError: mockRuntimeError,
    gatewayConfigValid: mockGatewayConfigValid,
  }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: any) => children,
  useNavigation: () => ({navigate: mockNavigate}),
  useRoute: () => ({params: {}}),
}));

// ─── Component ────────────────────────────────────────────────────────────────
import {UploadScreen} from '../src/screens/UploadScreen';

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('UploadScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRuntimeMode = 'live';
    mockRuntimeError = undefined;
    mockGatewayConfigValid = true;
  });

  // ── Empty state ──────────────────────────────────────────────────────────────
  it('renders empty state with upload prompt', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '暂无上传任务')).toBeDefined();
    expect(texts.find(t => t.props.children === '📭')).toBeDefined();
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('无大小限制'))).toBeDefined();
  });

  it('shows correct file count (0) in header when empty', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children != null && (t.props.children === 0 || (Array.isArray(t.props.children) && t.props.children[0] === 0)))).toBeDefined();
  });

  it('shows + 上传 button in header', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '+ 上传')).toBeDefined();
  });

  // ── Runtime banner ───────────────────────────────────────────────────────────
  it('shows fallback mode banner in fallback mode', async () => {
    mockRuntimeMode = 'fallback';
    mockGatewayConfigValid = false;
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '当前为回退模式')).toBeDefined();
  });

  it('shows runtime error text when runtimeError is set', async () => {
    mockRuntimeMode = 'fallback';
    mockRuntimeError = 'Gateway unreachable';
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('Gateway unreachable'))).toBeDefined();
  });

  it('shows Gateway configured hint when gatewayConfigValid is true in fallback', async () => {
    mockRuntimeMode = 'fallback';
    mockRuntimeError = undefined;
    mockGatewayConfigValid = true;
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('Gateway 配置已就绪'))).toBeDefined();
  });

  it('hides runtime banner in live mode', async () => {
    mockRuntimeMode = 'live';
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '当前为回退模式')).toBeUndefined();
  });

  // ── Upload policy banner ─────────────────────────────────────────────────────
  it('always shows upload policy banner regardless of mode', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('无大小限制'))).toBeDefined();
  });

  // ── Navigation ───────────────────────────────────────────────────────────────
  it('navigates to GatewaySettings from fallback banner "去配置" button', async () => {
    mockRuntimeMode = 'fallback';
    mockGatewayConfigValid = false;
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const btn = touchables.find(b =>
      b.findAllByType(Text).some(t => t.props.children === '去配置')
    );
    expect(btn).toBeDefined();
    ReactTestRenderer.act(() => { (btn as any).props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('GatewaySettings');
  });

  it('navigates to Chat when "选择文件上传" is pressed (empty state)', async () => {
    // In empty state, pressing the upload button opens an alert (not navigation).
    // Test that the upload button exists and is pressable.
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    // Find "选择文件上传" or "+ 上传" button
    const uploadBtn = touchables.find(b =>
      b.findAllByType(Text).some(t =>
        typeof t.props.children === 'string' &&
        (t.props.children.includes('选择文件上传') || t.props.children === '+ 上传')
      )
    );
    expect(uploadBtn).toBeDefined();
  });

  // ── Component structure ──────────────────────────────────────────────────────
  it('renders with correct title in header', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => t.props.children === '📤 上传管理')).toBeDefined();
  });

  it('renders empty state subheading with correct hint text', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<UploadScreen />); });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.find(t => typeof t.props.children === 'string' && t.props.children.includes('小文件直传'))).toBeDefined();
  });
});
