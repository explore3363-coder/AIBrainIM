import React from 'react';
import {ScrollView, Text, View, StyleSheet, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {TaskBadge} from '../components/TaskBadge';
import type {Task, TaskState} from '../types';

type RootStackParamList = {
  Tabs: undefined;
  Confirmations: undefined;
};

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

function TaskCard({task, onConfirmPress}: {task: Task; onConfirmPress?: () => void}) {
  const isConfirmation = task.state === 'blocked';
  return (
    <TouchableOpacity
      style={[styles.taskCard, isConfirmation && styles.taskCardBlocked]}
      activeOpacity={isConfirmation ? 0.7 : 1}
      onPress={isConfirmation ? onConfirmPress : undefined}
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
      <Text style={styles.taskId}>#{task.id}</Text>
      {task.priority && (
        <View style={[styles.priorityBadge, task.priority === 'P0' && styles.priorityP0]}>
          <Text style={styles.priorityText}>{task.priority}</Text>
        </View>
      )}
      <Text style={styles.taskMeta}>👤 {task.owner}</Text>
      <Text style={styles.taskMeta}>⏱ {task.eta} · {TASK_STATE_LABEL[task.state]}</Text>
      {task.sessionKey ? <Text style={styles.taskMeta}>🧷 {task.sessionKey}</Text> : null}
      {task.traceSummary ? <Text style={styles.taskTrace}>{task.traceSummary}</Text> : null}
      <Text style={styles.taskNext}>→ {task.next}</Text>
      {isConfirmation && (
        <Text style={styles.tapHint}>👆 点击前往确认</Text>
      )}
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
  label, items, color, onConfirmPress,
}: {
  label: string; items: Task[]; color: string;
  onConfirmPress?: () => void;
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
        <TaskCard key={task.id} task={task} onConfirmPress={onConfirmPress} />
      ))}
    </View>
  );
}

export function TaskScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {tasks, refreshing} = useAppContext();

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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>任务</Text>
        <Text style={styles.sub}>全局任务流 · 实时状态</Text>
        <Text style={styles.syncText}>{refreshing ? '任务状态同步中…' : '对话指令、附件上传链路、知识收录回流与任务看板已同步汇合'}</Text>
      </View>

      <View style={styles.focusBoard}>
        <View style={styles.focusTopRow}>
          <View>
            <Text style={styles.focusEyebrow}>TASK FOCUS</Text>
            <Text style={styles.focusTitle}>先处理最影响闭环的那一条</Text>
          </View>
          {grouped.blocked.length > 0 ? (
            <TouchableOpacity style={styles.focusActionBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Confirmations')}>
              <Text style={styles.focusActionBtnText}>去确认</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.focusDesc}>
          {topPriorityTask
            ? `当前最值得盯住的是「${topPriorityTask.title}」，下一步：${topPriorityTask.next}`
            : '暂无未完成任务'}</Text>

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kanban}
      >
        {COLUMNS.map(col => (
          <KanbanCol
            key={col.key}
            label={col.label}
            items={grouped[col.key]}
            color={col.color}
            onConfirmPress={col.key === 'blocked' ? () => navigation.navigate('Confirmations') : undefined}
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
  taskMeta:  {color: C.textMuted, fontSize: 11, marginTop: 5},
  taskTrace: {color: C.primary, fontSize: 11, lineHeight: 16, marginTop: 5, fontWeight: '700'},
  taskNext:  {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 5},
});
