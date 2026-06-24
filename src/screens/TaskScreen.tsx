/**
 * TaskScreen — OA 审批列表
 * 企业 OA 审批流：审批、报告、通知、财务、安全
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

// ─── OA Types ─────────────────────────────────────────────────────────────────
type OAType = 'approval' | 'report' | 'notification' | 'finance' | 'safety';

interface OAMessage {
  id: string;
  type: OAType;
  title: string;
  sender: string;
  senderDept: string;
  summary: string;
  time: string;
  urgent: boolean;
  read: boolean;
  /** 审批专用字段 */
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvalDept?: string;
}

const OA_MOCK: OAMessage[] = [
  {
    id: 'oa-01',
    type: 'approval',
    title: '2026年6月采矿计划审批',
    sender: '王建国',
    senderDept: '生产部',
    summary: '6月份采矿量计划12000吨，请领导审批。附：设备维护计划和人员排班表。',
    time: '09:32',
    urgent: true,
    read: false,
    approvalStatus: 'pending',
  },
  {
    id: 'oa-02',
    type: 'safety',
    title: '3# 球磨机轴承温度异常 — 安全预警',
    sender: '李晓峰',
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
    sender: '赵雅琴',
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
    sender: '张志刚',
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
    sender: '陈永强',
    senderDept: '设备部',
    summary: '现有1#破碎机使用年限已超过10年，申请采购新型颚式破碎机一台，预算约85万元。',
    time: '前日',
    urgent: false,
    read: true,
    approvalStatus: 'pending',
  },
  {
    id: 'oa-07',
    type: 'safety',
    title: '尾矿库在线监测系统维护通知',
    sender: '李晓峰',
    senderDept: '安全部',
    summary: '尾矿库在线监测系统将于6月10日进行例行维护，维护期间人工巡检频次调整为每4小时一次。',
    time: '前日',
    urgent: false,
    read: true,
  },
  {
    id: 'oa-08',
    type: 'approval',
    title: '井下通风系统改造方案审批',
    sender: '刘建明',
    senderDept: '生产部',
    summary: '拟对南矿区通风系统进行改造，更换主风机3台，预算320万元，工期45天。',
    time: '前日',
    urgent: true,
    read: false,
    approvalStatus: 'pending',
  },
];

const TYPE_META: Record<OAType, {icon: string; color: string}> = {
  approval:    { icon: '📋', color: '#B366FF' },
  report:      { icon: '📊', color: C.primary },
  notification:{ icon: '🔔', color: '#00BFFF' },
  finance:     { icon: '💰', color: '#FAD06B' },
  safety:      { icon: '⚠️', color: '#FF6B6B' },
};

type ApprovalTab = 'mine' | 'initiated' | 'all';

const TAB_LABELS: Record<ApprovalTab, string> = {
  mine: '我的待办',
  initiated: '我发起的',
  all: '全部',
};

// ─── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({activeTab, onTabChange, counts}: {
  activeTab: ApprovalTab;
  onTabChange: (t: ApprovalTab) => void;
  counts: Record<ApprovalTab, number>;
}) {
  return (
    <View style={topStyles.bar}>
      <Text style={topStyles.title}>OA 消息</Text>
      <View style={topStyles.tabs}>
        {(['mine', 'initiated', 'all'] as ApprovalTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[topStyles.tab, activeTab === tab && topStyles.tabActive]}
            onPress={() => onTabChange(tab)}
          >
            <Text style={[topStyles.tabText, activeTab === tab && topStyles.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
            {counts[tab] > 0 && (
              <View style={[topStyles.tabBadge, activeTab === tab && topStyles.tabBadgeActive]}>
                <Text style={[topStyles.tabBadgeText, activeTab === tab && topStyles.tabBadgeTextActive]}>
                  {counts[tab]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const topStyles = StyleSheet.create({
  bar: {
    paddingHorizontal: LAYOUT.pageMargin,
    paddingVertical: 14,
    backgroundColor: C.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  title: {
    color: C.textTitle,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    gap: 5,
  },
  tabActive: {
    backgroundColor: C.primary,
  },
  tabText: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: C.bgRoot,
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  tabBadgeText: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  tabBadgeTextActive: {
    color: C.bgRoot,
  },
});

// ─── Approval Card ──────────────────────────────────────────────────────────────
function OACard({msg}: {msg: OAMessage}) {
  const meta = TYPE_META[msg.type];
  return (
    <TouchableOpacity style={cardStyles.card} activeOpacity={0.75}>
      {/* Left type icon */}
      <View style={[cardStyles.typeIconWrap, {backgroundColor: meta.color + '18', borderColor: meta.color + '40'}]}>
        <Text style={cardStyles.typeIcon}>{meta.icon}</Text>
      </View>

      {/* Main content */}
      <View style={cardStyles.body}>
        <View style={cardStyles.topRow}>
          <View style={cardStyles.titleRow}>
            {msg.urgent && (
              <View style={cardStyles.urgentBadge}>
                <Text style={cardStyles.urgentBadgeText}>紧急</Text>
              </View>
            )}
            {msg.approvalStatus && (
              <View style={[
                cardStyles.approvalBadge,
                msg.approvalStatus === 'pending' && {backgroundColor: '#FAD06B20', borderColor: '#FAD06B50'},
                msg.approvalStatus === 'approved' && {backgroundColor: C.primary + '20', borderColor: C.primary + '50'},
                msg.approvalStatus === 'rejected' && {backgroundColor: '#FF6B6B20', borderColor: '#FF6B6B50'},
              ]}>
                <Text style={[
                  cardStyles.approvalBadgeText,
                  msg.approvalStatus === 'pending' && {color: '#FAD06B'},
                  msg.approvalStatus === 'approved' && {color: C.primary},
                  msg.approvalStatus === 'rejected' && {color: '#FF6B6B'},
                ]}>
                  {msg.approvalStatus === 'pending' ? '待审批' : msg.approvalStatus === 'approved' ? '已通过' : '已驳回'}
                </Text>
              </View>
            )}
          </View>
          <Text style={cardStyles.time}>{msg.time}</Text>
        </View>

        <Text style={[cardStyles.title, !msg.read && cardStyles.titleUnread]} numberOfLines={2}>
          {msg.title}
        </Text>

        <Text style={cardStyles.summary} numberOfLines={2}>{msg.summary}</Text>

        <View style={cardStyles.footer}>
          <View style={cardStyles.senderRow}>
            <Text style={cardStyles.senderDept}>{msg.senderDept}</Text>
            <Text style={cardStyles.senderSep}> · </Text>
            <Text style={cardStyles.senderName}>{msg.sender}</Text>
          </View>
          {!msg.read && <View style={cardStyles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
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
    padding: 14,
    gap: 12,
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeIcon: { fontSize: 20 },
  body: { flex: 1, gap: 5 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  urgentBadge: {
    backgroundColor: '#FF6B6B20',
    borderWidth: 1,
    borderColor: '#FF6B6B50',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  urgentBadgeText: { color: '#FF6B6B', fontSize: 10, fontWeight: '800' },
  approvalBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  approvalBadgeText: { fontSize: 10, fontWeight: '800' },
  time: { color: C.textMuted, fontSize: 12, flexShrink: 0 },
  title: {
    color: C.textBody,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  titleUnread: { color: C.textTitle },
  summary: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  senderRow: { flexDirection: 'row', alignItems: 'center' },
  senderDept: { color: C.primary, fontSize: 12, fontWeight: '700' },
  senderSep: { color: C.textMuted, fontSize: 11 },
  senderName: { color: C.textMuted, fontSize: 11 },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.primary,
  },
});

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({title, count}: {title: string; count?: number}) {
  return (
    <View style={secStyles.wrap}>
      <Text style={secStyles.eyebrow}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={secStyles.countBadge}>
          <Text style={secStyles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: LAYOUT.pageMargin,
    marginTop: 20,
    marginBottom: 12,
  },
  eyebrow: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  countBadge: {
    backgroundColor: C.primaryGlow,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  countText: { color: C.primary, fontSize: 11, fontWeight: '800' },
});

// ─── Dept Filter Chips ─────────────────────────────────────────────────────────
const ALL_DEPTS = ['生产部', '安全部', '财务部', '设备部', '人力资源部', '选矿车间'];

function DeptFilter({selected, onChange}: {selected: string[]; onChange: (d: string[]) => void}) {
  const toggle = (dept: string) => {
    if (selected.includes(dept)) {
      onChange(selected.filter(d => d !== dept));
    } else {
      onChange([...selected, dept]);
    }
  };
  return (
    <View style={deptStyles.wrap}>
      {ALL_DEPTS.map(dept => {
        const active = selected.includes(dept);
        return (
          <TouchableOpacity
            key={dept}
            style={[deptStyles.chip, active && deptStyles.chipActive]}
            onPress={() => toggle(dept)}
            activeOpacity={0.7}
          >
            <Text style={[deptStyles.chipText, active && deptStyles.chipTextActive]}>{dept}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const deptStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: LAYOUT.pageMargin,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  chipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  chipText: { color: C.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: C.bgRoot },
});

// ─── Task Screen ───────────────────────────────────────────────────────────────
export function TaskScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ApprovalTab>('mine');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(() => resolve(undefined), 800));
    setRefreshing(false);
  }, []);

  // Compute counts for tab badges
  const pendingCount = OA_MOCK.filter(m => !m.read).length;
  const initiatedCount = OA_MOCK.filter(m => m.type === 'approval' && m.approvalStatus === 'pending').length;

  const tabCounts: Record<ApprovalTab, number> = {
    mine: pendingCount,
    initiated: initiatedCount,
    all: OA_MOCK.length,
  };

  // Filter logic
  let filtered = [...OA_MOCK];
  if (activeTab === 'mine') {
    filtered = filtered.filter(m => !m.read);
  } else if (activeTab === 'initiated') {
    filtered = filtered.filter(m => m.type === 'approval');
  }
  if (selectedDepts.length > 0) {
    filtered = filtered.filter(m => selectedDepts.includes(m.senderDept));
  }

  const urgentMsgs = OA_MOCK.filter(m => m.urgent && !m.read);

  return (
    <View style={styles.root}>
      <TopBar activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        {/* Urgent banner — only show when on 'mine' tab */}
        {activeTab === 'mine' && urgentMsgs.length > 0 && (
          <View style={styles.urgentBanner}>
            <Text style={styles.urgentBannerIcon}>⚠️</Text>
            <View style={styles.urgentBannerText}>
              <Text style={styles.urgentBannerTitle}>您有 {urgentMsgs.length} 条紧急消息</Text>
              <Text style={styles.urgentBannerSub}>请尽快处理</Text>
            </View>
            <View style={styles.urgentBannerBadge}>
              <Text style={styles.urgentBannerBadgeText}>{urgentMsgs.length}</Text>
            </View>
          </View>
        )}

        {/* Dept filter */}
        <SectionHeader title="按部门筛选" />
        <DeptFilter selected={selectedDepts} onChange={setSelectedDepts} />

        {/* Message list */}
        <SectionHeader title="消息列表" count={filtered.length} />
        {filtered.length > 0 ? filtered.map(msg => (
          <OACard key={msg.id} msg={msg} />
        )) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无消息</Text>
          </View>
        )}

        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgRoot },
  scroll: { flexGrow: 1, paddingBottom: 20 },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: LAYOUT.pageMargin,
    marginTop: 14,
    marginBottom: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FF6B6B15',
    borderWidth: 1,
    borderColor: '#FF6B6B40',
    gap: 12,
  },
  urgentBannerIcon: { fontSize: 26 },
  urgentBannerText: { flex: 1 },
  urgentBannerTitle: { color: C.textTitle, fontSize: 15, fontWeight: '800' },
  urgentBannerSub: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  urgentBannerBadge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 999,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentBannerBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: { color: C.textMuted, fontSize: 14 },
});
