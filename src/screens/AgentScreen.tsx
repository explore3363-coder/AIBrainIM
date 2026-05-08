import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import type {Agent, AgentStatus} from '../types';

const STATUS_LABEL: Record<AgentStatus, string> = {
  online:  '在线',
  working: '执行中',
  idle:    '空闲',
  watching:'后台观察',
};
const STATUS_COLOR: Record<AgentStatus, string> = {
  online:  C.online,
  working: C.working,
  idle:    C.idle,
  watching:C.watching,
};
const TASK_STATE_LABEL = {
  running: '执行中',
  todo: '待处理',
  done: '已完成',
  blocked: '待确认',
} as const;
const DISPATCH_STATUS_LABEL = {
  submitted: '已提交',
  dispatched: '执行中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
} as const;

type RootStackParamList = {
  Tabs: undefined;
  DispatchChain: undefined;
  Confirmations: undefined;
};

export function AgentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {agents, tasks, dispatches, pendingConfirmations, refreshing, refresh, runtimeMode, runtimeError} = useAppContext();
  const onRefresh = useCallback(() => { refresh(); }, [refresh]);
  const safeAgents = useMemo(() => Array.isArray(agents) ? agents : [], [agents]);
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const [selected, setSelected] = useState<Agent>(() => safeAgents[0] ?? {
    id: 'placeholder',
    name: '助理',
    role: 'AI 总指挥',
    status: 'idle',
    focus: '等待状态同步',
    accent: C.primary,
    current: '待命',
  });

  useEffect(() => {
    if (!safeAgents.length) return;
    const synced = safeAgents.find(agent => agent.id === selected.id);
    setSelected(synced ?? safeAgents[0]);
  }, [safeAgents, selected.id]);

  const workingAgents = useMemo(() => safeAgents.filter(agent => agent.status === 'working'), [safeAgents]);
  const onlineAgents = useMemo(() => safeAgents.filter(agent => agent.status === 'online' || agent.status === 'working'), [safeAgents]);
  const runningTasks = useMemo(() => safeTasks.filter(task => task.state === 'running'), [safeTasks]);
  const blockedTasks = useMemo(() => safeTasks.filter(task => task.state === 'blocked'), [safeTasks]);
  const latestDispatch = safeDispatches[0];

  const controlSummary = workingAgents.length > 0
    ? `当前执行中：${workingAgents.map(agent => agent.name).join('、')}，可直接查看任务详情。`
    : '当前没有执行中的智能体，系统处于待命状态。';

  const selectedTaskHint = selected.status === 'working'
    ? `${selected.name} 执行中：${selected.current}`
    : selected.status === 'watching'
      ? `${selected.name} 后台观察位，当前不占执行槽`
      : `${selected.name} 待命，可接收新分派`;

  const selectedTaskCount = useMemo(
    () => safeTasks.filter(task => task.agentId === selected.id && task.state !== 'done').length,
    [safeTasks, selected.id],
  );

  const selectedAgentTasks = useMemo(
    () => safeTasks
      .filter(task => task.agentId === selected.id)
      .sort((a, b) => {
        const aUpdated = a.updatedAt ?? 0;
        const bUpdated = b.updatedAt ?? 0;
        return bUpdated - aUpdated;
      })
      .slice(0, 3),
    [safeTasks, selected.id],
  );

  const selectedDispatchCount = useMemo(
    () => safeDispatches.filter(dispatch => dispatch.agentId === selected.id).length,
    [safeDispatches, selected.id],
  );

  const selectedAgentDispatches = useMemo(
    () => safeDispatches
      .filter(dispatch => dispatch.agentId === selected.id)
      .slice(0, 2),
    [safeDispatches, selected.id],
  );

  const actionCards = [
    {
      id: 'dispatch',
      title: '看调度链',
      detail: latestDispatch
        ? `最新一条调度当前状态：${latestDispatch.status}${latestDispatch.taskId ? ` · ${latestDispatch.taskId}` : ''}`
        : '目前还没有新的调度单压进来。',
      accent: C.primary,
      onPress: () => navigation.navigate('DispatchChain'),
    },
    {
      id: 'running',
      title: '盯执行位',
      detail: runningTasks.length > 0
        ? `现在有 ${runningTasks.length} 条任务在跑，优先关注正在工作的智能体。`
        : '当前没有运行中任务，说明可以继续压真实接口和上线收口。',
      accent: C.working,
      onPress: () => navigation.navigate('DispatchChain'),
    },
    {
      id: 'confirm',
      title: '处理确认项',
      detail: pendingConfirmations > 0 || blockedTasks.length > 0
        ? `还有 ${Math.max(pendingConfirmations, blockedTasks.length)} 条人工拍板节点会影响后续推进。`
        : '当前没有确认链阻塞，执行链是通的。',
      accent: '#f87171',
      onPress: () => navigation.navigate('Confirmations'),
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>智能体</Text>
        <Text style={styles.sub}>{agents.length} 个 Agent · 实时状态</Text>
        <Text style={styles.syncText}>
          {refreshing
            ? '正在拉取智能体状态…'
            : runtimeMode === 'live'
              ? '已连接 · 实时同步'
              : `回退模式 · ${runtimeError ?? '等待网关恢复'}`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
      >
        <View style={styles.focusBoard}>
          <View style={styles.focusTop}>
            <View>
              <Text style={styles.focusEyebrow}>AGENT CONTROL</Text>
              <Text style={styles.focusTitle}>先判断谁在工作，再决定看谁</Text>
            </View>
            <View style={styles.focusBadge}>
              <Text style={styles.focusBadgeText}>{workingAgents.length > 0 ? `${workingAgents.length} 个执行中` : '当前待命'}</Text>
            </View>
          </View>
          <Text style={styles.focusDesc}>{controlSummary}</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, {color: C.working}]}>执行中</Text>
              <Text style={styles.summaryValue}>{workingAgents.length}</Text>
              <Text style={styles.summaryHint}>直接代表当前前台产出压力</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, {color: C.accent}]}>在线</Text>
              <Text style={styles.summaryValue}>{onlineAgents.length}</Text>
              <Text style={styles.summaryHint}>说明系统当前可被即时调度</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabelWarning}>待确认</Text>
              <Text style={styles.summaryValue}>{Math.max(pendingConfirmations, blockedTasks.length)}</Text>
              <Text style={styles.summaryHint}>人工拍板会直接影响推进</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {actionCards.map(card => (
            <TouchableOpacity key={card.id} style={styles.actionCard} activeOpacity={0.85} onPress={card.onPress}>
              <Text style={[styles.actionTitle, {color: card.accent}]}>{card.title}</Text>
              <Text style={styles.actionDetail}>{card.detail}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.agentGrid}>
          {agents.map(agent => {
            const sel = selected.id === agent.id;
            return (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.gridCard,
                  sel && styles.gridCardSel,
                  {borderTopColor: agent.accent},
                ]}
                onPress={() => setSelected(agent)}
                activeOpacity={0.8}
              >
                <View style={[styles.avatar, {backgroundColor: agent.accent}]}>
                  <Text style={styles.avatarText}>{agent.name.slice(0, 1)}</Text>
                </View>
                <Text style={styles.agentName}>{agent.name}</Text>
                <Text style={styles.agentRole}>{agent.role}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, {backgroundColor: STATUS_COLOR[agent.status]}]} />
                  <Text style={styles.statusText}>{STATUS_LABEL[agent.status]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.detail}>
          <View style={[styles.detailTop, {borderBottomColor: selected.accent}]}>
            <View style={[styles.avatarLg, {backgroundColor: selected.accent}]}>
              <Text style={styles.avatarTextLg}>{selected.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailName}>{selected.name}</Text>
              <Text style={styles.detailRole}>{selected.role}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, {backgroundColor: STATUS_COLOR[selected.status]}]} />
                <Text style={styles.statusText}>{STATUS_LABEL[selected.status]}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.detailLabel}>专注领域</Text>
          <Text style={styles.detailValue}>{selected.focus}</Text>

          <Text style={styles.detailLabel}>当前任务</Text>
          <Text style={styles.detailValue}>📍 {selected.current}</Text>

          <Text style={styles.detailLabel}>实时链路</Text>
          <Text style={styles.detailValue}>
            {selected.sessionKey
              ? `session=${selected.sessionKey}${selected.runtimeMs ? ` · runtime ${Math.round(selected.runtimeMs / 1000)}s` : ''}`
              : selected.sourceMode === 'fallback'
                ? '离线模式 · 显示最后已知状态'
                : '暂无 session 数据'}
          </Text>

          <Text style={styles.detailLabel}>执行负载</Text>
          <Text style={styles.detailValue}>未完成任务 {selectedTaskCount} 条 · 已关联调度 {selectedDispatchCount} 条</Text>

          <Text style={styles.detailLabel}>当前判断</Text>
          <Text style={styles.detailValue}>{selectedTaskHint}</Text>

          <Text style={styles.detailLabel}>正在处理的任务</Text>
          {selectedAgentTasks.length > 0 ? selectedAgentTasks.map(task => (
            <View key={task.id} style={styles.inlineCard}>
              <View style={styles.inlineCardTop}>
                <Text style={styles.inlineCardTitle}>{task.title}</Text>
                <View style={[styles.inlineStateBadge, {backgroundColor: STATUS_COLOR[selected.status] + '22', borderColor: STATUS_COLOR[selected.status] + '55'}]}>
                  <Text style={[styles.inlineStateText, {color: STATUS_COLOR[selected.status]}]}>{TASK_STATE_LABEL[task.state]}</Text>
                </View>
              </View>
              <Text style={styles.inlineCardMeta}>{task.priority ?? 'P2'} · {task.eta}</Text>
              <Text style={styles.inlineCardDetail}>{task.next}</Text>
            </View>
          )) : (
            <Text style={styles.detailValue}>暂无任务记录</Text>
          )}

          <Text style={styles.detailLabel}>最近回流</Text>
          {selectedAgentDispatches.length > 0 ? selectedAgentDispatches.map(dispatch => (
            <View key={dispatch.id} style={styles.inlineCard}>
              <View style={styles.inlineCardTop}>
                <Text style={styles.inlineCardTitle} numberOfLines={2}>{dispatch.userText}</Text>
                <View style={[styles.inlineStateBadge, {backgroundColor: selected.accent + '22', borderColor: selected.accent + '55'}]}>
                  <Text style={[styles.inlineStateText, {color: selected.accent}]}>{DISPATCH_STATUS_LABEL[dispatch.status]}</Text>
                </View>
              </View>
              <Text style={styles.inlineCardMeta}>{dispatch.taskId ?? '未生成 taskId'}{dispatch.sessionKey ? ` · ${dispatch.sessionKey}` : ''}</Text>
              <Text style={styles.inlineCardDetail} numberOfLines={3}>{dispatch.reply}</Text>
            </View>
          )) : (
            <Text style={styles.detailValue}>暂无回流记录</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BR = 24;
const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: C.bgRoot},
  header:       {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:        {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:          {color: C.textMuted, fontSize: 12, marginTop: 4},
  syncText:     {color: C.primary, fontSize: 11, marginTop: 8, fontWeight: '700'},
  grid:         {padding: 16, paddingBottom: 100},
  focusBoard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(10,22,42,0.88)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    marginBottom: 14,
  },
  focusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  focusEyebrow: {color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1},
  focusTitle: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 4},
  focusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  focusBadgeText: {color: C.primary, fontSize: 11, fontWeight: '900'},
  focusDesc: {color: C.textBody, fontSize: 13, lineHeight: 20, marginTop: 10},
  summaryRow: {flexDirection: 'row', gap: 10, marginTop: 14},
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.6)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  summaryLabel: {fontSize: 11, fontWeight: '900'},
  summaryLabelWarning: {fontSize: 11, fontWeight: '900', color: '#f87171'},
  summaryValue: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 6},
  summaryHint: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5},
  actionRow: {gap: 10, marginBottom: 14},
  actionCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  actionTitle: {fontSize: 14, fontWeight: '900'},
  actionDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  agentGrid:    {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  gridCard: {
    width: '47%',
    padding: 14,
    borderRadius: BR,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderTopWidth: 3,
    paddingBottom: 18,
  },
  gridCardSel: {
    backgroundColor: 'rgba(20,38,68,0.88)',
    borderColor: C.primary,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {color: '#020617', fontSize: 18, fontWeight: '900'},
  agentName:  {color: C.textTitle, fontSize: 18, fontWeight: '800'},
  agentRole:  {color: C.primary, fontSize: 11, marginTop: 4},
  statusRow:  {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  statusDot: {width: 7, height: 7, borderRadius: 4, marginRight: 6},
  statusText: {color: C.textBody, fontSize: 12, fontWeight: '700'},

  detail: {
    marginTop: 16, padding: 16, borderRadius: BR,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  detailTop: {
    flexDirection: 'row', gap: 16, paddingBottom: 14, marginBottom: 14,
    borderBottomWidth: 1,
  },
  avatarLg: {
    width: 56, height: 56, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTextLg: {color: '#020617', fontSize: 24, fontWeight: '900'},
  detailInfo:  {flex: 1, justifyContent: 'center'},
  detailName: {color: C.textTitle, fontSize: 20, fontWeight: '900'},
  detailRole: {color: C.primary, fontSize: 12, marginTop: 4},
  detailLabel: {color: C.textMuted, fontSize: 11, fontWeight: '700', marginTop: 14},
  detailValue: {color: C.textBody, fontSize: 14, lineHeight: 20, marginTop: 5},
  inlineCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.6)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  inlineCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  inlineCardTitle: {flex: 1, color: C.textTitle, fontSize: 13, fontWeight: '800'},
  inlineCardMeta: {color: C.textMuted, fontSize: 11, marginTop: 5},
  inlineCardDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  inlineStateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  inlineStateText: {fontSize: 10, fontWeight: '900'},
});
