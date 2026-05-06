import React, {useMemo} from 'react';
import {ScrollView, Text, View, StyleSheet, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {TaskBadge} from '../components/TaskBadge';
import type {Task, TaskState} from '../types';
import type {UploadFile} from '../services/uploadService';

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
      <Text style={styles.taskMeta}>⏱ {task.eta}</Text>
      <Text style={styles.taskNext}>→ {task.next}</Text>
      {isConfirmation && (
        <Text style={styles.tapHint}>👆 点击前往确认</Text>
      )}
    </TouchableOpacity>
  );
}

function uploadToTask(upload: UploadFile): Task {
  const state: TaskState =
    upload.status === 'error' ? 'blocked'
    : upload.status === 'done' ? 'done'
    : upload.status === 'queued' ? 'todo'
    : 'running';

  const eta =
    upload.status === 'queued' ? '排队中'
    : upload.status === 'uploading' ? `${Math.round(upload.progress)}%`
    : upload.status === 'processing' ? '后台处理中'
    : upload.status === 'dispatched' ? '已分派'
    : upload.status === 'done' ? '已完成'
    : '失败';

  const next =
    upload.status === 'queued' ? '等待开始上传'
    : upload.status === 'uploading' ? '上传分片 / 直传进行中'
    : upload.status === 'processing' ? '后台解析附件内容'
    : upload.status === 'dispatched' ? `已进入 ${upload.agent ?? '对应智能体'} 处理队列`
    : upload.status === 'done' ? `附件闭环完成${upload.agent ? ` · ${upload.agent}` : ''}`
    : `上传失败：${upload.error ?? '未知错误'}`;

  return {
    id: `upload-${upload.id}`,
    title: `附件：${upload.name}`,
    owner: upload.agent ? `${upload.agent} / 附件链路` : '附件链路',
    state,
    eta,
    next,
    priority: upload.type === 'video' || upload.type === 'archive' ? 'P1' : 'P2',
  };
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
  const {tasks, uploads, refreshing} = useAppContext();

  const mergedTasks = useMemo(() => {
    const uploadTasks = uploads.map(uploadToTask);
    return [...uploadTasks, ...tasks];
  }, [tasks, uploads]);

  const grouped = useMemo(() => {
    const g: Record<TaskState, Task[]> = {running: [], todo: [], done: [], blocked: []};
    mergedTasks.forEach(t => g[t.state].push(t));
    return {
      running: sortTasksByPriority(g.running),
      todo: sortTasksByPriority(g.todo),
      done: sortTasksByPriority(g.done),
      blocked: sortTasksByPriority(g.blocked),
    };
  }, [mergedTasks]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>任务</Text>
        <Text style={styles.sub}>全局任务流 · 实时状态</Text>
        <Text style={styles.syncText}>{refreshing ? '任务状态同步中…' : '对话指令、附件上传链路与任务看板已同步汇合'}</Text>
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
  taskNext:  {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 5},
});
