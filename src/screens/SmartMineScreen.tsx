import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {SmartMineService} from '../services/SmartMineService';
import {SmartMineCard} from '../components/SmartMineCard';
import {SectionTitle} from '../components/SectionTitle';
import {C} from '../data/constants';
import type {ProductionData, Equipment, Alert, Camera, SafetyKPI} from '../types/smartmine';

type EquipmentFilter = 'all' | 'running' | 'standby' | 'fault';
type AlertFilter = 'all' | 'critical' | 'warning' | 'info';

const EQUIPMENT_STATUS_COLORS: Record<string, string> = {
  running:    '#34d399',
  standby:    '#94a3b8',
  fault:      C.error,
  maintenance: C.warning,
};

const EQUIPMENT_STATUS_LABEL: Record<string, string> = {
  running:    '运行中',
  standby:    '待机',
  fault:      '故障',
  maintenance: '维保',
};

const ALERT_COLORS: Record<string, string> = {
  critical: C.error,
  warning:  C.warning,
  info:     C.primary,
};

export function SmartMineScreen() {
  const [production, setProduction] = useState<ProductionData | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [safety, setSafety] = useState<SafetyKPI | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [equipFilter, setEquipFilter] = useState<EquipmentFilter>('all');
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');

  const loadAll = useCallback(async () => {
    const [p, e, a, c, s] = await Promise.all([
      SmartMineService.getProduction(),
      SmartMineService.getEquipment(),
      SmartMineService.getAlerts(),
      SmartMineService.getCameras(),
      SmartMineService.getSafetyKPI(),
    ]);
    setProduction(p);
    setEquipment(e);
    setAlerts(a);
    setCameras(c);
    setSafety(s.kpi as SafetyKPI);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const filteredEquipment = equipFilter === 'all'
    ? equipment
    : equipment.filter(e => e.status === equipFilter);

  const filteredAlerts = alertFilter === 'all'
    ? alerts
    : alerts.filter(a => a.level === alertFilter);

  const equipOnlineCount = equipment.filter(e => e.status === 'running').length;
  const equipTotal = equipment.length;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
      }
    >
      {/* ── 生产总览 ── */}
      <SectionTitle title="生产总览" hint="实时数据" />
      {production && (
        <View style={styles.productionGrid}>
          <SmartMineCard
            title="今日产量"
            icon="⛏️"
            data={[
              { label: '产量', value: production.today.output, unit: production.today.unit, status: 'normal' },
              { label: '回收率', value: production.today.recovery, unit: '%', trend: 'stable', status: 'normal' },
              { label: 'OEE', value: production.today.oee, unit: '%', trend: 'up', status: 'normal' },
              { label: '安全天数', value: production.today.safetyDays, unit: '天', status: 'normal' },
            ]}
            onRefresh={onRefresh}
            refreshing={refreshing}
          />
          <View style={styles.productionRight}>
            <View style={styles.monthlyCard}>
              <Text style={styles.monthlyLabel}>月度完成率</Text>
              <Text style={styles.monthlyValue}>{production.monthly.completion}%</Text>
              <Text style={styles.monthlySub}>
                {production.monthly.output.toLocaleString()} / {production.monthly.target.toLocaleString()} 吨
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── 设备状态 ── */}
      <SectionTitle title="设备状态" hint={`${equipOnlineCount}/${equipTotal} 运行中`} />
      <View style={styles.filterRow}>
        {(['all', 'running', 'standby', 'fault'] as EquipmentFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, equipFilter === f && styles.filterChipActive]}
            onPress={() => setEquipFilter(f)}
          >
            <Text style={[styles.filterChipText, equipFilter === f && styles.filterChipTextActive]}>
              {f === 'all' ? '全部' : EQUIPMENT_STATUS_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.equipList}>
        {filteredEquipment.map(eq => (
          <View key={eq.id} style={styles.equipRow}>
            <View style={[styles.equipDot, {backgroundColor: EQUIPMENT_STATUS_COLORS[eq.status] ?? '#94a3b8'}]} />
            <View style={styles.equipInfo}>
              <Text style={styles.equipName}>{eq.name}</Text>
              <Text style={styles.equipMeta}>
                {EQUIPMENT_STATUS_LABEL[eq.status] ?? eq.status}
                {eq.temp != null ? ` · ${eq.temp}℃` : ''}
                {eq.vibration != null ? ` · 振动 ${eq.vibration}` : ''}
              </Text>
            </View>
            <View style={[styles.equipStatusBadge, {borderColor: EQUIPMENT_STATUS_COLORS[eq.status]}]}>
              <Text style={[styles.equipStatusText, {color: EQUIPMENT_STATUS_COLORS[eq.status]}]}>
                {EQUIPMENT_STATUS_LABEL[eq.status]}
              </Text>
            </View>
          </View>
        ))}
        {filteredEquipment.length === 0 && (
          <Text style={styles.emptyText}>暂无设备数据</Text>
        )}
      </View>

      {/* ── 告警中心 ── */}
      <SectionTitle title="告警中心" hint={`${alerts.filter(a => a.level !== 'info').length} 条待处理`} />
      <View style={styles.filterRow}>
        {(['all', 'critical', 'warning', 'info'] as AlertFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, alertFilter === f && styles.filterChipActive]}
            onPress={() => setAlertFilter(f)}
          >
            <Text style={[styles.filterChipText, alertFilter === f && styles.filterChipTextActive]}>
              {f === 'all' ? '全部' : f === 'critical' ? '严重' : f === 'warning' ? '警告' : '通知'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.alertList}>
        {filteredAlerts.map(alert => (
          <View key={alert.id} style={styles.alertRow}>
            <View style={[styles.alertIndicator, {backgroundColor: ALERT_COLORS[alert.level]}]} />
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertMeta}>{alert.zone} · {alert.time}</Text>
            </View>
            <View style={[styles.alertLevelBadge, {borderColor: ALERT_COLORS[alert.level]}]}>
              <Text style={[styles.alertLevelText, {color: ALERT_COLORS[alert.level]}]}>
                {alert.level === 'critical' ? '严重' : alert.level === 'warning' ? '警告' : '通知'}
              </Text>
            </View>
          </View>
        ))}
        {filteredAlerts.length === 0 && (
          <Text style={styles.emptyText}>暂无告警</Text>
        )}
      </View>

      {/* ── 安全 KPI ── */}
      {safety && (
        <>
          <SectionTitle title="安全数据" hint="本月安全绩效" />
          <View style={styles.safetyGrid}>
            <View style={styles.safetyCard}>
              <Text style={[styles.safetyScore, {color: safety.score >= 90 ? '#34d399' : C.warning}]}>
                {safety.score}
              </Text>
              <Text style={styles.safetyLabel}>安全评分</Text>
            </View>
            <View style={styles.safetyCard}>
              <Text style={[styles.safetyScore, {color: safety.hazardsOpen > 0 ? C.warning : '#34d399'}]}>
                {safety.hazardsOpen}
              </Text>
              <Text style={styles.safetyLabel}>未闭合隐患</Text>
            </View>
            <View style={styles.safetyCard}>
              <Text style={[styles.safetyScore, {color: '#34d399'}]}>{safety.hazardsClosed}</Text>
              <Text style={styles.safetyLabel}>已闭合隐患</Text>
            </View>
            <View style={styles.safetyCard}>
              <Text style={[styles.safetyScore, {color: safety.incidentsMonth > 0 ? C.error : '#34d399'}]}>
                {safety.incidentsMonth}
              </Text>
              <Text style={styles.safetyLabel}>本月事故</Text>
            </View>
          </View>
          <View style={styles.safetyRateRow}>
            <Text style={styles.safetyRateLabel}>巡检覆盖率</Text>
            <Text style={styles.safetyRateValue}>{safety.inspectionRate}%</Text>
          </View>
        </>
      )}

      {/* ── 视频监控 ── */}
      <SectionTitle title="视频监控" hint={`${cameras.filter(c => c.status === 'online').length}/${cameras.length} 在线`} />
      <View style={styles.cameraGrid}>
        {cameras.map(cam => (
          <View key={cam.id} style={[styles.cameraCard, cam.status === 'offline' && styles.cameraCardOffline]}>
            <View style={styles.cameraPreview}>
              <Text style={styles.cameraEmoji}>{cam.status === 'online' ? '📹' : '📷'}</Text>
              <View style={[styles.cameraOnlineDot, {backgroundColor: cam.status === 'online' ? '#34d399' : C.error}]} />
            </View>
            <Text style={styles.cameraName}>{cam.name}</Text>
            <Text style={styles.cameraLocation}>{cam.location}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 16, paddingBottom: 100},
  productionGrid: {flexDirection: 'row', gap: 10, marginBottom: 20},
  productionRight: {flex: 1},
  monthlyCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    justifyContent: 'center',
  },
  monthlyLabel: {color: C.textMuted, fontSize: 12},
  monthlyValue: {color: C.primary, fontSize: 32, fontWeight: '900', marginTop: 4},
  monthlySub: {color: C.textMuted, fontSize: 10, marginTop: 4},
  filterRow: {flexDirection: 'row', gap: 8, marginBottom: 12},
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: 'rgba(77,255,136,0.12)',
    borderColor: C.primary,
  },
  filterChipText: {color: C.textMuted, fontSize: 13, fontWeight: '700'},
  filterChipTextActive: {color: C.primary},
  equipList: {gap: 8, marginBottom: 20},
  equipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  equipDot: {width: 8, height: 8, borderRadius: 4},
  equipInfo: {flex: 1},
  equipName: {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  equipMeta: {color: C.textMuted, fontSize: 12, marginTop: 2},
  equipStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  equipStatusText: {fontSize: 11, fontWeight: '900'},
  alertList: {gap: 8, marginBottom: 20},
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  alertIndicator: {width: 4, height: 40, borderRadius: 2},
  alertInfo: {flex: 1},
  alertTitle: {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  alertMeta: {color: C.textMuted, fontSize: 12, marginTop: 2},
  alertLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertLevelText: {fontSize: 11, fontWeight: '900'},
  safetyGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12},
  safetyCard: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: 'center',
  },
  safetyScore: {fontSize: 32, fontWeight: '900'},
  safetyLabel: {color: C.textMuted, fontSize: 12, marginTop: 4},
  safetyRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  safetyRateLabel: {color: C.textMuted, fontSize: 13},
  safetyRateValue: {color: C.primary, fontSize: 16, fontWeight: '900'},
  cameraGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  cameraCard: {
    width: '31%',
    padding: 10,
    borderRadius: 14,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: 'center',
  },
  cameraCardOffline: {opacity: 0.5},
  cameraPreview: {position: 'relative', marginBottom: 6},
  cameraEmoji: {fontSize: 32},
  cameraOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cameraName: {color: C.textTitle, fontSize: 11, fontWeight: '800', textAlign: 'center'},
  cameraLocation: {color: C.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center'},
  emptyText: {color: C.textMuted, fontSize: 12, textAlign: 'center', padding: 20},
  footer: {height: 32},
});
