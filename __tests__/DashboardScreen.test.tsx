import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {DashboardScreen} from '../src/screens/DashboardScreen';
import * as SmartMineService from '../src/services/SmartMineService';

// ─── Mock SmartMineService ────────────────────────────────────────────────────

const MOCK_PRODUCTION = {
  today: {output: 1247, unit: '吨', recovery: 86.3, oee: 94.7, safetyDays: 2847},
  monthly: {output: 38240, target: 40000, completion: 95.6},
};

const MOCK_EQUIPMENT = [
  {id: 'eq-01', name: '1# 球磨机', status: 'running', temp: 68, vibration: 0.4},
  {id: 'eq-02', name: '2# 球磨机', status: 'standby', temp: 42, vibration: 0.1},
  {id: 'eq-03', name: '浮选机组', status: 'running', temp: 55, vibration: 0.3},
  {id: 'eq-04', name: '3# 浓密机', status: 'fault', temp: 89, vibration: 1.2},
  {id: 'eq-05', name: '皮带廊', status: 'running', temp: 48, vibration: 0.2},
];

const MOCK_ALERTS = [
  {id: 'al-01', level: 'critical', title: '3# 球磨机轴承温度超限', time: '14:23', zone: '选矿厂'},
  {id: 'al-02', level: 'warning', title: '2# 浮选机液位偏低', time: '13:51', zone: '浮选车间'},
  {id: 'al-03', level: 'info', title: '尾矿库水位监测正常', time: '12:00', zone: '尾矿库'},
];

const MOCK_CAMERAS = [
  {id: 'cam-01', name: '主井口', location: '主井', status: 'online', scene: 'shaft'},
  {id: 'cam-02', name: '选矿厂全景', location: '选矿厂', status: 'online', scene: 'plant'},
  {id: 'cam-03', name: '尾矿库', location: '尾矿库', status: 'online', scene: 'dam'},
  {id: 'cam-04', name: '运输道路', location: '入场道路', status: 'offline', scene: 'road'},
  {id: 'cam-05', name: '破碎车间', location: '破碎车间', status: 'online', scene: 'plant'},
  {id: 'cam-06', name: '浮选车间', location: '浮选车间', status: 'online', scene: 'plant'},
];

jest.mock('../src/services/SmartMineService', () => ({
  SmartMineService: {
    getProduction: jest.fn(),
    getEquipment: jest.fn(),
    getAlerts: jest.fn(),
    getSafetyKPI: jest.fn(),
    getCameras: jest.fn(),
    getOreBodySensors: jest.fn(),
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function allTextNodes(root: ReactTestRenderer.ReactTestRenderer['root']): string[] {
  return root.findAllByType(Text).map(node => {
    const child = node.props.children;
    return Array.isArray(child) ? child.join('') : String(child ?? '');
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardScreen — Smart Mine Dashboard', () => {
  beforeEach(() => {
    (SmartMineService.SmartMineService.getProduction as jest.Mock).mockResolvedValue(MOCK_PRODUCTION);
    (SmartMineService.SmartMineService.getEquipment as jest.Mock).mockResolvedValue(MOCK_EQUIPMENT);
    (SmartMineService.SmartMineService.getAlerts as jest.Mock).mockResolvedValue(MOCK_ALERTS);
    (SmartMineService.SmartMineService.getCameras as jest.Mock).mockResolvedValue(MOCK_CAMERAS);
    jest.clearAllMocks();
  });

  it('renders the smart mine page title and live indicator', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    // Page title (inside ScrollView header)
    expect(texts.some(t => t.includes('智慧矿山管控平台'))).toBe(true);
    // LiveDot pill
    expect(texts.some(t => t === '实时')).toBe(true);
  });

  it('renders the digital twin card with key metadata', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    // Twin card title and sub
    expect(texts.some(t => t.includes('智慧矿山三维管控平台'))).toBe(true);
    expect(texts.some(t => t.includes('聚源钨矿数字孪生'))).toBe(true);
    // Hint text on the card
    expect(texts.some(t => t.includes('点击查看三维模型'))).toBe(true);
  });

  it('renders the production hero stats with correct values', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    // Stat labels
    expect(texts.some(t => t.includes('今日产量'))).toBe(true);
    expect(texts.some(t => t.includes('吨'))).toBe(true);
    expect(texts.some(t => t.includes('回收率'))).toBe(true);
    expect(texts.some(t => t.includes('OEE'))).toBe(true);
    expect(texts.some(t => t.includes('安全天'))).toBe(true);
    // Values from MOCK_PRODUCTION
    expect(texts.some(t => t.includes('86.3'))).toBe(true); // recovery
    expect(texts.some(t => t.includes('94.7'))).toBe(true); // oee
    expect(texts.some(t => t.includes('2847'))).toBe(true); // safetyDays
  });

  it('renders the equipment status section with equipment cards', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    // Section title is rendered via SectionTitle
    expect(texts.some(t => t.includes('设备状态'))).toBe(true);
    // Equipment names from mock
    expect(texts.some(t => t.includes('1# 球磨机'))).toBe(true);
    expect(texts.some(t => t.includes('浮选机组'))).toBe(true);
    // Status labels
    expect(texts.some(t => t.includes('运行'))).toBe(true);
    expect(texts.some(t => t.includes('待机'))).toBe(true);
    expect(texts.some(t => t.includes('故障'))).toBe(true);
  });

  it('renders the real-time alerts section', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    expect(texts.some(t => t.includes('实时告警'))).toBe(true);
    // Alert titles from mock
    expect(texts.some(t => t.includes('3# 球磨机轴承温度超限'))).toBe(true);
    expect(texts.some(t => t.includes('2# 浮选机液位偏低'))).toBe(true);
    // Zone info
    expect(texts.some(t => t.includes('选矿厂'))).toBe(true);
    expect(texts.some(t => t.includes('浮选车间'))).toBe(true);
  });

  it('renders the worker positioning section', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    expect(texts.some(t => t.includes('人员定位'))).toBe(true);
    // Worker names are hard-coded in WorkerPositioning
    expect(texts.some(t => t.includes('张志刚'))).toBe(true);
    expect(texts.some(t => t.includes('李晓峰'))).toBe(true);
    expect(texts.some(t => t.includes('王建国'))).toBe(true);
    expect(texts.some(t => t.includes('陈永强'))).toBe(true);
  });

  it('renders the top bar navigation items', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    expect(texts.some(t => t.includes('智慧矿山管控平台'))).toBe(true);
    expect(texts.some(t => t.includes('设备状态'))).toBe(true);
    expect(texts.some(t => t.includes('实时告警'))).toBe(true);
    expect(texts.some(t => t.includes('人员定位'))).toBe(true);
  });

  it('renders all four explicitly-titled sections', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    // These are the four sections with explicit SectionTitle:
    expect(texts.some(t => t.includes('智慧矿山管控平台'))).toBe(true);
    expect(texts.some(t => t.includes('设备状态'))).toBe(true);
    expect(texts.some(t => t.includes('实时告警'))).toBe(true);
    expect(texts.some(t => t.includes('人员定位'))).toBe(true);
  });

  it('uses mock data (does not call real API)', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    expect(SmartMineService.SmartMineService.getProduction).toHaveBeenCalled();
    expect(SmartMineService.SmartMineService.getEquipment).toHaveBeenCalled();
    expect(SmartMineService.SmartMineService.getAlerts).toHaveBeenCalled();
  });

  it('displays correct production tonnage from mock', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    const texts = allTextNodes(root);
    // MOCK_PRODUCTION.today.output = 1247
    expect(texts.some(t => t.includes('1,247'))).toBe(true);
  });

  it('does not crash when alerts are empty', async () => {
    (SmartMineService.SmartMineService.getAlerts as jest.Mock).mockResolvedValue([]);
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DashboardScreen />);
      await Promise.resolve();
    });
    const root = tree!.root;
    expect(allTextNodes(root).some(t => t.includes('实时告警'))).toBe(true);
  });
});
