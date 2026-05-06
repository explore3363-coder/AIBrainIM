import React, {useMemo} from 'react';
import {Text, View, StyleSheet, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C, commandTraceMock} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import type {CommandTrace, DispatchRecord} from '../types';

const STATUS_META: Record<DispatchRecord['status'], {label: string; accent: string; summary: string}> = {
  submitted: {label: '已提交', accent: '#fbbf24', summary: '等待助理拆解'},
  dispatched: {label: '执行中', accent: C.primary, summary: '已进入子 Agent 执行'},
  processing: {label: '处理中', accent: C.working, summary: '后台继续处理'},
  completed: {label: '已完成', accent: '#34d399', summary: '结果已回流移动端'},
  failed: {label: '执行失败', accent: C.highUrgency, summary: '需要回看调度链或重试'},
};

export function DispatchChainScreen() {
  const {dispatches} = useAppContext();

  const latestDispatch = dispatches[0];
  const latestMeta = latestDispatch ? STATUS_META[latestDispatch.status] : null;

  const traces = useMemo<CommandTrace[]>(() => {
    if (!dispatches.length) return commandTraceMock;
    const latest = dispatches[0];
    const statusLabel = STATUS_META[latest.status].summary;

    return [
      {stage:'receive', title:'接收指令', actor:'你 → 助理', detail: latest.userText},
      {stage:'dispatch', title:'生成调度单', actor:'助理 / Gateway', detail: `taskId=${latest.taskId ?? '未生成'} · dispatchId=${latest.dispatchId ?? '未生成'}`},
      {stage:'feedback', title:'状态回流', actor:'移动端', detail: latest.reply},
      {stage:'synthesis', title:'当前状态', actor:'调度链', detail: `${statusLabel}${latest.sessionKey ? ` · session=${latest.sessionKey}` : ''}`},
      {stage:'deliver', title:'结果交付', actor:'APP', detail: latest.status === 'completed' ? '该调度单已完成，并已同步到任务流、调度链与首页 AI 产出流。' : latest.status === 'failed' ? '该调度单执行失败，已保留现场记录，建议查看链路后重试。' : '该调度单已同步到任务流、调度链与首页 AI 产出流，可继续追踪后续状态。'},
    ];
  }, [dispatches]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🔗 调度链</Text>
        <Text style={styles.sub}>指令从接收到交付的完整流转</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {latestDispatch ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>最新调度单</Text>
            <View style={styles.statusRow}>
              <Text style={styles.summaryText}>taskId: {latestDispatch.taskId ?? '未生成'}</Text>
              {latestMeta ? (
                <View style={[styles.statusBadge, {borderColor: latestMeta.accent, backgroundColor: `${latestMeta.accent}22`}]}>
                  <Text style={[styles.statusBadgeText, {color: latestMeta.accent}]}>{latestMeta.label}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.summaryText}>dispatchId: {latestDispatch.dispatchId ?? '未生成'}</Text>
            <Text style={styles.summaryText}>status: {latestDispatch.status}</Text>
            {latestDispatch.agentId ? <Text style={styles.summaryText}>agent: {latestDispatch.agentId}</Text> : null}
            {latestDispatch.stageText ? <Text style={styles.summaryText}>stage: {latestDispatch.stageText}</Text> : null}
            <Text style={styles.summaryHint}>{latestMeta?.summary}</Text>
            {latestDispatch.sessionKey ? (
              <Text style={styles.summaryText}>session: {latestDispatch.sessionKey}</Text>
            ) : null}
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

        {dispatches.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>最近调度记录</Text>
            {dispatches.slice(0, 6).map(item => {
              const meta = STATUS_META[item.status];
              return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyText} numberOfLines={2}>{item.userText}</Text>
                    <View style={[styles.historyBadge, {borderColor: meta.accent, backgroundColor: `${meta.accent}22`}]}>
                      <Text style={[styles.historyBadgeText, {color: meta.accent}]}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyMeta}>taskId={item.taskId ?? '—'} · dispatchId={item.dispatchId ?? '—'}</Text>
                  <Text style={styles.historyMeta}>status={item.status}{item.sessionKey ? ` · session=${item.sessionKey}` : ''}{item.agentId ? ` · agent=${item.agentId}` : ''}</Text>
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
  summaryCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  summaryEyebrow: {color: C.accent, fontSize: 11, fontWeight: '900', marginBottom: 8, letterSpacing: 1},
  statusRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
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
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(16,31,51,0.48)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  historyBadgeText: {fontSize: 10, fontWeight: '900'},
  historyText: {flex: 1, color: C.textTitle, fontSize: 13, fontWeight: '800'},
  historyMeta: {color: C.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16},
  historyReply: {color: C.textBody, fontSize: 12, marginTop: 6, lineHeight: 18},
});
