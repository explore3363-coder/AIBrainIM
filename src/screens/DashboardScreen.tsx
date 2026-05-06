import React, {useMemo} from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {C, brainStoresMock, commandTraceMock, aiFeedMock} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {MetricCard} from '../components/MetricCard';
import {SectionTitle} from '../components/SectionTitle';
import {OverviewCard} from '../components/OverviewCard';
import {StoreCard} from '../components/StoreCard';
import {FeedItem} from '../components/FeedItem';
import type {BrainStore, AIFeedItem, CommandTrace} from '../types';

type RootStackParamList = {
  Tabs: undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  Upload: undefined;
  ProjectLibrary: undefined;
  Confirmations: undefined;
  DispatchChain: undefined;
};

const NAV_MAP: Record<string, keyof RootStackParamList> = {
  memory: 'MemoryStore',
  knowledge: 'KnowledgeBase',
  file: 'FileLibrary',
  project: 'ProjectLibrary',
  upload: 'Upload',
};

const URGENCY_COLOR: Record<string, string> = {
  high:   C.highUrgency,
  normal: C.normalUrgency,
  low:    C.lowUrgency,
};

const DISPATCH_STATUS_META = {
  submitted: {label: '已提交', accent: C.normalUrgency},
  dispatched: {label: '执行中', accent: C.primary},
  processing: {label: '处理中', accent: C.working},
  completed: {label: '已完成', accent: '#34d399'},
  failed: {label: '失败', accent: C.highUrgency},
} as const;

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {agents, tasks, confirmations, dispatches, uploads, pendingConfirmations, refreshing, refresh} = useAppContext();

  const activeCount  = useMemo(() => agents.filter(a => a.status === 'online' || a.status === 'working').length, [agents]);
  const runningCount = useMemo(() => tasks.filter(t => t.state === 'running').length, [tasks]);
  const blockedCount = useMemo(() => tasks.filter(t => t.state === 'blocked').length, [tasks]);
  const uploadingCount = useMemo(() => uploads.filter(u => u.status === 'queued' || u.status === 'uploading' || u.status === 'processing').length, [uploads]);

  const latestDispatch = dispatches[0];
  const latestDispatchMeta = latestDispatch ? DISPATCH_STATUS_META[latestDispatch.status] : null;
  const urgentConfirmation = confirmations.find(item => item.status !== 'confirmed' && item.status !== 'deferred');
  const latestRunningTask = tasks.find(task => task.state === 'running');
  const focusDescription = latestDispatch
    ? `最新一条 AI 调度当前为「${latestDispatchMeta?.label ?? latestDispatch.status}」：${latestDispatch.userText.slice(0, 42)}${latestDispatch.userText.length > 42 ? '…' : ''}`
    : latestRunningTask
      ? `当前最需要盯住的是「${latestRunningTask.title}」，它正在从任务流向结果交付收口。`
      : '当前没有新的调度单压进来，可以优先处理需确认项并继续补齐真实接口闭环。';

  const liveFeed = useMemo<AIFeedItem[]>(() => {
    const dispatchFeed = dispatches.slice(0, 4).map((item, index) => ({
      id: `dispatch-${item.id}-${index}`,
      agent: `助理 · ${DISPATCH_STATUS_META[item.status].label}`,
      agentAccent: DISPATCH_STATUS_META[item.status].accent,
      text: item.reply,
      timestamp: new Date(item.createdAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
      type: item.status === 'failed' ? 'system' as const : item.status === 'completed' ? 'output' as const : 'dispatch' as const,
    }));

    const uploadFeed = uploads
      .filter(item => item.status === 'dispatched' || item.status === 'error' || item.status === 'processing')
      .slice(-3)
      .reverse()
      .map(item => ({
        id: `upload-${item.id}`,
        agent: item.agent ?? '附件队列',
        agentAccent: item.status === 'error' ? C.highUrgency : '#34d399',
        text:
          item.status === 'error'
            ? `附件「${item.name}」处理失败：${item.error ?? '未知错误'}`
            : item.status === 'processing'
              ? `附件「${item.name}」已上传完成，正在进入后台处理队列。`
              : `附件「${item.name}」已分派给 ${item.agent ?? '对应智能体'}。`,
        timestamp: item.timestamp,
        type: item.status === 'error' ? 'system' as const : 'output' as const,
      }));

    const merged = [...dispatchFeed, ...uploadFeed];
    return merged.length ? merged.slice(0, 6) : aiFeedMock;
  }, [dispatches, uploads]);

  const dispatchTrace = useMemo<CommandTrace[]>(() => {
    if (!dispatches.length) return commandTraceMock;
    const latest = dispatches[0];
    return [
      {stage:'receive', title:'接收指令', actor:'你 → 助理', detail: latest.userText},
      {stage:'dispatch', title:'生成调度单', actor:'助理 / Gateway', detail: `taskId=${latest.taskId ?? '未生成'} · dispatchId=${latest.dispatchId ?? '未生成'}`},
      {stage:'feedback', title:'状态回流', actor:'移动端', detail: latest.reply},
      {stage:'synthesis', title:'当前状态', actor:'调度链', detail: `${DISPATCH_STATUS_META[latest.status].label}${latest.sessionKey ? ` · session=${latest.sessionKey}` : ''}`},
      {stage:'deliver', title:'结果交付', actor:'APP', detail: latest.status === 'completed' ? '该调度单已完成，并已同步到任务流、调度链和 AI 产出流。' : latest.status === 'failed' ? '该调度单执行异常，已保留记录，建议查看调度链并重试。' : '该调度单已同步到任务流、调度链和 AI 产出流。'},
    ];
  }, [dispatches]);

  const handleStorePress = (store: BrainStore) => {
    const screen = NAV_MAP[store.id];
    if (screen) navigation.navigate(screen);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={C.primary}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroGlass} />
        <View style={styles.heroBody}>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>AI 协作平台 · 智能体中枢</Text>
            <Text style={styles.heroTitle}>AI 协作驾驶舱</Text>
            <Text style={styles.heroSub}>对话 · 任务 · 记忆库 · 知识库 · 附件</Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>在线</Text>
          </View>
        </View>
        <View style={styles.cornerAccent} />
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard label="活跃 Agent" value={`${activeCount}/${agents.length}`} accent={C.accent} />
        <MetricCard label="进行中" value={`${runningCount}`} accent={C.working} />
        <MetricCard label="上传队列" value={`${uploadingCount}`} accent="#34d399" />
        <MetricCard label="需确认" value={`${pendingConfirmations}`} accent={C.highUrgency} />
      </View>

      <View style={styles.focusBoard}>
        <View style={styles.focusHeader}>
          <View>
            <Text style={styles.focusEyebrow}>TODAY FOCUS</Text>
            <Text style={styles.focusTitle}>先看 AI 产出，再看调度状态</Text>
          </View>
          <View style={styles.focusBadge}>
            <Text style={styles.focusBadgeText}>
              {latestDispatchMeta ? `最新调度：${latestDispatchMeta.label}` : blockedCount > 0 ? `${blockedCount} 项待处理` : '闭环正常'}
            </Text>
          </View>
        </View>
        <Text style={styles.focusDesc}>{focusDescription}</Text>
        <View style={styles.quickActionRow}>
          <TouchableOpacity style={styles.quickActionChip} activeOpacity={0.8} onPress={() => navigation.navigate('DispatchChain')}>
            <Text style={styles.quickActionText}>看调度链</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionChip} activeOpacity={0.8} onPress={() => navigation.navigate('Confirmations')}>
            <Text style={styles.quickActionText}>处理确认项</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionChip} activeOpacity={0.8} onPress={() => navigation.navigate('Upload')}>
            <Text style={styles.quickActionText}>看上传队列</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionTitle title="AI 产出流" hint="实时 AI 输出与系统事件" />
      <View style={styles.liveStatusBar}>
        <View style={styles.liveStatusItem}>
          <Text style={styles.liveStatusLabel}>数据源</Text>
          <Text style={styles.liveStatusValue}>{refreshing ? '同步中' : '实时运行中'}</Text>
        </View>
        <View style={styles.liveStatusDivider} />
        <View style={styles.liveStatusItem}>
          <Text style={styles.liveStatusLabel}>当前闭环</Text>
          <Text style={styles.liveStatusValue}>{latestDispatchMeta ? `总览 / 对话 / 智能体 / 任务 / 确认流 · ${latestDispatchMeta.label}` : '总览 / 对话 / 智能体 / 任务 / 确认流'}</Text>
        </View>
      </View>
      <View style={styles.feedList}>
        {liveFeed.map(item => <FeedItem key={item.id} item={item} />)}
      </View>

      <SectionTitle
        title="调度链"
        hint="当前指令流转状态"
        action={{label: '展开链路', onPress: () => navigation.navigate('DispatchChain')}}
      />
      <View style={styles.dispatchBox}>
        {dispatchTrace.map((trace, i) => (
          <View key={trace.stage} style={styles.dispatchStep}>
            <View style={[styles.dispatchDot, i === dispatchTrace.length - 1 && styles.dispatchDotLast]} />
            {i < dispatchTrace.length - 1 && <View style={styles.dispatchLine} />}
            <View style={styles.dispatchCard}>
              <Text style={styles.dispatchTitle}>{trace.title}</Text>
              <Text style={styles.dispatchActor}>{trace.actor}</Text>
              <Text style={styles.dispatchDetail}>{trace.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <SectionTitle
        title="需确认项"
        hint={`${pendingConfirmations} 项待确认`}
        action={{label: '查看全部', onPress: () => navigation.navigate('Confirmations')}}
      />
      <View style={styles.confirmList}>
        {confirmations.slice(0, 3).map(item => {
          const status = item.status ?? 'pending';
          const statusLabel = status === 'confirmed' ? '已确认' : status === 'deferred' ? '已延后' : '待确认';
          return (
            <View key={item.id} style={styles.confirmCard}>
              <View style={[styles.confirmDot, {backgroundColor: URGENCY_COLOR[item.urgency]}]} />
              <View style={styles.confirmText}>
                <View style={styles.confirmHeaderRow}>
                  <Text style={styles.confirmTitle}>{item.title}</Text>
                  <View style={styles.confirmStatusBadge}>
                    <Text style={styles.confirmStatusText}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={styles.confirmDesc}>{item.description}</Text>
                <Text style={styles.confirmMeta}>{item.agent} · {item.timestamp}</Text>
                {item.resolutionNote ? (
                  <Text style={styles.confirmResolution}>{item.resolutionNote}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <SectionTitle
        title="记忆 · 知识 · 附件 · 项目"
        hint="点击进入对应模块"
      />
      <View style={styles.storeGrid}>
        {brainStoresMock.map(store => (
          <StoreCard key={store.id} store={store} onPress={handleStorePress} />
        ))}
      </View>

      <SectionTitle title="总览" hint="核心状态一览" />
      <View style={styles.overviewGrid}>
        <OverviewCard
          title="AI 产出" value={`${liveFeed.length} 条最新产出`}
          detail="AI 回复、附件处理结果、任务状态更新实时汇入"
          accent={C.accent}
        />
        <OverviewCard
          title="附件处理" value={`${uploads.length} 条记录`}
          detail="支持大文件分片上传，后台自动处理，智能体分派"
          accent="#34d399"
        />
        <OverviewCard
          title="需确认项" value={`${pendingConfirmations} 项待处理`}
          detail="AI 调度决策需您确认后可继续推进，请及时处理"
          accent="#f97316"
        />
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const BR = 24;
const styles = StyleSheet.create({
  content: {padding: 16, paddingBottom: 100},

  hero: {
    borderRadius: BR + 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,18,36,0.9)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    position: 'relative',
  },
  heroGlass: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(56,100,200,0.06)',
    borderRadius: BR + 4,
  },
  heroBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 22,
  },
  heroText: {flex: 1, paddingRight: 12},
  eyebrow: {color: C.accent, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', marginBottom: 10},
  heroTitle: {color: C.textTitle, fontSize: 30, fontWeight: '900', letterSpacing: -0.5},
  heroSub: {color: C.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7},
  livePill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1, borderColor: C.accent,
  },
  liveDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginRight: 6},
  liveText: {color: C.accent, fontSize: 11, fontWeight: '800'},
  cornerAccent: {
    position: 'absolute', bottom: -1, right: -1,
    width: 48, height: 48, borderTopLeftRadius: BR,
    backgroundColor: 'rgba(34,211,238,0.07)',
    borderTopWidth: 1, borderLeftWidth: 1,
    borderColor: 'rgba(34,211,238,0.2)',
  },

  metricsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14},
  feedList: {gap: 9},
  liveStatusBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.56)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  liveStatusItem: {flex: 1},
  liveStatusLabel: {color: C.textMuted, fontSize: 11, fontWeight: '700'},
  liveStatusValue: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 4, fontWeight: '700'},
  liveStatusDivider: {width: 1, backgroundColor: C.borderSubtle},
  confirmList: {gap: 9},
  storeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  overviewGrid: {gap: 10},

  focusBoard: {
    marginTop: 16,
    padding: 16,
    borderRadius: BR,
    backgroundColor: 'rgba(10,22,42,0.88)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  focusEyebrow: {color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1},
  focusTitle: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 4},
  focusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
  },
  focusBadgeText: {color: '#f97316', fontSize: 11, fontWeight: '900'},
  focusDesc: {color: C.textBody, fontSize: 13, lineHeight: 20, marginTop: 10},
  quickActionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  quickActionChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  quickActionText: {color: C.primary, fontSize: 12, fontWeight: '800'},

  dispatchBox: {
    padding: 12,
    borderRadius: BR,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  dispatchStep: {flexDirection: 'row'},
  dispatchDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.primary,
    marginTop: 16,
    marginRight: 12,
  },
  dispatchDotLast: {backgroundColor: C.accent},
  dispatchLine: {
    width: 2, flex: 1,
    backgroundColor: 'rgba(56,100,200,0.25)',
    marginRight: 10,
  },
  dispatchCard: {
    flex: 1, marginBottom: 10, padding: 13, borderRadius: 18,
    backgroundColor: 'rgba(16,31,51,0.65)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  dispatchTitle: {color: C.textTitle, fontWeight: '900', fontSize: 15},
  dispatchActor: {color: C.accent, fontWeight: '800', fontSize: 11, marginTop: 4},
  dispatchDetail: {color: C.textBody, fontSize: 13, lineHeight: 19, marginTop: 5},

  confirmCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  confirmDot: {width: 8, height: 8, borderRadius: 4, marginTop: 6},
  confirmText: {flex: 1},
  confirmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  confirmTitle: {flex: 1, color: C.textTitle, fontSize: 14, fontWeight: '800'},
  confirmStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  confirmStatusText: {color: C.primary, fontSize: 10, fontWeight: '800'},
  confirmDesc: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 3},
  confirmMeta: {color: C.textMuted, fontSize: 11, marginTop: 4},
  confirmResolution: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5},

  footer: {height: 32},
});
