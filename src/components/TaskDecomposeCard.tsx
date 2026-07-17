import React, {memo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {C} from '../data/constants';
import type {SubTask} from '../types';

const AGENT_ACCENT: Record<string, string> = {
  zhuli:   C.zhuli,
  renzhi:  C.renzhi,
  xunlong: C.xunlong,
  wuyin:   C.wuyin,
  tansuo:  C.tansuo,
  zhilian: C.zhilian,
  heijin:  C.heijin,
  kaifa:   C.kaifa,
};

function getAccent(agentId?: string): string {
  if (!agentId) return C.primary;
  return AGENT_ACCENT[agentId] ?? C.primary;
}

function SubTaskRow({subTask}: {subTask: SubTask}) {
  const accent = getAccent(subTask.agentId);

  const statusIcon =
    subTask.status === 'done'    ? '✅' :
    subTask.status === 'running' ? '⚡' :
    subTask.status === 'error'   ? '❌' : '○';

  const statusColor =
    subTask.status === 'done'    ? C.success :
    subTask.status === 'running' ? C.warning :
    subTask.status === 'error'   ? C.error  : C.textMuted;

  return (
    <View style={styles.subTaskRow}>
      <View style={[styles.agentAvatar, {backgroundColor: accent + '30', borderColor: accent}]}>
        <Text style={[styles.agentAvatarText, {color: accent}]}>
          {subTask.agentName.slice(0, 1)}
        </Text>
      </View>
      <View style={styles.subTaskContent}>
        <Text style={styles.subTaskTitle} numberOfLines={1}>{subTask.title}</Text>
        <Text style={styles.subTaskAgent} numberOfLines={1}>
          {subTask.agentName}
        </Text>
      </View>
      <Text style={[styles.subTaskStatus, {color: statusColor}]}>{statusIcon}</Text>
    </View>
  );
}

export interface TaskDecomposeCardProps {
  mainTaskTitle: string;
  subTasks: SubTask[];
  agentName?: string;
  agentId?: string;
  timestamp: number;
}

export const TaskDecomposeCard = memo(function TaskDecomposeCard({
  mainTaskTitle,
  subTasks,
  agentName,
  agentId,
  timestamp,
}: TaskDecomposeCardProps) {
  const accent = getAccent(agentId);
  const timeStr = (() => {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  })();

  const doneCount  = subTasks.filter(s => s.status === 'done').length;
  const totalCount = subTasks.length;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.decomposeIcon}>🔱</Text>
          <View>
            <Text style={styles.cardTitle}>任务拆解</Text>
            <Text style={[styles.agentTag, {color: accent}]} numberOfLines={1}>
              {agentName ?? 'AI'}
            </Text>
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={styles.progress}>
            {doneCount}/{totalCount}
          </Text>
          <Text style={styles.timeTag}>{timeStr}</Text>
        </View>
      </View>

      {/* Main task */}
      <View style={[styles.mainTaskBar, {borderLeftColor: accent}]}>
        <Text style={styles.mainTaskLabel}>主任务</Text>
        <Text style={styles.mainTaskTitle} numberOfLines={2}>{mainTaskTitle}</Text>
      </View>

      {/* Arrow */}
      <View style={styles.arrowRow}>
        <View style={styles.arrowLine} />
        <Text style={styles.arrowText}>拆解为 {totalCount} 个子任务</Text>
        <View style={styles.arrowLine} />
      </View>

      {/* Subtasks */}
      <View style={styles.subTaskList}>
        {subTasks.map(subTask => (
          <SubTaskRow key={subTask.id} subTask={subTask} />
        ))}
      </View>

      {/* AI Parsed Task Confirmation */}
      <View style={styles.confirmRow}>
        <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.8}>
          <Text style={styles.confirmBtnText}>✓ Confirm Task</Text>
        </TouchableOpacity>
        <Text style={styles.confirmHint}>确认后自动分派给 AI Agent</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(14,24,42,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(77,255,136,0.15)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  decomposeIcon: {fontSize: 22},
  cardTitle: {
    color: C.textTitle,
    fontSize: 15,
    fontWeight: '900',
  },
  agentTag: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  progress: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  timeTag: {
    color: C.textMuted,
    fontSize: 10,
  },

  mainTaskBar: {
    marginHorizontal: 14,
    paddingLeft: 10,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  mainTaskLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  mainTaskTitle: {
    color: C.textTitle,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },

  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 6,
  },
  arrowLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(77,255,136,0.2)',
  },
  arrowText: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '800',
  },

  subTaskList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
  },
  subTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  agentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarText: {
    fontSize: 10,
    fontWeight: '900',
  },
  subTaskContent: {
    flex: 1,
  },
  subTaskTitle: {
    color: C.textBody,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  subTaskAgent: {
    color: C.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  subTaskStatus: {
    fontSize: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(77,255,136,0.15)',
    gap: 12,
  },
  confirmBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnText: {
    color: C.bgRoot,
    fontSize: 14,
    fontWeight: '900',
  },
  confirmHint: {
    color: C.textMuted,
    fontSize: 11,
    flex: 1,
  },
});
