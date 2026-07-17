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
import {C, LAYOUT} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import type {Agent, AgentStatus} from '../types';
import {AgentPlatformService} from '../services/AgentPlatformService';

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
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  DispatchChain: {focusDispatchId?: string; focusTaskId?: string; focusSessionKey?: string} | undefined;
  Confirmations: undefined;
};

const QUICK_LINKS = [
  {id: 'memory', label: '记忆库', emoji: '🧠', screen: 'MemoryStore' as const},
  {id: 'knowledge', label: '知识库', emoji: '📚', screen: 'KnowledgeBase' as const},
  {id: 'files', label: '附件库', emoji: '📎', screen: 'FileLibrary' as const},
  {id: 'dispatch', label: '调度链', emoji: '⚡', screen: 'DispatchChain' as const},
];

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
  const [platformHealthy, setPlatformHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    AgentPlatformService.healthCheck().then(ok => setPlatformHealthy(ok));
  }, []);

  useEffect(() => {
    if (!safeAgents.length) return;
    if (selected && safeAgents.some(a => a.id === selected.id)) return;
    setSelected(safeAgents[0]);
  }, [safeAgents]);

  const workingAgents = useMemo(() => safeAgents.filter(agent => agent.status === 'working'), [safeAgents]);
  const onlineAgents = useMemo(() => safeAgents.filter(agent => agent.status === 'online' || agent.status === 'working'), [safeAgents]);
  const runningTasks = useMemo(() => safeTasks.filter(task => task.state === 'running'), [safeTasks]);
  const blockedTasks = useMemo(() => safeTasks.filter(task => task.state === 'blocked'), [safeTasks]);
  const latestDispatch = safeDispatches[0];

  const controlSummary = workingAgents.length > 0
    ? `正在执行：${workingAgents.map(agent => agent.name).join('、')}`
    : '系统待命，可接收新任务';

  const selectedTaskHint = selected.status === 'working'
    ? `${selected.name} 执行中：${selected.current}`
    : selected.status === 'watching'
      ? `${selected.name} 后台观察中`
      : `${selected.name} 待命`;

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
      .slice(0, 2),
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
        ? `${latestDispatch.status}${latestDispatch.taskId ? ` · ${latestDispatch.taskId}` : ''}`
        : '暂无调度记录',
      accent: C.primary,
      onPress: () => navigation.navigate('DispatchChain'),
    },
    {
      id: 'confirm',
      title: '处理确认项',
      detail: pendingConfirmations > 0 || blockedTasks.length > 0
        ? `${Math.max(pendingConfirmations, blockedTasks.length)} 条待拍板`
        : '执行链畅通',
      accent: '#f87171',
      onPress: () => navigation.navigate('Confirmations'),
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>智能体</Text>
          <View style={[styles.runtimeBadge, {backgroundColor: runtimeMode === 'live' ? C.primaryGlow : 'rgba(255,100,100,0.12)', borderColor: runtimeMode === 'live' ? C.primary : '#f87171'}]}>
            <View style={[styles.runtimeDot, {backgroundColor: runtimeMode === 'live' ? C.primary : '#f87171'}]} />
            <Text style={[styles.runtimeText, {color: runtimeMode === 'live' ? C.primary : '#f87171'}]}>
              {runtimeMode === 'live' ? '实时' : '离线'}
            </Text>
          </View>
        </View>
        <Text style={styles.sub}>{agents.length} 个 Agent · {workingAgents.length} 个执行中</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
      >
        {/* Quick Nav Strip */}
        <View style={styles.quickStrip}>
          {QUICK_LINKS.map(link => (
            <TouchableOpacity
              key={link.id}
              style={styles.quickChip}
              activeOpacity={0.75}
              onPress={() => navigation.navigate(link.screen as any)}
            >
              <Text style={styles.quickEmoji}>{link.emoji}</Text>
              <Text style={styles.quickLabel}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Focus Board */}
        <View style={styles.focusBoard}>
          <View style={styles.focusTop}>
            <Text style={styles.focusTitle}>执行态势</Text>
            <View style={[styles.focusBadge, workingAgents.length > 0 && styles.focusBadgeActive]}>
              <Text style={[styles.focusBadgeText, workingAgents.length > 0 && styles.focusBadgeTextActive]}>
                {workingAgents.length > 0 ? `${workingAgents.length} 个执行中` : '待命'}
              </Text>
            </View>
          </View>
          <Text style={styles.focusDesc}>{controlSummary}</Text>

          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: C.working}]}>{workingAgents.length}</Text>
              <Text style={styles.statLabel}>执行中</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: C.accent}]}>{onlineAgents.length}</Text>
              <Text style={styles.statLabel}>在线</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: '#f87171'}]}>{Math.max(pendingConfirmations, blockedTasks.length)}</Text>
              <Text style={styles.statLabel}>待确认</Text>
            </View>
          </View>
        </View>

        {/* Action Cards */}
        <View style={styles.actionRow}>
          {actionCards.map(card => (
            <TouchableOpacity key={card.id} style={styles.actionCard} activeOpacity={0.85} onPress={card.onPress}>
              <View style={styles.actionHeader}>
                <View style={[styles.actionDot, {backgroundColor: card.accent}]} />
                <Text style={[styles.actionTitle, {color: card.accent}]}>{card.title}</Text>
              </View>
              <Text style={styles.actionDetail}>{card.detail}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Agent Grid */}
        <View style={styles.agentGrid}>
          {agents.map(agent => {
            const sel = selected.id === agent.id;
            const statusColor = STATUS_COLOR[agent.status];
            const queueLoad = agent.queueDepth ?? 0;
            const lastActiveAgo = agent.lastActiveAt ? Math.floor((Date.now() - agent.lastActiveAt) / 60000) : 999;
            const baseScore = agent.status === 'working' ? 85 : agent.status === 'online' ? 70 : agent.status === 'watching' ? 55 : 40;
            const confidence = Math.min(99, Math.max(10,
              baseScore - Math.min(30, queueLoad * 5) - Math.min(20, lastActiveAgo * 2)
            ));
            const confidenceColor = confidence >= 70 ? C.primary : confidence >= 45 ? '#fbbf24' : '#f87171';
            return (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.agentCard,
                  sel && styles.agentCardSel,
                  {borderLeftColor: agent.accent},
                ]}
                onPress={() => setSelected(agent)}
                activeOpacity={0.8}
              >
                <View style={styles.agentCardTop}>
                  <View style={[styles.agentAvatar, {backgroundColor: agent.accent}]}>
                    <Text style={styles.agentAvatarText}>{agent.name.slice(0, 1)}</Text>
                    {agent.status === 'working' && (
                      <View style={[styles.agentLiveDot, {backgroundColor: statusColor}]} />
                    )}
                  </View>
                  <View style={styles.agentMeta}>
                    <Text style={styles.agentName}>{agent.name}</Text>
                    <View style={styles.agentStatusRow}>
                      <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
                      <Text style={[styles.statusText, {color: statusColor}]}>{STATUS_LABEL[agent.status]}</Text>
                    </View>
                  </View>
                  <View style={[styles.confidencePill, {borderColor: confidenceColor + '60'}]}>
                    <Text style={[styles.confidenceText, {color: confidenceColor}]}>{confidence}%</Text>
                  </View>
                </View>
                <Text style={styles.agentRole} numberOfLines={1}>{agent.role}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Agent Detail */}
        <View style={styles.detail}>
          <View style={styles.detailHeader}>
            <View style={[styles.detailAvatar, {backgroundColor: selected.accent}]}>
              <Text style={styles.detailAvatarText}>{selected.name.slice(0, 1)}</Text>
              {selected.status === 'working' && (
                <View style={[styles.detailLiveDot, {backgroundColor: STATUS_COLOR[selected.status]}]} />
              )}
            </View>
            <View style={styles.detailMeta}>
              <Text style={styles.detailName}>{selected.name}</Text>
              <Text style={styles.detailRole}>{selected.role}</Text>
              <View style={styles.agentStatusRow}>
                <View style={[styles.statusDot, {backgroundColor: STATUS_COLOR[selected.status]}]} />
                <Text style={[styles.statusText, {color: STATUS_COLOR[selected.status]}]}>{STATUS_LABEL[selected.status]}</Text>
              </View>
            </View>
            {(() => {
              const q = selected.queueDepth ?? 0;
              const lastAgo = selected.lastActiveAt ? Math.floor((Date.now() - selected.lastActiveAt) / 60000) : 999;
              const base = selected.status === 'working' ? 85 : selected.status === 'online' ? 70 : selected.status === 'watching' ? 55 : 40;
              const conf = Math.min(99, Math.max(10, base - Math.min(30, q * 5) - Math.min(20, lastAgo * 2)));
              const cColor = conf >= 70 ? C.primary : conf >= 45 ? '#fbbf24' : '#f87171';
              return (
                <View style={[styles.detailConfBadge, {borderColor: cColor + '80'}]}>
                  <Text style={[styles.detailConfText, {color: cColor}]}>{conf}%</Text>
                </View>
              );
            })()}
          </View>

          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>专注领域</Text>
              <Text style={styles.infoValue}>{selected.focus}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>当前任务</Text>
              <Text style={styles.infoValue} numberOfLines={1}>📍 {selected.current}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>实时链路</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {selected.sessionKey
                  ? `session=${selected.sessionKey}${selected.runtimeMs ? ` · ${Math.round(selected.runtimeMs / 1000)}s` : ''}`
                  : selected.sourceMode === 'fallback' ? '离线模式' : '暂无 session'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>最后心跳</Text>
              <Text style={styles.infoValue}>
                {selected.lastActiveAt
                  ? (() => {
                      const diff = Date.now() - selected.lastActiveAt;
                      const mins = Math.floor(diff / 60000);
                      const secs = Math.floor((diff % 60000) / 1000);
                      return mins > 0 ? `${mins}m ago` : `${secs}s ago`;
                    })()
                  : '无记录'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>执行负载</Text>
              <Text style={styles.infoValue}>{selectedTaskCount} 待处理 · {selectedDispatchCount} 关联调度</Text>
            </View>
          </View>

          {selectedAgentTasks.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>正在处理</Text>
              {selectedAgentTasks.map(task => (
                <View key={task.id} style={styles.inlineCard}>
                  <View style={styles.inlineCardTop}>
                    <Text style={styles.inlineCardTitle} numberOfLines={1}>{task.title}</Text>
                    <View style={[styles.inlineStateBadge, {backgroundColor: STATUS_COLOR[selected.status] + '22', borderColor: STATUS_COLOR[selected.status] + '55'}]}>
                      <Text style={[styles.inlineStateText, {color: STATUS_COLOR[selected.status]}]}>{TASK_STATE_LABEL[task.state]}</Text>
                    </View>
                  </View>
                  <Text style={styles.inlineCardMeta}>{task.priority ?? 'P2'} · {task.eta}</Text>
                  <Text style={styles.inlineCardDetail} numberOfLines={2}>{task.next}</Text>
                </View>
              ))}
            </>
          )}

          {selectedAgentDispatches.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>最近回流</Text>
              {selectedAgentDispatches.map(dispatch => (
                <View key={dispatch.id} style={styles.inlineCard}>
                  <View style={styles.inlineCardTop}>
                    <Text style={styles.inlineCardTitle} numberOfLines={2}>{dispatch.userText}</Text>
                    <View style={[styles.inlineStateBadge, {backgroundColor: selected.accent + '22', borderColor: selected.accent + '55'}]}>
                      <Text style={[styles.inlineStateText, {color: selected.accent}]}>{DISPATCH_STATUS_LABEL[dispatch.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.inlineCardMeta}>{dispatch.taskId ?? '无 taskId'}</Text>
                  <Text style={styles.inlineCardDetail} numberOfLines={2}>{dispatch.reply}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BR = 16;
const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: C.bgRoot},
  header:       {paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10},
  headerTop:    {flexDirection: 'row', alignItems: 'center', gap: 10},
  title:        {color: C.textTitle, fontSize: 24, fontWeight: '900'},
  runtimeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
  },
  runtimeDot:   {width: 6, height: 6, borderRadius: 3},
  runtimeText:  {fontSize: 10, fontWeight: '800'},
  sub:          {color: C.textMuted, fontSize: 12, marginTop: 2},
  content:      {paddingHorizontal: 16, paddingBottom: 100},

  quickStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  quickChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  quickEmoji: {fontSize: 14},
  quickLabel: {color: C.textBody, fontSize: 11, fontWeight: '700'},

  focusBoard: {
    padding: 14,
    borderRadius: BR,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    marginBottom: 10,
  },
  focusTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  focusTitle: {color: C.textTitle, fontSize: 15, fontWeight: '800'},
  focusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: C.bgSurface, borderWidth: 1, borderColor: C.borderSubtle,
  },
  focusBadgeActive: {backgroundColor: C.primaryGlow, borderColor: C.borderActive},
  focusBadgeText: {fontSize: 10, fontWeight: '800', color: C.textMuted},
  focusBadgeTextActive: {color: C.primary},
  focusDesc: {color: C.textBody, fontSize: 12, marginTop: 6, lineHeight: 18},

  statRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, backgroundColor: C.bgSurface,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
  },
  statItem: {flex: 1, alignItems: 'center'},
  statDivider: {width: 1, height: 28, backgroundColor: C.borderSubtle},
  statValue: {fontSize: 18, fontWeight: '900'},
  statLabel: {color: C.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600'},

  actionRow: {flexDirection: 'row', gap: 10, marginBottom: 10},
  actionCard: {
    flex: 1, padding: 12, borderRadius: BR,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  actionHeader: {flexDirection: 'row', alignItems: 'center', gap: 6},
  actionDot: {width: 6, height: 6, borderRadius: 3},
  actionTitle: {fontSize: 13, fontWeight: '800'},
  actionDetail: {color: C.textBody, fontSize: 11, marginTop: 5, lineHeight: 16},

  agentGrid:    {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  agentCard: {
    width: '48.5%', padding: 12, borderRadius: 14,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle, borderLeftWidth: 3,
  },
  agentCardSel: {backgroundColor: 'rgba(20,38,68,0.88)', borderColor: C.primary, borderLeftColor: C.primary},
  agentCardTop: {flexDirection: 'row', alignItems: 'center', gap: 8},
  agentAvatar: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  agentAvatarText: {color: '#020617', fontSize: 15, fontWeight: '900'},
  agentLiveDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.bgCard,
  },
  agentMeta: {flex: 1},
  agentName: {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  agentRole: {color: C.textMuted, fontSize: 10, marginTop: 3},
  agentStatusRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2},
  statusDot: {width: 6, height: 6, borderRadius: 3},
  statusText: {fontSize: 11, fontWeight: '700'},
  confidencePill: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  confidenceText: {fontSize: 9, fontWeight: '900'},

  detail: {
    padding: 14, borderRadius: BR,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 12, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  detailAvatar: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  detailAvatarText: {color: '#020617', fontSize: 20, fontWeight: '900'},
  detailLiveDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.bgCard,
  },
  detailMeta: {flex: 1},
  detailName: {color: C.textTitle, fontSize: 17, fontWeight: '900'},
  detailRole: {color: C.primary, fontSize: 11, marginTop: 2},
  detailConfBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.2)',
  },
  detailConfText: {fontSize: 12, fontWeight: '900'},

  infoRows: {gap: 0},
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', gap: 12,
  },
  infoLabel: {color: C.textMuted, fontSize: 11, fontWeight: '700', flexShrink: 0},
  infoValue: {color: C.textBody, fontSize: 12, textAlign: 'right', flex: 1},

  sectionTitle: {
    color: C.primary, fontSize: 11, fontWeight: '800',
    marginTop: 14, marginBottom: 8, letterSpacing: 0.5,
  },
  inlineCard: {
    padding: 10, borderRadius: 10,
    backgroundColor: C.bgSurface, borderWidth: 1, borderColor: C.borderSubtle, marginBottom: 6,
  },
  inlineCardTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  inlineCardTitle: {flex: 1, color: C.textTitle, fontSize: 12, fontWeight: '800'},
  inlineCardMeta: {color: C.textMuted, fontSize: 10, marginTop: 4},
  inlineCardDetail: {color: C.textBody, fontSize: 11, marginTop: 5, lineHeight: 16},
  inlineStateBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1,
  },
  inlineStateText: {fontSize: 9, fontWeight: '900'},
});
