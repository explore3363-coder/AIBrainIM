// SmartMineService — 获取智慧矿山实时数据
// 通过 AI协作平台后端 /api/smartmine/* 代理 API 获取矿山数据
// API 不可用时自动降级到模拟数据

import type {ProductionData, Equipment, Alert, Camera, SafetyKPI, OreBodySensorsData} from '../types/smartmine';
import {Platform} from 'react-native';

// ─── Platform Server URL Configuration ───────────────────────────────────────
// REAL URL: Replace the fallback below with your actual platform server URL,
// or wire this to a remote config endpoint (e.g. /api/config).
//
// localhost:3000 is ONLY a safe fallback for iOS/Android simulator builds
// (React Native __DEV__ mode).  For release builds on a real device you must
// use the actual deployment URL; if that URL is unreachable the existing
// try-catch in each service method returns mock data and the app does NOT crash.

function getPlatformServerUrl(): string {
  try {
    // In development (simulator) we can reach the Metro host machine via localhost.
    // In production/release, replace this with your real server URL.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return 'http://localhost:3000';
    }
    // Release / device: return empty string so all fetch() calls fall through
    // to the existing catch → mock-data fallback (no crash).
    // TODO: replace '' with your production URL, e.g. 'https://your-platform-server.com'
    return '';
  } catch {
    return '';
  }
}

const PLATFORM_SERVER_URL = getPlatformServerUrl();
const SM_BASE = () => `${PLATFORM_SERVER_URL}/api/smartmine`;

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PRODUCTION: ProductionData = {
  today: { output: 1247, unit: '吨', recovery: 86.3, oee: 94.7, safetyDays: 2847 },
  monthly: { output: 38240, target: 40000, completion: 95.6 },
};

const MOCK_EQUIPMENT: Equipment[] = [
  { id: 'eq-01', name: '1# 球磨机', status: 'running', temp: 68, vibration: 0.4 },
  { id: 'eq-02', name: '2# 球磨机', status: 'standby', temp: 42, vibration: 0.1 },
  { id: 'eq-03', name: '浮选机组', status: 'running', temp: 55, vibration: 0.3 },
  { id: 'eq-04', name: '3# 浓密机', status: 'fault', temp: 89, vibration: 1.2 },
  { id: 'eq-05', name: '皮带廊', status: 'running', temp: 48, vibration: 0.2 },
];

const MOCK_ALERTS: Alert[] = [
  { id: 'al-01', level: 'critical', title: '3# 球磨机轴承温度超限', time: '14:23', zone: '选矿厂' },
  { id: 'al-02', level: 'warning', title: '2# 浮选机液位偏低', time: '13:51', zone: '浮选车间' },
  { id: 'al-03', level: 'info', title: '尾矿库水位监测正常', time: '12:00', zone: '尾矿库' },
  { id: 'al-04', level: 'info', title: '1# 破碎机完成例检', time: '10:15', zone: '破碎车间' },
];

const MOCK_SAFETY = { kpi: { score: 92.5, hazardsOpen: 3, hazardsClosed: 47, incidentsMonth: 0, inspectionRate: 98.2 } as SafetyKPI };

const MOCK_CAMERAS: Camera[] = [
  { id: 'cam-01', name: '主井口', location: '主井', status: 'online', scene: 'shaft' },
  { id: 'cam-02', name: '选矿厂全景', location: '选矿厂', status: 'online', scene: 'plant' },
  { id: 'cam-03', name: '尾矿库', location: '尾矿库', status: 'online', scene: 'dam' },
  { id: 'cam-04', name: '运输道路', location: '入场道路', status: 'offline', scene: 'road' },
  { id: 'cam-05', name: '破碎车间', location: '破碎车间', status: 'online', scene: 'plant' },
  { id: 'cam-06', name: '浮选车间', location: '浮选车间', status: 'online', scene: 'plant' },
];

const MOCK_SENSORS: OreBodySensorsData = {
  zones: [
    {
      id: 'zone-01',
      name: '1号采场',
      sensors: [
        { id: 's-01', name: '瓦斯', value: 0.08, unit: '%', status: 'normal' },
        { id: 's-02', name: '粉尘', value: 42, unit: 'mg/m³', status: 'normal' },
        { id: 's-03', name: '温度', value: 28, unit: '℃', status: 'normal' },
      ],
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withTimeout(ms: number): RequestInit {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  // Keep timer alive so abort can fire
  (controller as unknown as { _t: ReturnType<typeof setTimeout> })._t = timer;
  return { signal: controller.signal as AbortSignal };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const SmartMineService = {
  async getProduction(): Promise<ProductionData> {
    try {
      const res = await fetch(`${SM_BASE()}/production/today`, withTimeout(5000));
      if (!res.ok) throw new Error('API unavailable');
      const raw = await res.json();
      // 转换 API 响应格式 → ProductionData 格式
      if (raw && !raw.today) {
        return {
          today: {
            output: raw.oreVolume ?? 0,
            unit: '吨',
            recovery: raw.grade ? parseFloat((raw.grade * 100).toFixed(1)) : 0,
            oee: raw.oee ?? 0,
            safetyDays: raw.safetyDays ?? 0,
          },
          monthly: {
            output: raw.monthlyOutput ?? 0,
            target: raw.monthlyTarget ?? 0,
            completion: raw.monthlyCompletion ?? 0,
          },
        };
      }
      return raw;
    } catch {
      return MOCK_PRODUCTION;
    }
  },

  async getEquipment(filter?: string): Promise<Equipment[]> {
    try {
      const url = filter ? `${SM_BASE()}/equipment?filter=${filter}` : `${SM_BASE()}/equipment`;
      const res = await fetch(url, withTimeout(5000));
      if (!res.ok) throw new Error('API unavailable');
      return await res.json();
    } catch {
      return filter ? (MOCK_EQUIPMENT as Equipment[]).filter(e => (e as Equipment).status === filter) : MOCK_EQUIPMENT;
    }
  },

  async getAlerts(level?: string): Promise<Alert[]> {
    try {
      const url = level ? `${SM_BASE()}/alerts?level=${level}` : `${SM_BASE()}/alerts`;
      const res = await fetch(url, withTimeout(5000));
      if (!res.ok) throw new Error('API unavailable');
      return await res.json();
    } catch {
      return level ? MOCK_ALERTS.filter(a => a.level === level) : MOCK_ALERTS;
    }
  },

  async getSafetyKPI(): Promise<{kpi: SafetyKPI}> {
    try {
      const res = await fetch(`${SM_BASE()}/safety/kpi`, withTimeout(5000));
      if (!res.ok) throw new Error('API unavailable');
      return await res.json();
    } catch {
      return MOCK_SAFETY;
    }
  },

  async getCameras(): Promise<Camera[]> {
    try {
      const res = await fetch(`${SM_BASE()}/video/cameras`, withTimeout(5000));
      if (!res.ok) throw new Error('API unavailable');
      return await res.json();
    } catch {
      return MOCK_CAMERAS;
    }
  },

  async getOreBodySensors(): Promise<OreBodySensorsData> {
    try {
      const res = await fetch(`${SM_BASE()}/twin/sensors`, withTimeout(5000));
      if (!res.ok) throw new Error('API unavailable');
      return await res.json();
    } catch {
      return MOCK_SENSORS;
    }
  },
};
