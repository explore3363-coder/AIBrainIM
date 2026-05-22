import React, {useCallback, useMemo} from 'react';
import {Text, View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import type {CommandTrace, DispatchRecord} from '../types';
import type {RootStackParamList} from '../App';

// User-friendly fallback when no dispatches exist yet - no developer noise
const EMPTY_TRACES: CommandTrace[] = [
  {stage:'receive',   title:'接收指令',  actor:'你 → 助理',             detail:'在「对话」中发送一条指令,助理会立即接收并开始调度。'},
  {stage:'dispatch',  title:'生成调度单', actor:'助理 / Gateway',        detail:'助理将你的指令拆解为任务,自动分派给对应的智能体执行。'},
  {stage:'feedback',  title:'状态回流',  actor:'移动端 / 智能体',        detail:'执行过程中的状态变化会实时回流到这里,无需频繁刷新页面。'},
  {stage:'synthesis', title:'结果交付', actor:'APP',                   detail:'执行完成后,结果自动同步到任务流、AI 产出流和首页闭环摘要。'},
];

const STATUS_META: Record<DispatchRecord['status'], {label: string; accent: string; summary: string}> = {
  submitted:  {label: '已提交',   accent: '#fbbf24', summary: '等待助理拆解'},
  dispatched: {label: '执行中',   accent: C.primary,  summary: '已进入子 Agent 执行'},
  processing: {label: '处理中',   accent: C.working,  summary: '后台继续处理'},
  completed:  {label: '已完成',   accent: '#34d399',  summary: '结果已回流移动端'},
  failed:     {label: '执行失败', accent: C.highUrgency, summary: '需要回看调度链或重试'},
};

export function DispatchChainScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Defensive: useRoute is a React Navigation hook that may not be available in test environments
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rawRoute = (typeof useRoute === 'function') ? useRoute() : null;
  const route = (rawRoute ?? {params: undefined}) as RouteProp<RootStackParamList, 'DispatchChain'> | {params?: RootStackParamList['DispatchChain']};
  const {dispatches, refreshing, refresh} = useAppContext();

  const onRefresh = useCallback(() => { refresh(); }, [refresh]);

  const focusDispatchId = route.params?.focusDispatchId;
  const focusTaskId = route.params?.focusTaskId;
  const focusSessionKey = route.params?.focusSessionKey;

  const rankedDispatches = useMemo(() => {
    if (!focusDispatchId && !focusTaskId && !focusSessionKey) {
      return dispatches;
    }

    const score = (item: DispatchRecord) => {
      if (focusDispatchId && item.dispatchId === focusDispatchId) return 0;
      if (focusTaskId && item.taskId === focusTaskId) return 1;
      if (focusSessionKey && item.sessionKey === focusSessionKey) return 2;
      return 9;
    };

    return [...dispatches].sort((a, b) => score(a) - score(b));
  }, [dispatches, focusDispatchId, focusSessionKey, focusTaskId]);

  const focusedDispatch = rankedDispatches[0];
  const focusedMeta = focusedDispatch ? STATUS_META[focusedDispatch.status] : null;

  const traces = useMemo<CommandTrace[]>(() => {
    if (!rankedDispatches.length) return EMPTY_TRACES;
    const focused = rankedDispatches[0];
    const statusLabel = STATUS_META[focused.status].summary;
    return [
      {stage:'receive',   title:'接收指令',   actor:'你 → 助理',    detail: focused.userText},
      {stage:'dispatch',  title:'生成调度单', actor:'助理 / Gateway', detail: `taskId=${focused.taskId ?? '未生成'} · dispatchId=${focused.dispatchId ?? '未生成'}`},
      {stage:'feedback',  title:'状态回流',   actor:'移动端',        detail: focused.reply},
      {stage:'synthesis', title:'当前状态',   actor:'调度链',        detail: `${statusLabel}${focused.sessionKey ? ` · session=${focused.sessionKey}` : ''}${focused.agentId ? ` · agent=${focused.agentId}` : ''}`},
      {stage:'deliver',   title:'结果交付',   actor:'APP',          detail: focused.status === 'completed' ? '该调度单已完成，并已同步到任务流、调度链与首页 AI 产出流。' : focused.status === 'failed' ? '该调度单执行失败，已保留现场记录，建议查看链路后重试。' : '该调度单已同步到任务流、调度链与首页 AI 产出流，可继续追踪后续状态。'},
    ];
  }, [rankedDispatches]);

  const stats = useMemo(() => ({
    total: dispatches.length,
    completed: dispatches.filter(item => item.status === 'completed').length,
    failed:    dispatches.filter(item => item.status === 'failed').length,
    active:    dispatches.filter(item => item.status === 'submitted' || item.status === 'dispatched' || item.status === 'processing').length,
  }), [dispatches]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🔗 调度链</Text>
        <Text style={styles.sub}>指令从接收到交付的完整流转</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        <View style={styles.overviewRow}>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>总调度</Text>
            <Text style={styles.overviewValue}>{stats.total}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>执行中</Text>
            <Text style={styles.overviewValue}>{stats.active}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>已完成</Text>
            <Text style={styles.overviewValue}>{stats.completed}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>失败</Text>
            <Text style={styles.overviewValue}>{stats.failed}</Text>
          </View>
        </View>

        {focusedDispatch ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>{focusDispatchId || focusTaskId || focusSessionKey ? '当前聚焦调度单' : '最新调度单'}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.summaryText}>taskId: {focusedDispatch.taskId ?? '未生成'}</Text>
              {focusedMeta ? (
                <View style={[styles.statusBadge, {borderColor: focusedMeta.accent, backgroundColor: `${focusedMeta.accent}22`}]}> 
                  <Text style={[styles.statusBadgeText, {color: focusedMeta.accent}]}>{focusedMeta.label}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.summaryText}>dispatchId: {focusedDispatch.dispatchId ?? '未生成'}</Text>
            <Text style={styles.summaryText}>status: {focusedDispatch.status}</Text>
            {focusedDispatch.agentId ? <Text style={styles.summaryText}>agent: {focusedDispatch.agentId}</Text> : null}
            {focusedDispatch.stageText ? <Text style={styles.summaryText}>stage: {focusedDispatch.stageText}</Text> : null}
            <Text style={styles.summaryHint}>{focusedMeta?.summary}</Text>
            {focusedDispatch.sessionKey ? <Text style={styles.summaryText}>session: {focusedDispatch.sessionKey}</Text> : null}
          </View>
        ) : null}

        <View style={styles.chainBox}>
          {traces.map((item, i) => (
            <View key={item.stage} style={styles.step}>
              <View style={styles.stepLeft}>
                <View style={[styles.dot, i === traces.length - 1 && styles.dotLast]} />
                {i < traces.length - 1 && <View style={styles.line} />}
              </View>
              <View style={styles.stepCard}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepActor}>{item.actor}</Text>
                <Text style={styles.stepDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {rankedDispatches.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔗</Text>
            <Text style={styles.emptyTitle}>调度链暂无记录</Text>
            <Text style={styles.emptyDesc}>
              在「对话」中发送一条指令,助理会接收并开始调度,状态实时回流到这里。
            </Text>
            <TouchableOpacity
              style={styles.emptyPrimaryBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Tabs', {screen: 'Chat'})}
            >
              <Text style={styles.emptyPrimaryBtnText}>去对话发送指令</Text>
            </TouchableOpacity>
          </View>
        )}

        {rankedDispatches.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>最近调度记录</Text>
            {rankedDispatches.slice(0, 6).map(item => {
              const meta = STATUS_META[item.status];
              return (
                <View key={item.id} style={[styles.historyCard, ((focusDispatchId && item.dispatchId === focusDispatchId) || (focusTaskId && item.taskId === focusTaskId) || (focusSessionKey && item.sessionKey === focusSessionKey)) && styles.focusCard]}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyText} numberOfLines={2}>{item.userText}</Text>
                    <View style={[styles.historyBadge, {borderColor: meta.accent, backgroundColor: `${meta.accent}22`}]}>
                      <Text style={[styles.historyBadgeText, {color: meta.accent}]}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyMeta}>taskId={item.taskId ?? '-'} · dispatchId={item.dispatchId ?? '-'}</Text>
                  <Text style={styles.historyMeta}>
                    status={item.status}{item.sessionKey ? ` · session=${item.sessionKey}` : ''}{item.agentId ? ` · agent=${item.agentId}` : ''}
                  </Text>
                  {item.stageText ? <Text style={styles.historyMeta}>stage={item.stageText}</Text> : null}
                  <Text style={styles.historyReply} numberOfLines={3}>{item.reply}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       {flex: 1, backgroundColor: C.bgRoot},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  content:    {padding: 16, paddingBottom: 100},
  overviewRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  overviewCard: {
    flex: 1,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  overviewLabel: {color: C.textMuted, fontSize: 10, fontWeight: '700'},
  overviewValue: {color: C.textTitle, fontSize: 18, fontWeight: '900', marginTop: 4},
  summaryCard: {
    marginBottom: 12, padding: 14, borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  summaryEyebrow: {color: C.accent, fontSize: 11, fontWeight: '900', marginBottom: 8, letterSpacing: 1},
  statusRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
  },
  statusBadgeText: {fontSize: 10, fontWeight: '900'},
  summaryText: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 2},
  summaryHint: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6},
  chainBox: {
    padding: 12, borderRadius: 24,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  step:       {flexDirection: 'row'},
  stepLeft:   {width: 24, alignItems: 'center'},
  dot:        {width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginTop: 16},
  dotLast:    {backgroundColor: C.accent},
  line:       {width: 2, flex: 1, backgroundColor: 'rgba(56,100,200,0.25)'},
  stepCard: {
    flex: 1, marginBottom: 10, padding: 13, borderRadius: 18,
    backgroundColor: 'rgba(16,31,51,0.65)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  stepTitle:  {color: C.textTitle, fontWeight: '900', fontSize: 15},
  stepActor:  {color: C.accent, fontWeight: '800', fontSize: 11, marginTop: 4},
  stepDetail: {color: C.textBody, fontSize: 13, lineHeight: 19, marginTop: 5},
  historySection: {marginTop: 14, gap: 8},
  historyTitle: {color: C.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1},
  historyCard: {
    padding: 12, borderRadius: 16,
    backgroundColor: 'rgba(16,31,51,0.48)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  focusCard: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
  },
  historyTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 8,
  },
  historyBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1},
  historyBadgeText: {fontSize: 10, fontWeight: '900'},
  historyText: {flex: 1, color: C.textTitle, fontSize: 13, fontWeight: '800'},
  historyMeta: {color: C.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16},
  historyReply: {color: C.textBody, fontSize: 12, marginTop: 6, lineHeight: 18},

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 14,
  },
  emptyIcon:   {fontSize: 48},
  emptyTitle:  {color: C.textTitle, fontSize: 18, fontWeight: '900', textAlign: 'center'},
  emptyDesc:   {color: C.textBody, fontSize: 14, lineHeight: 21, textAlign: 'center'},
  emptyPrimaryBtn: {
    marginTop: 8,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 999, backgroundColor: C.primary,
  },
  emptyPrimaryBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
  detailNavBtn: {
    marginTop: 8,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(77,255,136,0.10)',
    borderWidth: 1, borderColor: 'rgba(77,255,136,0.25)',
    alignItems: 'center',
  },
  detailNavBtnText: {color: C.primary, fontWeight: '900', fontSize: 14},
});
