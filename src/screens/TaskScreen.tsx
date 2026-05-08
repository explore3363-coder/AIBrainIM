import React, {useCallback} from 'react';
import {ScrollView, Text, View, StyleSheet, TouchableOpacity, RefreshControl} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import {TaskBadge} from '../components/TaskBadge';
import type {Task, TaskState} from '../types';
import type {RootStackParamList} from '../App';

const COLUMNS: {label: string; key: TaskState; color: string}[] = [
  {label: '进行中', key: 'running', color: C.working},
  {label: '待处理', key: 'todo',    color: C.idle},
  {label: '已完成', key: 'done',    color: '#34d399'},
  {label: '需确认', key: 'blocked', color: '#f87171'},
];

const TASK_STATE_LABEL: Record<TaskState, string> = {
  running: '执行中',
  todo: '待处理',
  done: '已完成',
  blocked: '待确认',
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  chat: '对话',
  upload: '附件',
  knowledge: '知识',
  memory: '记忆',
  confirmation: '确认',
  cron: '定时',
  subagent: '子Agent',
  fallback: '回退',
};

function TaskCard({task, onPress}: {task: Task; onPress?: () => void}) {
  const isConfirmation = task.state === 'blocked';
  return (
    <TouchableOpacity
      style={[styles.taskCard, isConfirmation && styles.taskCardBlocked]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.taskTop}>
        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
        {isConfirmation ? (
          <View style={[styles.confirmBadge]}>
            <Text style={styles.confirmBadgeText}>⚠️ 需确认</Text>
          </View>
        ) : (
          <TaskBadge state={task.state} />
        )}
      </View>
      {task.priority ? <Text style={styles.taskId}>优先级：{task.priority}</Text> : null}
      <View style={styles.metaBadgeRow}>
        {task.attachmentCount ? (
          <View style={styles.sourceBadgePurple}>
            <Text style={styles.sourceBadgeText}>📎 {task.attachmentCount}</Text>
          </View>
        ) : null}
        {task.sourceType ? (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{SOURCE_TYPE_LABEL[task.sourceType] ?? task.sourceType}</Text>
          </View>
        ) : null}
        {task.priority && (
          <View style={[styles.priorityBadge, task.priority === 'P0' && styles.priorityP0]}>
            <Text style={styles.priorityText}>{task.priority}</Text>
          </View>
        )}
      </View>
      <Text style={styles.taskMeta}>👤 {task.owner}</Text>
      <Text style={styles.taskMeta}>⏱ {task.eta} · {TASK_STATE_LABEL[task.state]}</Text>
      {task.sessionKey ? <Text style={styles.taskMeta}>🧷 {task.sessionKey}</Text> : null}
      {task.traceSummary && task.state !== 'done' ? <Text style={styles.taskTrace}>{task.traceSummary}</Text> : null}
      <Text style={styles.taskNext}>→ {task.next}</Text>
      <Text style={styles.tapHint}>👆 {isConfirmation ? '点击前往确认' : '点击继续推进'}</Text>
    </TouchableOpacity>
  );
}

function sortTasksByPriority(items: Task[]): Task[] {
  const priorityRank: Record<string, number> = {P0: 0, P1: 1, P2: 2};
  const stateRank: Record<TaskState, number> = {running: 0, todo: 1, blocked: 2, done: 3};

  return [...items].sort((a, b) => {
    const pa = priorityRank[a.priority ?? 'P2'] ?? 9;
    const pb = priorityRank[b.priority ?? 'P2'] ?? 9;
    if (pa !== pb) {
      return pa - pb;
    }

    const sa = stateRank[a.state] ?? 9;
    const sb = stateRank[b.state] ?? 9;
    if (sa !== sb) {
      return sa - sb;
    }

    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

function KanbanCol({
  label, items, color, onTaskPress,
}: {
  label: string; items: Task[]; color: string;
  onTaskPress: (task: Task) => void;
}) {
  return (
    <View style={styles.col}>
      <View style={[styles.colHeader, {borderTopColor: color}]}>
        <Text style={[styles.colTitle, {color}]}>{label}</Text>
        <View style={[styles.colBadge, {backgroundColor: color}]}>
          <Text style={styles.colCount}>{items.length}</Text>
        </View>
      </View>
      {items.map(task => (
        <TaskCard key={task.id} task={task} onPress={() => onTaskPress(task)} />
      ))}
    </View>
  );
}

export function TaskScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    tasks,
    dispatches,
    uploads,
    pendingConfirmations,
    runtimeMode,
    runtimeError,
    gatewayConfigValid,
    refreshing,
    refresh,
  } = useAppContext();

  const onRefresh = useCallback(() => { refresh(); }, [refresh]);

  const safeDispatches = React.useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const safeUploads = React.useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);

  const handleTaskPress = useCallback((task: Task) => {
    if (task.state === 'blocked' || task.sourceType === 'confirmation') {
      const confirmationId = task.id.startsWith('confirm-') ? task.id.replace(/^confirm-/, '') : undefined;
      navigation.navigate('Confirmations', {
        focusConfirmationId: confirmationId,
        focusTaskId: task.id,
      });
      return;
    }

    if (task.sourceType === 'upload') {
      const linkedFileId = task.id.startsWith('upload-') ? task.id.replace(/^upload-/, '') : undefined;
      const linkedUpload = safeUploads.find(upload => upload.id === linkedFileId)
        ?? safeUploads.find(upload => upload.dispatchId === task.sessionKey);

      navigation.navigate('Upload', {
        focusFileId: linkedUpload?.id ?? linkedFileId,
        focusDispatchId: linkedUpload?.dispatchId ?? task.sessionKey,
      });
      return;
    }

    if (task.sourceType === 'memory') {
      navigation.navigate('MemoryStore');
      return;
    }

    if (task.sourceType === 'knowledge') {
      navigation.navigate('KnowledgeBase');
      return;
    }

    navigation.navigate('DispatchChain', {
      focusTaskId: task.id,
      focusSessionKey: task.sessionKey,
    });
  }, [navigation, safeUploads]);

  const grouped = React.useMemo(() => {
    const g: Record<TaskState, Task[]> = {running: [], todo: [], done: [], blocked: []};
    tasks.forEach(t => g[t.state].push(t));
    return {
      running: sortTasksByPriority(g.running),
      todo: sortTasksByPriority(g.todo),
      done: sortTasksByPriority(g.done),
      blocked: sortTasksByPriority(g.blocked),
    };
  }, [tasks]);

  const topPriorityTask = React.useMemo(() => {
    const sorted = sortTasksByPriority(tasks.filter(task => task.state !== 'done'));
    return sorted[0];
  }, [tasks]);

  const latestDispatch = React.useMemo(() => safeDispatches[0], [safeDispatches]);
  const activeUploads = React.useMemo(
    () => safeUploads.filter(upload => upload.status === 'queued' || upload.status === 'uploading' || upload.status === 'processing'),
    [safeUploads],
  );
  const latestUpload = React.useMemo(() => activeUploads[0] ?? safeUploads[0], [activeUploads, safeUploads]);

  const summaryItems = React.useMemo(() => ([
    {
      label: '执行中',
      value: grouped.running.length,
      accent: C.working,
      hint: grouped.running.length > 0 ? 'AI 正在持续推进' : '当前没有正在执行的任务',
    },
    {
      label: '待收口',
      value: grouped.todo.length,
      accent: C.idle,
      hint: grouped.todo.length > 0 ? '这些任务还没真正进入执行' : '待处理任务已清空',
    },
    {
      label: '需确认',
      value: grouped.blocked.length,
      accent: '#f87171',
      hint: grouped.blocked.length > 0 ? '先拍板再继续推进' : '当前没有阻塞确认项',
    },
  ]), [grouped]);

  const actionQueue = React.useMemo(() => {
    const queue: Array<{
      id: string;
      tag: string;
      title: string;
      detail: string;
      accent: string;
      onPress: () => void;
    }> = [];

    if (runtimeMode !== 'live') {
      queue.push({
        id: 'gateway-runtime',
        tag: '运行态',
        title: gatewayConfigValid ? '优先恢复真实 Gateway 连通' : '先补齐 Gateway 配置',
        detail: runtimeError
          ? `当前仍是回退模式：${runtimeError}`
          : '没有 LIVE 网关，任务流和调度流只能展示本地回退状态。',
        accent: '#f97316',
        onPress: () => navigation.navigate('GatewaySettings'),
      });
    }

    if (pendingConfirmations > 0) {
      queue.push({
        id: 'pending-confirmations',
        tag: '需确认项',
        title: `还有 ${pendingConfirmations} 条待拍板`,
        detail: '这些项目不清掉，任务看板再完整也会卡在人工确认这一步。',
        accent: '#f87171',
        onPress: () => navigation.navigate('Confirmations', {focusTaskId: `confirm-${topPriorityTask?.id ?? ''}`}),
      });
    }

    if (latestUpload && activeUploads.length > 0) {
      queue.push({
        id: `upload-${latestUpload.id}`,
        tag: '附件链路',
        title: `上传中的附件：${latestUpload.name}`,
        detail: latestUpload.status === 'processing'
          ? '文件已传完，正在进入后台 AI 处理队列。'
          : latestUpload.status === 'uploading'
            ? `当前上传进度 ${latestUpload.progress}% ，完成后会自动进入调度链。`
            : '附件已入队，等待上传与处理继续推进。',
        accent: '#34d399',
        onPress: () => navigation.navigate('Upload', {
          focusFileId: latestUpload.id,
          focusDispatchId: latestUpload.dispatchId,
        }),
      });
    }

    if (latestDispatch && latestDispatch.status !== 'completed') {
      queue.push({
        id: `dispatch-${latestDispatch.id}`,
        tag: '调度链',
        title: latestDispatch.userText.length > 26 ? `${latestDispatch.userText.slice(0, 26)}…` : latestDispatch.userText,
        detail: latestDispatch.reply,
        accent: latestDispatch.status === 'failed' ? '#f87171' : C.primary,
        onPress: () => navigation.navigate('DispatchChain', {
          focusDispatchId: latestDispatch.dispatchId,
          focusTaskId: latestDispatch.taskId,
          focusSessionKey: latestDispatch.sessionKey,
        }),
      });
    }

    if (topPriorityTask) {
      queue.push({
        id: `task-${topPriorityTask.id}`,
        tag: '任务焦点',
        title: topPriorityTask.title,
        detail: topPriorityTask.next,
        accent: topPriorityTask.state === 'blocked' ? '#f87171' : C.working,
        onPress: () => handleTaskPress(topPriorityTask),
      });
    }

    return queue.slice(0, 4);
  }, [
    activeUploads.length,
    gatewayConfigValid,
    handleTaskPress,
    latestDispatch,
    latestUpload,
    navigation,
    pendingConfirmations,
    runtimeError,
    runtimeMode,
    topPriorityTask,
  ]);

  const hasNoTasks = tasks.length === 0;
  const allDone = !hasNoTasks && grouped.running.length === 0 && grouped.todo.length === 0 && grouped.blocked.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>任务</Text>
        <Text style={styles.sub}>全局任务流 · 实时状态</Text>
        <Text style={styles.syncText}>{refreshing ? '任务状态同步中…' : '实时同步 · 对话、附件、知识与任务统一汇合'}</Text>
      </View>

      <View style={styles.focusBoard}>
        <View style={styles.focusTopRow}>
          <View>
            <Text style={styles.focusEyebrow}>TASK FOCUS</Text>
            <Text style={styles.focusTitle}>先处理最影响闭环的那一条</Text>
          </View>
          {topPriorityTask ? (
            <TouchableOpacity style={styles.focusActionBtn} activeOpacity={0.8} onPress={() => handleTaskPress(topPriorityTask)}>
              <Text style={styles.focusActionBtnText}>{topPriorityTask.state === 'blocked' ? '去确认' : '继续推进'}</Text>
            </TouchableOpacity>
          ) : runtimeMode !== 'live' ? (
            <TouchableOpacity style={styles.focusActionBtn} activeOpacity={0.8} onPress={() => navigation.navigate('GatewaySettings')}>
              <Text style={styles.focusActionBtnText}>去连 Gateway</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.focusDesc}>
          {topPriorityTask
            ? `当前最值得盯住的是「${topPriorityTask.title}」，下一步：${topPriorityTask.next}`
            : runtimeMode !== 'live'
              ? '当前没有真正接入 LIVE 网关，优先把真实运行态连上，否则这里只能展示本地回退数据。'
              : '暂无未完成任务'}</Text>

        {actionQueue.length > 0 && (
          <View style={styles.actionQueueList}>
            {actionQueue.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.actionQueueCard}
                activeOpacity={0.82}
                onPress={item.onPress}
              >
                <View style={[styles.actionQueueAccent, {backgroundColor: item.accent}]} />
                <View style={styles.actionQueueBody}>
                  <Text style={[styles.actionQueueTag, {color: item.accent}]}>{item.tag}</Text>
                  <Text style={styles.actionQueueTitle}>{item.title}</Text>
                  <Text style={styles.actionQueueDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.actionQueueArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.summaryRow}>
          {summaryItems.map(item => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, {color: item.accent}]}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryHint}>{item.hint}</Text>
            </View>
          ))}
        </View>
      </View>

      {(hasNoTasks || allDone) && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{hasNoTasks ? '📋' : '🎉'}</Text>
          <Text style={styles.emptyTitle}>
            {hasNoTasks ? '任务板是空的' : '任务已全部收口'}
          </Text>
          <Text style={styles.emptyDesc}>
            {hasNoTasks
              ? '向 AI 对话发送一条指令，系统会自动生成任务并开始追踪。'
              : '当前所有任务都已完成或已收口。系统在持续监听新的调度指令。'}
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.emptyPrimaryBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Tabs', {screen: 'Chat'})}
            >
              <Text style={styles.emptyPrimaryBtnText}>去对话发一条指令</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emptySecondaryBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DispatchChain')}
            >
              <Text style={styles.emptySecondaryBtnText}>查看调度链</Text>
            </TouchableOpacity>
          </View>
          {hasNoTasks && (
            <Text style={styles.emptyNote}>
              在「对话」或「上传」任意入口发送指令后，任务会自动出现在这里。
            </Text>
          )}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kanban}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
      >
        {COLUMNS.map(col => (
          <KanbanCol
            key={col.key}
            label={col.label}
            items={grouped[col.key]}
            color={col.color}
            onTaskPress={handleTaskPress}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const COL_W = 280;
const styles = StyleSheet.create({
  root:      {flex: 1, backgroundColor: C.bgRoot},
  header:    {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:     {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:       {color: C.textMuted, fontSize: 12, marginTop: 4},
  syncText:  {color: C.primary, fontSize: 11, marginTop: 8, fontWeight: '700'},
  helperText:{color: C.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16},
  focusBoard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(10,22,42,0.88)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  focusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  focusEyebrow: {color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1},
  focusTitle: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 4},
  focusDesc: {color: C.textBody, fontSize: 13, lineHeight: 20, marginTop: 10},
  focusActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.14)',
    borderWidth: 1,
    borderColor: '#f87171',
  },
  focusActionBtnText: {color: '#f87171', fontSize: 12, fontWeight: '900'},
  actionQueueList: {gap: 10, marginTop: 14},
  actionQueueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  actionQueueAccent: {width: 4, alignSelf: 'stretch', borderRadius: 999},
  actionQueueBody: {flex: 1},
  actionQueueTag: {fontSize: 10, fontWeight: '900', letterSpacing: 0.5},
  actionQueueTitle: {color: C.textTitle, fontSize: 13, fontWeight: '900', marginTop: 4},
  actionQueueDetail: {color: C.textBody, fontSize: 11, lineHeight: 17, marginTop: 5},
  actionQueueArrow: {color: C.textMuted, fontSize: 22, fontWeight: '300'},
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
  summaryValue: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 6},
  summaryHint: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5},
  kanban:    {paddingHorizontal: 16, paddingBottom: 100, flexDirection: 'row', gap: 12},
  col:       {width: COL_W},
  colHeader: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderTopWidth: 3, borderRadius: 12, marginBottom: 10,
  },
  colTitle: {fontSize: 15, fontWeight: '900'},
  colBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6,
  },
  colCount: {color: C.bgRoot, fontSize: 11, fontWeight: '900'},

  taskCard: {
    padding: 12, borderRadius: 20,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
    marginBottom: 8,
  },
  taskCardBlocked: {
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(136,19,55,0.18)',
  },
  confirmBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 1,
    borderColor: '#f87171',
  },
  confirmBadgeText: {color: '#f87171', fontSize: 10, fontWeight: '900'},
  tapHint: {color: '#f87171', fontSize: 10, marginTop: 6, fontWeight: '700'},
  taskTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 8,
  },
  taskTitle: {flex: 1, color: C.textTitle, fontSize: 13, fontWeight: '800'},
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999, marginTop: 6,
    backgroundColor: 'rgba(56,100,200,0.15)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  priorityP0: {backgroundColor: 'rgba(248,113,113,0.15)', borderColor: '#f87171'},
  priorityText: {color: C.primary, fontSize: 10, fontWeight: '800'},
  taskId:    {color: C.primary, fontSize: 10, marginTop: 6, fontWeight: '700'},
  metaBadgeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center'},
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  sourceBadgePurple: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#6366f1',
    borderWidth: 1, borderColor: '#6366f1',
  },
  sourceBadgeText: {color: C.textBody, fontSize: 10, fontWeight: '800'},
  taskMeta:  {color: C.textMuted, fontSize: 11, marginTop: 5},
  taskTrace: {color: C.primary, fontSize: 11, lineHeight: 16, marginTop: 5, fontWeight: '700'},
  taskNext:  {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 5},

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 14,
  },
  emptyEmoji: {fontSize: 52},
  emptyTitle: {color: C.textTitle, fontSize: 20, fontWeight: '900', textAlign: 'center'},
  emptyDesc: {color: C.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center'},
  emptyActions: {flexDirection: 'row', gap: 10, marginTop: 4},
  emptyPrimaryBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    backgroundColor: C.primary,
  },
  emptyPrimaryBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 13},
  emptySecondaryBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  emptySecondaryBtnText: {color: C.primary, fontWeight: '800', fontSize: 13},
  emptyNote: {
    color: C.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center',
    marginTop: 6, fontStyle: 'italic',
  },
});
