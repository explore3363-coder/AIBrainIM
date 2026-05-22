// 实时矿山 KPI Hook
// 自动订阅生产/安全/设备数据，提供实时 KPI 状态
// DataBus 不可用时优雅降级到 SmartMineService 静态数据

import {useEffect, useState, useRef} from 'react';
import {useDataBus, type DataBusMessage} from './useDataBus';
import {SmartMineService} from '../services/SmartMineService';
import type {ProductionData, Equipment, Alert} from '../types/smartmine';

interface UseMiningKPIsOptions {
  /** 是否启用实时 DataBus（默认 true） */
  enabled?: boolean;
  /** 手动指定是否使用实时数据 */
  forceLive?: boolean;
}

export interface MiningKPIs {
  connected: boolean;
  production: ProductionData | null;
  equipment: Equipment[];
  alerts: Alert[];
  cameras: Array<{id: string; name: string; status: 'online' | 'offline'}>;
  // 趋势
  outputTrend?: 'up' | 'down' | 'stable';
  // 统计
  runningCount: number;
  faultCount: number;
  criticalCount: number;
  // 数据来源
  isLive: boolean;
  lastUpdateAt?: number;
}

export function useMiningKPIs(options: UseMiningKPIsOptions = {}): MiningKPIs {
  const {enabled = true} = options;

  // 实时数据状态（来自 DataBus）
  const [liveProduction, setLiveProduction] = useState<ProductionData | null>(null);
  const [liveEquipment, setLiveEquipment] = useState<Equipment[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([]);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | undefined>();

  // 静态数据状态（来自 SmartMineService，作为降级）
  const [staticProduction, setStaticProduction] = useState<ProductionData | null>(null);
  const [staticEquipment, setStaticEquipment] = useState<Equipment[]>([]);
  const [staticAlerts, setStaticAlerts] = useState<Alert[]>([]);
  const [staticLoaded, setStaticLoaded] = useState(false);

  // DataBus 订阅
  const {connected, getLatest, getMessagesByTopic} = useDataBus({
    topics: ['production:realtime', 'alert:new', 'equipment:status'],
    enableWildcard: true,
  });

  // 追踪上一条数据用于趋势计算
  const prevOutputRef = useRef<number | null>(null);

  // 加载静态降级数据（一次性）
  useEffect(() => {
    if (!enabled) return;

    async function loadStatic() {
      try {
        const [prod, equip, alerts] = await Promise.all([
          SmartMineService.getProduction(),
          SmartMineService.getEquipment(),
          SmartMineService.getAlerts(),
        ]);
        setStaticProduction(prod);
        setStaticEquipment(equip);
        setStaticAlerts(alerts);
        setStaticLoaded(true);
      } catch {
        setStaticLoaded(true); // 即使失败也标记为已加载
      }
    }
    loadStatic();
  }, [enabled]);

  // 处理实时数据更新
  useEffect(() => {
    if (!enabled || !connected) return;

    // 生产数据
    const prodMsg = getLatest<ProductionData>('production:realtime');
    if (prodMsg?.data) {
      setLiveProduction(prodMsg.data);
      setLastUpdateAt(Date.now());

      // 计算趋势
      if (prevOutputRef.current !== null && prodMsg.data.today) {
        const diff = prodMsg.data.today.output - prevOutputRef.current;
        prevOutputRef.current = prodMsg.data.today.output;
        // trend stored in ref for next comparison
      } else if (prodMsg.data.today) {
        prevOutputRef.current = prodMsg.data.today.output;
      }
    }

    // 设备状态
    const equipMsgs = getMessagesByTopic('equipment:status');
    if (equipMsgs.length > 0) {
      const latest = equipMsgs[equipMsgs.length - 1];
      if (latest.data) {
        setLiveEquipment(latest.data as Equipment[]);
      }
    }

    // 告警（只追加新告警，不重复已有）
    const alertMsgs = getMessagesByTopic('alert:new');
    if (alertMsgs.length > 0) {
      setLiveAlerts(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newAlerts = (alertMsgs.map(m => m.data as Alert)).filter(
          a => !existingIds.has(a.id),
        );
        if (newAlerts.length === 0) return prev;
        return [...newAlerts, ...prev].slice(0, 20);
      });
    }
  }, [enabled, connected, getLatest, getMessagesByTopic]);

  // 统计计算
  const runningCount =
    (liveEquipment.length > 0 ? liveEquipment : staticEquipment).filter(
      e => e.status === 'running',
    ).length;

  const faultCount =
    (liveEquipment.length > 0 ? liveEquipment : staticEquipment).filter(
      e => e.status === 'fault',
    ).length;

  const criticalCount =
    (liveAlerts.length > 0 ? liveAlerts : staticAlerts).filter(
      a => a.level === 'critical',
    ).length;

  // 产量趋势计算（基于两帧数据对比）
  const outputTrend = (() => {
    const prod = liveProduction ?? staticProduction;
    if (!prod?.today) return undefined;
    const prev = prevOutputRef.current;
    if (prev === null) return undefined;
    const curr = prod.today.output;
    if (curr > prev) return 'up';
    if (curr < prev) return 'down';
    return 'stable';
  })();

  // 摄像头（暂无 DataBus 数据源，用静态）
  const cameras =
    liveEquipment.length > 0
      ? []
      : [
          {id: 'cam-01', name: '主井口', status: 'online' as const},
          {id: 'cam-02', name: '选矿厂全景', status: 'online' as const},
          {id: 'cam-03', name: '尾矿库', status: 'online' as const},
          {id: 'cam-04', name: '运输道路', status: 'offline' as const},
          {id: 'cam-05', name: '破碎车间', status: 'online' as const},
          {id: 'cam-06', name: '浮选车间', status: 'online' as const},
        ];

  const isLive = connected && liveProduction !== null;

  return {
    connected,
    production: liveProduction ?? (staticLoaded ? staticProduction : null),
    equipment: liveEquipment.length > 0 ? liveEquipment : staticEquipment,
    alerts: liveAlerts.length > 0 ? liveAlerts : staticAlerts,
    cameras,
    outputTrend,
    runningCount,
    faultCount,
    criticalCount,
    isLive,
    lastUpdateAt,
  };
}
