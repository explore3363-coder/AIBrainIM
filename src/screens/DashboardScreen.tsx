import React, {useCallback, useEffect, useState} from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C, LAYOUT} from '../data/constants';
import {SmartMineService} from '../services/SmartMineService';
import type {ProductionData, Equipment, Alert, Camera} from '../types/smartmine';
import type {RootStackParamList} from '../App';

// ─── Top Bar Navigation ────────────────────────────────────────────────────────
function TopBar() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const items = [
    { label: '记忆', screen: 'MemoryStore' as const },
    { label: '知识', screen: 'KnowledgeBase' as const },
    { label: '附件', screen: 'FileLibrary' as const },
    { label: '调度记录', screen: 'DispatchChain' as const },
  ];

  return (
    <View style={topStyles.bar}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          <TouchableOpacity
            style={topStyles.item}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={topStyles.label}>{item.label}</Text>
          </TouchableOpacity>
          {i < items.length - 1 && <Text style={topStyles.sep}>|</Text>}
        </React.Fragment>
      ))}
    </View>
  );
}

const topStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: LAYOUT.pageMargin,
    backgroundColor: C.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  item: {
    paddingHorizontal: 8,
  },
  label: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sep: {
    color: C.borderSubtle,
    fontSize: 13,
  },
});

// ─── Live Dot ─────────────────────────────────────────────────────────────────
function LiveDot() {
  return (
    <View style={liveStyles.pill}>
      <View style={liveStyles.dot} />
      <Text style={liveStyles.text}>实时</Text>
    </View>
  );
}

const liveStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
    marginRight: 4,
  },
  text: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

// ─── Section Title ─────────────────────────────────────────────────────────────
function SectionTitle({title, children}: {title: string; children?: React.ReactNode}) {
  return (
    <View style={secStyles.row}>
      <Text style={secStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const secStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.pageMargin,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
});

// ─── Digital Twin Preview ───────────────────────────────────────────────────────
function TwinPreviewCard({onPress}: {onPress: () => void}) {
  return (
    <TouchableOpacity style={twinStyles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={twinStyles.preview}>
        <View style={twinStyles.previewBg}>
          <View style={twinStyles.terrainGrid}>
            {Array.from({length: 6}).map((_, row) => (
              <View key={row} style={twinStyles.terrainRow}>
                {Array.from({length: 8}).map((_, col) => (
                  <View
                    key={col}
                    style={[
                      twinStyles.terrainCell,
                      (row + col) % 3 === 0 && twinStyles.terrainCellLit,
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={twinStyles.labelBadge}>
            <Text style={twinStyles.labelIcon}>🏔️</Text>
            <Text style={twinStyles.labelText}>聚源钨矿</Text>
          </View>
          <View style={twinStyles.hintBadge}>
            <Text style={twinStyles.hintText}>点击查看三维模型</Text>
          </View>
        </View>
      </View>
      <View style={twinStyles.meta}>
        <View style={twinStyles.metaLeft}>
          <Text style={twinStyles.metaTitle}>智慧矿山三维管控平台</Text>
          <Text style={twinStyles.metaSub}>聚源钨矿数字孪生 · 实时渲染</Text>
        </View>
        <View style={twinStyles.metaArrow}>
          <Text style={twinStyles.arrowText}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const twinStyles = StyleSheet.create({
  card: {
    marginHorizontal: LAYOUT.pageMargin,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    overflow: 'hidden',
    marginBottom: 4,
  },
  preview: { height: 180, backgroundColor: '#0a1628' },
  previewBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  terrainGrid: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  terrainRow: { flexDirection: 'row', gap: 6 },
  terrainCell: {
    width: 32,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(77,255,136,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(77,255,136,0.08)',
  },
  terrainCellLit: {
    backgroundColor: 'rgba(77,255,136,0.14)',
    borderColor: 'rgba(77,255,136,0.3)',
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8,10,15,0.75)',
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  labelIcon: { fontSize: 14 },
  labelText: { color: C.primary, fontSize: 13, fontWeight: '800' },
  hintBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: 'rgba(77,255,136,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hintText: { color: C.primary, fontSize: 10, fontWeight: '700' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  metaLeft: { flex: 1 },
  metaTitle: { color: C.textTitle, fontSize: 14, fontWeight: '800' },
  metaSub: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  metaArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(77,255,136,0.12)',
    borderWidth: 1,
    borderColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { color: C.primary, fontSize: 18, fontWeight: '700' },
});

// ─── Equipment Status ───────────────────────────────────────────────────────────
const EQUIP_STATUS_COLOR: Record<string, string> = {
  running:    '#34d399',
  standby:    '#94a3b8',
  fault:      C.error,
  maintenance: C.warning,
};
const EQUIP_STATUS_LABEL: Record<string, string> = {
  running:    '运行',
  standby:    '待机',
  fault:      '故障',
  maintenance: '维保',
};

function EquipmentRow({equipment}: {equipment: Equipment[]}) {
  return (
    <View style={eqStyles.grid}>
      {equipment.slice(0, 6).map((eq) => (
        <View key={eq.id} style={eqStyles.card}>
          <View style={[eqStyles.dot, {backgroundColor: EQUIP_STATUS_COLOR[eq.status] ?? '#94a3b8'}]} />
          <Text style={eqStyles.name} numberOfLines={1}>{eq.name}</Text>
          <Text style={[eqStyles.status, {color: EQUIP_STATUS_COLOR[eq.status] ?? '#94a3b8'}]}>
            {EQUIP_STATUS_LABEL[eq.status] ?? eq.status}
          </Text>
          {eq.temp != null && <Text style={eqStyles.temp}>{eq.temp}°C</Text>}
        </View>
      ))}
    </View>
  );
}

const eqStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: LAYOUT.pageMargin,
    gap: 8,
  },
  card: {
    width: '31%',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 10,
    alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  name: { color: C.textPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  status: { fontSize: 10, fontWeight: '800' },
  temp: { color: C.textMuted, fontSize: 9, marginTop: 2 },
});

// ─── Alert Item ────────────────────────────────────────────────────────────────
const ALERT_COLORS: Record<string, string> = {
  critical: C.error,
  warning:  C.warning,
  info:     C.primary,
};

function AlertRow({alerts}: {alerts: Alert[]}) {
  return (
    <View style={alStyles.list}>
      {alerts.slice(0, 5).map((alert) => (
        <View key={alert.id} style={alStyles.item}>
          <View style={[alStyles.indicator, {backgroundColor: ALERT_COLORS[alert.level] ?? C.primary}]} />
          <View style={alStyles.content}>
            <Text style={alStyles.title} numberOfLines={1}>{alert.title}</Text>
            <Text style={alStyles.meta}>{alert.zone} · {alert.time}</Text>
          </View>
          <View style={[alStyles.levelBadge, {backgroundColor: `${ALERT_COLORS[alert.level]}22`}]}>
            <Text style={[alStyles.levelText, {color: ALERT_COLORS[alert.level]}]}>
              {alert.level === 'critical' ? '紧急' : alert.level === 'warning' ? '警告' : '通知'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const alStyles = StyleSheet.create({
  list: { paddingHorizontal: LAYOUT.pageMargin },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    gap: 10,
  },
  indicator: { width: 4, height: 36, borderRadius: 2, flexShrink: 0 },
  content: { flex: 1 },
  title: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  meta: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  levelBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  levelText: { fontSize: 10, fontWeight: '800' },
});

// ─── Worker Positioning ────────────────────────────────────────────────────────
const WORKERS_MOCK = [
  { id: 'w1', name: '张志刚', role: '采矿主管', zone: '1号采场', status: 'active' },
  { id: 'w2', name: '李晓峰', role: '安全员', zone: '选矿厂', status: 'active' },
  { id: 'w3', name: '王建国', role: '设备维护', zone: '破碎车间', status: 'standby' },
  { id: 'w4', name: '陈永强', role: '调度员', zone: '指挥中心', status: 'active' },
];
const WORKER_STATUS_COLOR: Record<string, string> = {
  active:  '#34d399',
  standby: '#94a3b8',
  off:     C.error,
};

function WorkerPositioning() {
  return (
    <View style={wpStyles.list}>
      {WORKERS_MOCK.map((w) => (
        <View key={w.id} style={wpStyles.item}>
          <View style={wpStyles.avatar}>
            <Text style={wpStyles.avatarText}>{w.name[0]}</Text>
            <View style={[wpStyles.avatarDot, {backgroundColor: WORKER_STATUS_COLOR[w.status]}]} />
          </View>
          <View style={wpStyles.info}>
            <Text style={wpStyles.name}>{w.name}</Text>
            <Text style={wpStyles.role}>{w.role}</Text>
          </View>
          <View style={wpStyles.zone}>
            <Text style={wpStyles.zoneText}>{w.zone}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const wpStyles = StyleSheet.create({
  list: { paddingHorizontal: LAYOUT.pageMargin },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.bgElevated,
    borderWidth: 2,
    borderColor: C.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarText: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  avatarDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.bgCard,
  },
  info: { flex: 1 },
  name: { color: C.textPrimary, fontSize: 13, fontWeight: '800' },
  role: { color: C.textMuted, fontSize: 11, marginTop: 1 },
  zone: {
    backgroundColor: 'rgba(77,255,136,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(77,255,136,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  zoneText: { color: C.primary, fontSize: 10, fontWeight: '700' },
});

// ─── Production Hero Stats ────────────────────────────────────────────────────
function ProductionHero({data}: {data: ProductionData}) {
  return (
    <View style={phStyles.row}>
      <View style={phStyles.bigStat}>
        <Text style={phStyles.bigValue}>{data.today.output.toLocaleString()}</Text>
        <Text style={phStyles.bigUnit}>吨</Text>
        <Text style={phStyles.bigLabel}>今日产量</Text>
      </View>
      <View style={phStyles.divider} />
      <View style={phStyles.stat}>
        <Text style={[phStyles.value, {color: '#34d399'}]}>{data.today.recovery}%</Text>
        <Text style={phStyles.label}>回收率</Text>
      </View>
      <View style={phStyles.stat}>
        <Text style={[phStyles.value, {color: C.primary}]}>{data.today.oee}%</Text>
        <Text style={phStyles.label}>OEE</Text>
      </View>
      <View style={phStyles.divider} />
      <View style={phStyles.stat}>
        <Text style={[phStyles.value, {color: C.warning}]}>{data.today.safetyDays}</Text>
        <Text style={phStyles.label}>安全天</Text>
      </View>
    </View>
  );
}

const phStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: LAYOUT.pageMargin,
    backgroundColor: C.bgCard,
    borderRadius: LAYOUT.cardRadius,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 16,
    marginBottom: 4,
  },
  bigStat: { flex: 1.2, alignItems: 'center' },
  bigValue: { color: C.textPrimary, fontSize: 32, fontWeight: '900', lineHeight: 36 },
  bigUnit: { color: C.primary, fontSize: 12, fontWeight: '700', marginTop: -2 },
  bigLabel: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  divider: { width: 1, height: 40, backgroundColor: C.borderSubtle, marginHorizontal: 12 },
  stat: { flex: 1, alignItems: 'center' },
  value: { fontSize: 18, fontWeight: '900' },
  label: { color: C.textMuted, fontSize: 11, marginTop: 3 },
});

// ─── Dashboard Screen ──────────────────────────────────────────────────────────
// ─── Video Surveillance Row ───────────────────────────────────────────────────
const SCENE_EMOJI: Record<string, string> = {
  shaft: '⛏️',
  plant: '🏭',
  dam:   '💧',
  road:  '🛤️',
  default: '📹',
};

function VideoSurveillanceRow({cameras, onPress}: {cameras: Camera[]; onPress: () => void}) {
  const online = cameras.filter(c => c.status === 'online').length;
  const total = cameras.length;
  const preview = cameras.slice(0, 4);

  return (
    <View style={vsStyles.section}>
      <View style={vsStyles.header}>
        <View>
          <Text style={vsStyles.title}>视频监控</Text>
          <Text style={vsStyles.subtitle}>{online}/{total} 在线</Text>
        </View>
        <TouchableOpacity style={vsStyles.allBtn} onPress={onPress} activeOpacity={0.7}>
          <Text style={vsStyles.allBtnText}>全部 →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={vsStyles.scrollContent}
      >
        {preview.map(cam => (
          <View
            key={cam.id}
            style={[vsStyles.card, cam.status === 'offline' && vsStyles.cardOffline]}
          >
            <View style={vsStyles.preview}>
              <Text style={vsStyles.emoji}>
                {SCENE_EMOJI[cam.scene] ?? SCENE_EMOJI.default}
              </Text>
              <View style={[
                vsStyles.dot,
                {backgroundColor: cam.status === 'online' ? '#34d399' : C.error},
              ]} />
            </View>
            <Text style={vsStyles.name} numberOfLines={1}>{cam.name}</Text>
            <Text style={vsStyles.location} numberOfLines={1}>{cam.location}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const vsStyles = StyleSheet.create({
  section: {
    marginBottom: 6,
    paddingTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.pageMargin,
    marginBottom: 10,
  },
  title: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  subtitle: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  allBtn: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  allBtnText: { color: C.primary, fontSize: 11, fontWeight: '700' },
  scrollContent: { paddingHorizontal: LAYOUT.pageMargin, gap: 10 },
  card: {
    width: 88,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: LAYOUT.cardRadius,
    padding: 10,
    alignItems: 'center',
  },
  cardOffline: { opacity: 0.5 },
  preview: { position: 'relative', marginBottom: 6 },
  emoji: { fontSize: 28 },
  dot: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.bgCard,
  },
  name: { color: C.textPrimary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  location: { color: C.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center' },
});

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [production, setProduction] = useState<ProductionData | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [p, e, a, c] = await Promise.all([
      SmartMineService.getProduction(),
      SmartMineService.getEquipment(),
      SmartMineService.getAlerts(),
      SmartMineService.getCameras(),
    ]);
    setProduction(p);
    setEquipment(e);
    setAlerts(a);
    setCameras(c);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <View style={styles.root}>
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        <View style={styles.pageTitle}>
          <Text style={styles.pageTitleText}>智慧矿山管控平台</Text>
          <LiveDot />
        </View>

        <TwinPreviewCard onPress={() => navigation.navigate('SmartMine')} />
        {cameras.length > 0 && (
          <VideoSurveillanceRow cameras={cameras} onPress={() => navigation.navigate('SmartMine')} />
        )}




        {production && <ProductionHero data={production} />}

        <SectionTitle title="设备状态" />
        <EquipmentRow equipment={equipment} />

        <SectionTitle title="实时告警" />
        <AlertRow alerts={alerts} />

        <SectionTitle title="人员定位" />
        <WorkerPositioning />

        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgRoot },
  scroll: { flexGrow: 1, paddingBottom: 0 },
  pageTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.pageMargin,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pageTitleText: { color: C.textPrimary, fontSize: 22, fontWeight: '900' },
});
