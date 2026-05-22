import React, {useCallback, useMemo} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity, Alert, Share,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import {DispatchTree, buildTreeFromTraces} from '../components/DispatchTree';
import type {CommandTrace} from '../types';
import type {RootStackParamList} from '../App';

const STATUS_META: Record<string, {label: string; accent: string; summary: string}> = {
  submitted:  {label: '已提交',   accent: '#fbbf24', summary: '等待助理拆解'},
  dispatched: {label: '执行中',   accent: C.primary,  summary: '已进入子 Agent 执行'},
  processing: {label: '处理中',   accent: C.working,  summary: '后台继续处理'},
  completed:  {label: '已完成',   accent: '#34d399',  summary: '结果已回流移动端'},
  failed:     {label: '执行失败', accent: C.highUrgency, summary: '需要回看调度链或重试'},
};

const STAGE_ICONS: Record<string, string> = {
  receive:   '📥',
  dispatch:  '⚙️',
  feedback:  '🔄',
  synthesis: '🧩',
  deliver:   '✅',
  deliver_failed: '❌',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

function StageTimelineItem({
  stage, title, actor, detail, index, total, timestamp, isActive, isComplete, isFailed,
}: {
  stage: string; title: string; actor: string; detail: string;
  index: number; total: number; timestamp?: string; isActive: boolean; isComplete: boolean; isFailed: boolean;
}) {
  const dotColor = isFailed ? C.error : isComplete ? C.success : isActive ? C.primary : C.textMuted;
  const icon = STAGE_ICONS[stage] ?? '📎';

  return (
    <View style={timelineStyles.row}>
      {/* timeline indicator */}
      <View style={timelineStyles.left}>
        <View style={[timelineStyles.dot, {backgroundColor: dotColor, borderColor: dotColor}]}>
          <Text style={timelineStyles.dotIcon}>{icon}</Text>
        </View>
        {index < total - 1 && <View style={[timelineStyles.line, isComplete && timelineStyles.lineComplete]} />}
      </View>

      {/* card */}
      <View style={[timelineStyles.card, isActive && timelineStyles.cardActive]}>
        <View style={timelineStyles.cardHeader}>
          <Text style={timelineStyles.cardTitle}>{title}</Text>
          {isActive && <View style={[timelineStyles.activeBadge]}><Text style={timelineStyles.activeBadgeText}>进行中</Text></View>}
        </View>
        <Text style={timelineStyles.cardActor}>{actor}</Text>
        <Text style={timelineStyles.cardDetail}>{detail}</Text>
        {timestamp ? <Text style={timelineStyles.cardTime}>⏱ {timestamp}</Text> : null}
      </View>
    </View>
  );
}

export function DispatchChainDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DispatchChainDetail'>>();
  const dispatchId = route.params?.dispatchId;
  const {dispatches} = useAppContext();

  const record = useMemo(() => {
    if (!dispatchId) return dispatches[0] ?? null;
    return dispatches.find(d => d.dispatchId === dispatchId) ?? null;
  }, [dispatchId, dispatches]);

  const meta = record ? STATUS_META[record.status] : null;

  const traces: CommandTrace[] = useMemo(() => {
    if (!record) return [];
    const statusLabel = meta?.summary ?? '';
    return [
      {stage:'receive',   title:'接收指令',   actor:'你 → 助理',    detail: record.userText},
      {stage:'dispatch',  title:'生成调度单', actor:'助理 / Gateway', detail: `taskId=${record.taskId ?? '未生成'} · dispatchId=${record.dispatchId ?? '未生成'}`},
      {stage:'feedback',  title:'状态回流',   actor:'移动端',        detail: record.reply},
      {stage:'synthesis', title:'当前状态',   actor:'调度链',        detail: `${statusLabel}${record.sessionKey ? ` · session=${record.sessionKey}` : ''}${record.agentId ? ` · agent=${record.agentId}` : ''}`},
      {stage:'deliver',   title:'结果交付',   actor:'APP',          detail: record.status === 'completed' ? '该调度单已完成，并已同步到任务流、调度链与首页 AI 产出流。' : record.status === 'failed' ? '该调度单执行失败，已保留现场记录，建议查看链路后重试。' : '该调度单已同步到任务流、调度链与首页 AI 产出流，可继续追踪后续状态。'},
    ];
  }, [record, meta]);

  const tree = useMemo(() => buildTreeFromTraces(traces), [traces]);

  const handleCopyId = useCallback(() => {
    if (!record?.dispatchId) return;
    Share.share({message: `dispatchId: ${record.dispatchId}`}).catch(() => {
      Alert.alert('复制失败', '无法复制到剪贴板');
    });
  }, [record]);

  const handleRetry = useCallback(() => {
    Alert.alert('重试', `对 dispatchId=${record?.dispatchId ?? '未知'} 发起重试（实际重试逻辑待接入）`);
  }, [record]);

  const handleAbort = useCallback(() => {
    Alert.alert(
      '确认放弃',
      `确定要放弃 dispatchId=${record?.dispatchId ?? '未知'} 吗？`,
      [
        {text: '取消', style: 'cancel'},
        {text: '放弃', style: 'destructive', onPress: () => navigation.goBack()},
      ],
    );
  }, [record, navigation]);

  if (!record) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>未找到该调度单</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>返回调度链</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStageIndex = traces.findIndex(t => t.stage === 'synthesis');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Header card ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.headerEyebrow}>调度详情</Text>
            {meta ? (
              <View style={[styles.statusBadge, {borderColor: meta.accent, backgroundColor: `${meta.accent}22`}]}>
                <Text style={[styles.statusBadgeText, {color: meta.accent}]}>{meta.label}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.idRow}>
            <Text style={styles.idLabel}>dispatchId</Text>
            <Text style={styles.idValue} numberOfLines={1}>{record.dispatchId ?? '-'}</Text>
          </View>
          <View style={styles.idRow}>
            <Text style={styles.idLabel}>taskId</Text>
            <Text style={styles.idValue} numberOfLines={1}>{record.taskId ?? '-'}</Text>
          </View>
          {record.sessionKey && (
            <View style={styles.idRow}>
              <Text style={styles.idLabel}>session</Text>
              <Text style={styles.idValue} numberOfLines={1}>{record.sessionKey}</Text>
            </View>
          )}
          {record.agentId && (
            <View style={styles.idRow}>
              <Text style={styles.idLabel}>agent</Text>
              <Text style={styles.idValue} numberOfLines={1}>{record.agentId}</Text>
            </View>
          )}
          <View style={styles.idRow}>
            <Text style={styles.idLabel}>createdAt</Text>
            <Text style={styles.idValue}>{formatTime(record.createdAt)}</Text>
          </View>
          {record.updatedAt && (
            <View style={styles.idRow}>
              <Text style={styles.idLabel}>updatedAt</Text>
              <Text style={styles.idValue}>{formatTime(record.updatedAt)}</Text>
            </View>
          )}
          {record.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>错误信息</Text>
              <Text style={styles.errorText}>{record.error}</Text>
            </View>
          )}
        </View>

        {/* ── 5-stage timeline ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 阶段时间线</Text>
          <View style={timelineStyles.wrap}>
            {traces.map((t, i) => (
              <StageTimelineItem
                key={t.stage}
                stage={t.stage}
                title={t.title}
                actor={t.actor}
                detail={t.detail}
                index={i}
                total={traces.length}
                timestamp={record.createdAt ? formatTime(record.createdAt + i * 1000) : undefined}
                isActive={(record.status as string) !== 'completed' && (record.status as string) !== 'failed' && i === traces.length - 1}
                isComplete={(record.status as string) === 'completed' || ((record.status as string) !== 'completed' && (record.status as string) !== 'failed' && i < traces.length - 1)}
                isFailed={record.status === 'failed'}
              />
            ))}
          </View>
        </View>

        {/* ── Task DAG tree ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌲 子任务 DAG</Text>
          <View style={styles.dagCard}>
            <DispatchTree root={tree} initialExpanded={true} />
          </View>
        </View>

        {/* ── Original instruction ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 原始用户指令</Text>
          <View style={styles.rawCard}>
            <Text style={styles.rawText}>{record.userText}</Text>
          </View>
        </View>

        {/* ── Agent reply ── */}
        {record.reply ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🤖 助理回复摘要</Text>
            <View style={styles.rawCard}>
              <Text style={styles.rawText}>{record.reply}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Action buttons ── */}
        {record.status === 'failed' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.retryBtn]} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>🔄 重试</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.abortBtn]} onPress={handleAbort} activeOpacity={0.8}>
              <Text style={styles.abortBtnText}>🗑 放弃</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.copyBtn]} onPress={handleCopyId} activeOpacity={0.8}>
            <Text style={styles.copyBtnText}>📋 复制调度 ID</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:      {flex: 1, backgroundColor: C.bgRoot},
  content:   {padding: 16, paddingBottom: 100},
  headerCard: {
    padding: 16, borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1, borderColor: C.borderSubtle,
    marginBottom: 16,
    gap: 6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerEyebrow: {color: C.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1},
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  statusBadgeText: {fontSize: 11, fontWeight: '900'},
  idRow:    {flexDirection: 'row', gap: 8, alignItems: 'flex-start'},
  idLabel:  {color: C.textMuted, fontSize: 12, fontWeight: '700', minWidth: 72},
  idValue:  {color: C.textBody, fontSize: 12, flex: 1},
  errorBox: {
    marginTop: 8, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,59,59,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,59,59,0.25)',
  },
  errorLabel: {color: C.error, fontSize: 11, fontWeight: '900', marginBottom: 4},
  errorText:  {color: C.error, fontSize: 12, lineHeight: 18},
  section:   {marginBottom: 16},
  sectionTitle: {color: C.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 10},
  dagCard: {
    padding: 14, borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  rawCard: {
    padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  rawText: {color: C.textBody, fontSize: 13, lineHeight: 20},
  actionRow: {flexDirection: 'row', gap: 10, marginBottom: 10},
  actionBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  retryBtn:  {backgroundColor: C.primary},
  retryBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
  abortBtn:  {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: C.error,
  },
  abortBtnText: {color: C.error, fontWeight: '900', fontSize: 14},
  copyBtn: {
    backgroundColor: 'rgba(77,255,136,0.10)',
    borderWidth: 1, borderColor: 'rgba(77,255,136,0.25)',
  },
  copyBtnText: {color: C.primary, fontWeight: '800', fontSize: 13},
  emptyState: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 16},
  emptyIcon:  {fontSize: 48},
  emptyTitle: {color: C.textTitle, fontSize: 18, fontWeight: '900'},
  backBtn: {
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 999, backgroundColor: C.primary,
  },
  backBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
});

const timelineStyles = StyleSheet.create({
  wrap: {paddingVertical: 4, paddingHorizontal: 4},
  row:   {flexDirection: 'row', marginBottom: 0},
  left:  {width: 44, alignItems: 'center'},
  dot: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1,
  },
  dotIcon: {fontSize: 14},
  line: {
    width: 2, flex: 1, minHeight: 20,
    backgroundColor: C.borderSubtle,
    marginVertical: 2,
  },
  lineComplete: {backgroundColor: C.success},
  card: {
    flex: 1, marginBottom: 12, marginLeft: 8, padding: 13, borderRadius: 16,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  cardActive: {
    borderColor: C.primary,
    backgroundColor: 'rgba(77,255,136,0.04)',
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4},
  cardTitle: {color: C.textTitle, fontWeight: '900', fontSize: 15},
  activeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(77,255,136,0.15)',
  },
  activeBadgeText: {color: C.primary, fontSize: 10, fontWeight: '900'},
  cardActor:  {color: C.accent, fontWeight: '800', fontSize: 11, marginBottom: 5},
  cardDetail: {color: C.textBody, fontSize: 13, lineHeight: 19},
  cardTime:   {color: C.textMuted, fontSize: 10, marginTop: 5, fontWeight: '600'},
});
