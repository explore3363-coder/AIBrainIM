/**
 * TaskScreen — OA 消息列表
 * 原智能矿山任务看板已迁移至 OA 消息流
 * 各部门 / 工作人员 / 企业 OA 系统内容统一展示
 */
import React, {useCallback, useState} from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C, LAYOUT} from '../data/constants';

// ─── Mock OA Messages ─────────────────────────────────────────────────────────
type OAMessageType = 'approval' | 'report' | 'notification' | 'finance' | 'safety';

interface OAMessage {
  id: string;
  type: OAMessageType;
  title: string;
  sender: string;
  senderDept: string;
  summary: string;
  time: string;
  urgent: boolean;
  read: boolean;
}

const OA_MOCK: OAMessage[] = [
  {
    id: 'oa-01',
    type: 'approval',
    title: '2026年6月采矿计划审批',
    sender: '生产部 · 王建国',
    senderDept: '生产部',
    summary: '6月份采矿量计划12000吨，请领导审批。附：设备维护计划和人员排班表。',
    time: '09:32',
    urgent: true,
    read: false,
  },
  {
    id: 'oa-02',
    type: 'safety',
    title: '3# 球磨机轴承温度异常 — 安全预警',
    sender: '安全部 · 李晓峰',
    senderDept: '安全部',
    summary: '实时监测显示3#球磨机轴承温度持续偏高，已触发二级告警。请及时处理。',
    time: '14:23',
    urgent: true,
    read: false,
  },
  {
    id: 'oa-03',
    type: 'finance',
    title: '5月份财务报表已生成',
    sender: '财务部 · 赵雅琴',
    senderDept: '财务部',
    summary: '5月份生产成本、收入、利润汇总报表已完成，请各部门负责人查阅核对。',
    time: '11:05',
    urgent: false,
    read: false,
  },
  {
    id: 'oa-04',
    type: 'report',
    title: '选矿厂周报（6.1-6.7）',
    sender: '选矿车间 · 张志刚',
    senderDept: '选矿车间',
    summary: '本周处理矿石量8732吨，铜回收率86.3%，略高于目标值85.5%。下周重点关注尾矿库水位。',
    time: '昨日',
    urgent: false,
    read: true,
  },
  {
    id: 'oa-05',
    type: 'notification',
    title: '关于开展2026年度职业健康体检的通知',
    sender: '人力资源部',
    senderDept: '人力资源部',
    summary: '公司将于6月15-20日组织全体员工职业健康体检，请各部门统计参检人员名单并于6月10日前上报。',
    time: '昨日',
    urgent: false,
    read: true,
  },
  {
    id: 'oa-06',
    type: 'approval',
    title: '新购破碎机设备采购申请',
    sender: '设备部 · 陈永强',
    senderDept: '设备部',
    summary: '现有1#破碎机使用年限已超过10年，申请采购新型颚式破碎机一台，预算约85万元。',
    time: '前日',
    urgent: false,
    read: true,
  },
  {
    id: 'oa-07',
    type: 'safety',
    title: '尾矿库在线监测系统维护通知',
    sender: '安全部 · 李晓峰',
    senderDept: '安全部',
    summary: '尾矿库在线监测系统将于6月10日进行例行维护，维护期间人工巡检频次调整为每4小时一次。',
    time: '前日',
    urgent: false,
    read: true,
  },
];

const TYPE_META: Record<OAMessageType, {label: string; icon: string; color: string}> = {
  approval:    { label: '审批', icon: '📝', color: '#B366FF' },
  report:      { label: '报告', icon: '📊', color: C.primary },
  notification:{ label: '通知', icon: '📢', color: '#00BFFF' },
  finance:     { label: '财务', icon: '💰', color: C.warning },
  safety:      { label: '安全', icon: '⚠️', color: C.error },
};

// ─── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  const [tab, setTab] = useState<'all' | 'urgent'>('all');
  return (
    <View style={topStyles.bar}>
      <Text style={topStyles.title}>OA 消息</Text>
      <View style={topStyles.tabs}>
        <TouchableOpacity
          style={[topStyles.tab, tab === 'all' && topStyles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[topStyles.tabText, tab === 'all' && topStyles.tabTextActive]}>全部</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[topStyles.tab, tab === 'urgent' && topStyles.tabActive]}
          onPress={() => setTab('urgent')}
        >
          <Text style={[topStyles.tabText, tab === 'urgent' && topStyles.tabTextActive]}>紧急</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const topStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.pageMargin,
    paddingVertical: 14,
    backgroundColor: C.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  title: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: C.primary,
  },
  tabText: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: C.bgRoot,
  },
});

// ─── Message Card ──────────────────────────────────────────────────────────────
function OAMessageCard({msg}: {msg: OAMessage}) {
  const meta = TYPE_META[msg.type];
  return (
    <View style={[cardStyles.card, !msg.read && cardStyles.cardUnread]}>
      {/* Left accent */}
      <View style={[cardStyles.accent, {backgroundColor: meta.color}]} />
      {/* Content */}
      <View style={cardStyles.body}>
        <View style={cardStyles.topRow}>
          <View style={cardStyles.typeBadge}>
            <Text style={cardStyles.typeIcon}>{meta.icon}</Text>
            <Text style={[cardStyles.typeLabel, {color: meta.color}]}>{meta.label}</Text>
          </View>
          <Text style={cardStyles.time}>{msg.time}</Text>
        </View>
        <Text style={[cardStyles.title, !msg.read && cardStyles.titleUnread]} numberOfLines={2}>
          {msg.urgent && <Text style={cardStyles.urgentDot}>● </Text>}{msg.title}
        </Text>
        <Text style={cardStyles.summary} numberOfLines={2}>{msg.summary}</Text>
        <View style={cardStyles.footer}>
          <Text style={cardStyles.sender}>{msg.sender}</Text>
          {!msg.read && <View style={cardStyles.unreadDot} />}
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    marginHorizontal: LAYOUT.pageMargin,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: 'rgba(77,255,136,0.2)',
    backgroundColor: 'rgba(77,255,136,0.03)',
  },
  accent: {
    width: 4,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeIcon: { fontSize: 11 },
  typeLabel: { fontSize: 11, fontWeight: '800' },
  time: { color: C.textMuted, fontSize: 11 },
  title: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 5,
  },
  titleUnread: { color: C.textPrimary },
  summary: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sender: { color: C.textMuted, fontSize: 11 },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.primary,
  },
  urgentDot: { color: C.error, fontSize: 10 },
});

// ─── Task Screen ───────────────────────────────────────────────────────────────
export function TaskScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'all' | 'urgent'>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(() => resolve(undefined), 800));
    setRefreshing(false);
  }, []);

  const filtered = tab === 'urgent' ? OA_MOCK.filter(m => m.urgent) : OA_MOCK;
  const unreadCount = OA_MOCK.filter(m => !m.read).length;

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
        {/* Unread summary */}
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>
            {unreadCount > 0 ? `${unreadCount} 条未读消息` : '全部已读'}
          </Text>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'all' && styles.tabBtnActive]}
              onPress={() => setTab('all')}
            >
              <Text style={[styles.tabBtnText, tab === 'all' && styles.tabBtnTextActive]}>全部</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'urgent' && styles.tabBtnActive]}
              onPress={() => setTab('urgent')}
            >
              <Text style={[styles.tabBtnText, tab === 'urgent' && styles.tabBtnTextActive]}>紧急</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Message list */}
        {filtered.map(msg => (
          <OAMessageCard key={msg.id} msg={msg} />
        ))}

        {/* Dept sections */}
        <View style={styles.deptSection}>
          <Text style={styles.deptSectionTitle}>按部门筛选</Text>
          <View style={styles.deptGrid}>
            {['生产部', '安全部', '财务部', '设备部', '人力资源部', '选矿车间'].map(dept => (
              <TouchableOpacity key={dept} style={styles.deptChip}>
                <Text style={styles.deptChipText}>{dept}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgRoot },
  scroll: { flexGrow: 1 },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.pageMargin,
    paddingVertical: 12,
  },
  unreadText: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  tabsRow: { flexDirection: 'row', gap: 6 },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  tabBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabBtnText: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  tabBtnTextActive: { color: C.bgRoot },
  deptSection: { paddingHorizontal: LAYOUT.pageMargin, paddingTop: 18 },
  deptSectionTitle: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deptChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  deptChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
});
