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

import {C, commandTraceMock, aiFeedMock} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {uploadService} from '../services/uploadService';
import {MetricCard} from '../components/MetricCard';
import {SectionTitle} from '../components/SectionTitle';
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
  GatewaySettings: undefined;
  Profile: undefined;
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
  const {
    agents,
    tasks,
    confirmations,
    dispatches,
    uploads,
    pendingConfirmations,
    refreshing,
    refresh,
    runtimeMode,
    injectDemoData,
    recentCaptures,
  } = useAppContext();

  const safeAgents = useMemo(() => Array.isArray(agents) ? agents : [], [agents]);
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeConfirmations = useMemo(() => Array.isArray(confirmations) ? confirmations : [], [confirmations]);
  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const safeUploads = useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);
  const pendingConfirmationItems = useMemo(
    () => safeConfirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred'),
    [safeConfirmations],
  );
  const uploadingCount = useMemo(() => safeUploads.filter(u => u.status === 'queued' || u.status === 'uploading' || u.status === 'processing').length, [safeUploads]);

  // Dynamic brain store entries driven by real context data — no hardcoded mock counts
  const brainStores = useMemo<BrainStore[]>(() => {
    const memorySignals = safeDispatches.filter(d => d.source === 'memory').length
      + safeTasks.filter(t => t.sourceType === 'memory').length;
    const knowledgeSignals = safeDispatches.filter(d => d.source === 'knowledge').length
      + safeTasks.filter(t => t.sourceType === 'knowledge').length;
    const projectSignals = safeDispatches.filter(d =>
      d.label?.includes('项目') || d.userText.includes('项目') || d.reply.includes('项目')).length;
    const fileSignals = safeUploads.length;

    return [
      {
        id: 'memory' as const,
        title: '记忆库',
        value: `${Math.min(99, memorySignals)} 条运行信号`,
        status: memorySignals > 0 ? 'active' as const : 'standby' as const,
        detail: '长期 + 短期记忆 · 搜索 · 新建',
        accent: '#a78bfa',
        screen: 'MemoryStore',
      },
      {
        id: 'knowledge' as const,
        title: '知识库',
        value: `${Math.min(99, knowledgeSignals)} 条运行信号`,
        status: knowledgeSignals > 0 ? 'active' as const : 'standby' as const,
        detail: '矿业 + 工程 + 技术 · 搜索 · 收录',
        accent: C.primary,
        screen: 'KnowledgeBase',
      },
      {
        id: 'project' as const,
        title: '项目库',
        value: projectSignals > 0 ? `${Math.min(99, projectSignals)} 条项目信号` : 'AIBrainIM / 聚源三维',
        status: projectSignals > 0 ? 'active' as const : 'standby' as const,
        detail: '移动端开发 · 智慧矿山 · OpenClaw',
        accent: '#34d399',
        screen: 'ProjectLibrary',
      },
      {
        id: 'file' as const,
        title: '附件库',
        value: fileSignals > 0 ? `${fileSignals} 个附件` : '暂无附件',
        status: fileSignals > 0 ? 'active' as const : 'standby' as const,
        detail: `图片 / 视频 / 文档 · ${uploadingCount} 个上传中`,
        accent: '#f97316',
        screen: 'FileLibrary',
      },
      {
        id: 'upload' as const,
        title: '上传入口',
        value: uploadingCount > 0 ? `${uploadingCount} 个上传中` : '随时可用',
        status: uploadingCount > 0 ? 'pending' as const : 'active' as const,
        detail: '图片 / 视频 / 文档 · AI 自动分派',
        accent: uploadingCount > 0 ? '#fbbf24' : '#38bdf8',
        screen: 'Upload',
      },
    ];
  }, [safeDispatches, safeTasks, safeUploads, uploadingCount]);

  const activeCount  = useMemo(() => safeAgents.filter(a => a.status === 'online' || a.status === 'working').length, [safeAgents]);
  const runningCount = useMemo(() => safeTasks.filter(t => t.state === 'running').length, [safeTasks]);
  const doneCount = useMemo(() => safeTasks.filter(t => t.state === 'done').length, [safeTasks]);
  const blockedCount = useMemo(() => safeTasks.filter(t => t.state === 'blocked').length, [safeTasks]);
  const dispatchActiveCount = useMemo(() => safeDispatches.filter(item => item.status === 'submitted' || item.status === 'dispatched' || item.status === 'processing').length, [safeDispatches]);
  const uploadDoneCount = useMemo(() => safeUploads.filter(u => u.status === 'done' || u.status === 'dispatched').length, [safeUploads]);

  const latestDispatch = safeDispatches[0];
  const latestDispatchMeta = latestDispatch ? DISPATCH_STATUS_META[latestDispatch.status] : null;
  const latestRunningTask = safeTasks.find(task => task.state === 'running');
  const latestBlockedConfirmation = pendingConfirmationItems[0];
  const hottestUpload = safeUploads.find(item => item.status === 'uploading' || item.status === 'processing' || item.status === 'dispatched');
  const focusDescription = latestDispatch
    ? `最新调度「${latestDispatchMeta?.label ?? latestDispatch.status}」：${latestDispatch.userText.slice(0, 42)}${latestDispatch.userText.length > 42 ? '…' : ''}`
    : latestRunningTask
      ? `当前最需要盯住的是「${latestRunningTask.title}」，它正在从任务流向结果交付收口。`
      : '当前没有进行中的调度单，系统运转正常。';
  const liveFeed = useMemo<AIFeedItem[]>(() => {
    const safeCaptures = Array.isArray(recentCaptures) ? recentCaptures : [];

    const dispatchFeed = safeDispatches.slice(0, 4).map((item, index) => ({
      id: `dispatch-${item.id}-${index}`,
      agent: `助理 · ${DISPATCH_STATUS_META[item.status].label}`,
      agentAccent: DISPATCH_STATUS_META[item.status].accent,
      text: item.reply,
      timestamp: new Date(item.createdAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
      type: item.status === 'failed' ? 'system' as const : item.status === 'completed' ? 'output' as const : 'dispatch' as const,
    }));

    const uploadFeed = safeUploads
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
        type: item.status === 'error' ? 'system' as const : 'upload' as const,
      }));

    const captureFeed = safeCaptures.slice(0, 4).map(entry => ({
      id: entry.id,
      agent: entry.type === 'knowledge' ? '📖 知识收录' : '🧠 记忆沉淀',
      agentAccent: entry.type === 'knowledge' ? C.primary : '#a78bfa',
      text: entry.savedRemotely
        ? `「${entry.title}」已收录到${entry.type === 'knowledge' ? '知识' : '记忆'}层${entry.category ? `（${entry.category}）` : ''}，并回流到任务流。`
        : `「${entry.title}」已先沉淀在本地闭环${entry.type === 'knowledge' ? '知识' : '记忆'}层。`,
      timestamp: new Date(entry.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
      type: entry.type as 'knowledge' | 'memory',
    }));

    const merged = [...captureFeed, ...dispatchFeed, ...uploadFeed];
    return merged.length ? merged.slice(0, 6) : aiFeedMock;
  }, [recentCaptures, safeDispatches, safeUploads]);

  const dispatchTrace = useMemo<CommandTrace[]>(() => {
    if (!safeDispatches.length) return commandTraceMock;
    const latest = safeDispatches[0];
    return [
      {stage:'receive', title:'接收指令', actor:'你 → 助理', detail: latest.userText},
      {stage:'dispatch', title:'生成调度单', actor:'助理 / Gateway', detail: `taskId=${latest.taskId ?? '未生成'} · dispatchId=${latest.dispatchId ?? '未生成'}`},
      {stage:'feedback', title:'状态回流', actor:'移动端', detail: latest.reply},
      {stage:'synthesis', title:'当前状态', actor:'调度链', detail: `${DISPATCH_STATUS_META[latest.status].label}${latest.sessionKey ? ` · session=${latest.sessionKey}` : ''}`},
      {stage:'deliver', title:'结果交付', actor:'APP', detail: latest.status === 'completed' ? '该调度单已完成，并已同步到任务流、调度链和 AI 产出流。' : latest.status === 'failed' ? '该调度单执行异常，已保留记录，建议查看调度链并重试。' : '该调度单已同步到任务流、调度链和 AI 产出流。'},
    ];
  }, [safeDispatches]);

  const actionQueue = useMemo(() => {
    const queue: Array<{
      id: string;
      tag: string;
      title: string;
      detail: string;
      accent: string;
      onPress: () => void;
    }> = [];

    if (latestDispatch && latestDispatchMeta) {
      queue.push({
        id: `dispatch-${latestDispatch.id}`,
        tag: 'AI 产出流',
        title: `先盯这条调度：${latestDispatchMeta.label}`,
        detail: latestDispatch.reply,
        accent: latestDispatchMeta.accent,
        onPress: () => navigation.navigate('DispatchChain'),
      });
    }

    if (latestBlockedConfirmation) {
      queue.push({
        id: `confirm-${latestBlockedConfirmation.id}`,
        tag: '需确认项',
        title: latestBlockedConfirmation.title,
        detail: latestBlockedConfirmation.description,
        accent: URGENCY_COLOR[latestBlockedConfirmation.urgency],
        onPress: () => navigation.navigate('Confirmations'),
      });
    }

    if (latestRunningTask) {
      queue.push({
        id: `task-${latestRunningTask.id}`,
        tag: '任务推进',
        title: latestRunningTask.title,
        detail: latestRunningTask.next,
        accent: C.working,
        onPress: () => navigation.navigate('DispatchChain'),
      });
    }

    if (hottestUpload) {
      queue.push({
        id: `upload-${hottestUpload.id}`,
        tag: '附件链路',
        title: `附件：${hottestUpload.name}`,
        detail: hottestUpload.status === 'processing'
          ? '后台正在处理这份附件，结果会继续回流到 AI 产出流。'
          : hottestUpload.status === 'dispatched'
            ? `已经分派给 ${hottestUpload.agent ?? '对应智能体'}，现在要盯执行结果。`
            : `当前进度 ${hottestUpload.progress}% ，前端上传链路保持在线。`,
        accent: '#34d399',
        onPress: () => navigation.navigate('Upload'),
      });
    }

    // If no dispatch/task/action items, surface pending confirmations as top priority
    if (!queue.length) {
      const unconfirmed = pendingConfirmationItems.slice(0, 2);
      if (unconfirmed.length > 0) {
        unconfirmed.forEach(item => {
          queue.push({
            id: `confirm-fallback-${item.id}`,
            tag: '需确认项',
            title: item.title,
            detail: item.description,
            accent: URGENCY_COLOR[item.urgency],
            onPress: () => navigation.navigate('Confirmations'),
          });
        });
      } else {
        queue.push({
          id: 'idle-default',
          tag: '下一步',
          title: '当前没有新的高优先动作',
          detail: '系统运转正常，可检查需确认项或继续与 AI 对话。',
          accent: C.primary,
          onPress: () => navigation.navigate('Confirmations'),
        });
      }
    }

    return queue.slice(0, 3);
  }, [hottestUpload, latestBlockedConfirmation, latestDispatch, latestDispatchMeta, latestRunningTask, navigation, pendingConfirmationItems]);

  const summaryCards = useMemo(() => {
    const summary: Array<{
      id: string;
      label: string;
      value: string;
      detail: string;
      accent: string;
    }> = [
      {
        id: 'dispatch',
        label: '调度闭环',
        value: dispatchActiveCount > 0 ? `${dispatchActiveCount} 条推进中` : '当前无堆积',
        detail: latestDispatchMeta
          ? `最新状态是「${latestDispatchMeta.label}」，移动端已经能持续回看调度链。`
          : '没有新的调度单压住首页，说明当前前台节奏是干净的。',
        accent: latestDispatchMeta?.accent ?? C.primary,
      },
      {
        id: 'task',
        label: '任务收口',
        value: runningCount > 0 ? `${runningCount} 条执行中 / ${doneCount} 条已完成` : `${doneCount} 条已完成`,
        detail: blockedCount > 0
          ? `还有 ${blockedCount} 条任务被确认链卡住，需要人工拍板后继续推进。`
          : '任务流已经能把执行中、完成态和人工阻塞态清楚分开。',
        accent: blockedCount > 0 ? C.highUrgency : C.working,
      },
      {
        id: 'upload',
        label: '附件链路',
        value: uploadingCount > 0 ? `${uploadingCount} 条处理中` : `${uploadDoneCount} 条已打通`,
        detail: uploadingCount > 0
          ? '前端上传、后台处理、智能体分派三段链路都在跑。'
          : '上传入口已经不只是按钮，处理结果会继续回流到 AI 产出流。',
        accent: '#34d399',
      },
    ];

    return summary;
  }, [blockedCount, dispatchActiveCount, doneCount, latestDispatchMeta, runningCount, uploadDoneCount, uploadingCount]);

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
            <Text style={styles.eyebrow}>AI 协作平台</Text>
            <Text style={styles.heroTitle}>智能协同中枢</Text>
            <Text style={styles.heroSub}>随时在线 · 任务自动流转 · 附件即传即用</Text>
          </View>
          <View style={styles.livePill}>
            <View style={[styles.liveDot, runtimeMode === 'fallback' && styles.liveDotFallback]} />
            <Text style={[styles.liveText, runtimeMode === 'fallback' && styles.liveTextFallback]}>
              {runtimeMode === 'live' ? '真实在线' : '回退模式'}
            </Text>
          </View>
        </View>
        <View style={styles.cornerAccent} />
      </View>

      {runtimeMode === 'fallback' && (
        <View style={styles.demoHintBanner}>
          <Text style={styles.demoHintIcon}>🛰️</Text>
          <View style={styles.demoHintText}>
            <Text style={styles.demoHintTitle}>尚未连接 OpenClaw Gateway</Text>
            <Text style={styles.demoHintSub}>
              {safeDispatches.length === 0
                ? '当前显示本地回退数据，先体验完整闭环可注入 Demo 数据'
                : 'Gateway 未连接，首页数据来自本地缓存'}
            </Text>
          </View>
          <View style={styles.demoHintActions}>
            <TouchableOpacity
              style={styles.demoInjectBtn}
              activeOpacity={0.8}
              onPress={() => {
                injectDemoData();
                const { enqueueDemoUpload } = require('../services/uploadService');
                enqueueDemoUpload(0);
                enqueueDemoUpload(2);
                refresh();
              }}
            >
              <Text style={styles.demoInjectBtnText}>注入 Demo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoSettingsBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('GatewaySettings')}
            >
              <Text style={styles.demoSettingsBtnText}>配置</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.metricsGrid}>
        <MetricCard label="活跃 Agent" value={`${activeCount}/${safeAgents.length}`} accent={C.accent} />
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

      <SectionTitle title="闭环摘要" hint="先判断现在是在产出、卡点，还是等待确认" />
      <View style={styles.summaryGrid}>
        {summaryCards.map(card => (
          <View key={card.id} style={styles.summaryCard}>
            <Text style={[styles.summaryLabel, {color: card.accent}]}>{card.label}</Text>
            <Text style={styles.summaryValue}>{card.value}</Text>
            <Text style={styles.summaryDetail}>{card.detail}</Text>
          </View>
        ))}
      </View>

      <SectionTitle title="现在要处理什么" hint="把 AI 产出流、调度状态、需确认项顶到最前" />
      <View style={styles.actionQueueList}>
        {actionQueue.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.actionQueueCard}
            activeOpacity={0.85}
            onPress={item.onPress}
          >
            <View style={[styles.actionQueueAccent, {backgroundColor: item.accent}]} />
            <View style={styles.actionQueueBody}>
              <Text style={[styles.actionQueueTag, {color: item.accent}]}>{item.tag}</Text>
              <Text style={styles.actionQueueTitle}>{item.title}</Text>
              <Text style={styles.actionQueueDetail} numberOfLines={3}>{item.detail}</Text>
            </View>
            <Text style={styles.actionQueueArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle title="AI 产出流" hint="实时 AI 输出与系统事件" />
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
        {pendingConfirmationItems.length > 0 ? pendingConfirmationItems.slice(0, 3).map(item => {
          return (
            <View key={item.id} style={styles.confirmCard}>
              <View style={[styles.confirmDot, {backgroundColor: URGENCY_COLOR[item.urgency]}]} />
              <View style={styles.confirmText}>
                <View style={styles.confirmHeaderRow}>
                  <Text style={styles.confirmTitle}>{item.title}</Text>
                  <View style={styles.confirmStatusBadge}>
                    <Text style={styles.confirmStatusText}>待确认</Text>
                  </View>
                </View>
                <Text style={styles.confirmDesc}>{item.description}</Text>
                <Text style={styles.confirmMeta}>{item.agent} · {item.timestamp}</Text>
              </View>
            </View>
          );
        }) : (
          <View style={styles.confirmEmptyCard}>
            <Text style={styles.confirmEmptyTitle}>当前没有待确认项</Text>
            <Text style={styles.confirmEmptyDesc}>人工拍板链路已清空，首页不会再把已处理事项继续顶成待办。</Text>
          </View>
        )}
      </View>

      <SectionTitle
        title="记忆 · 知识 · 附件 · 项目"
        hint="点击进入对应模块"
      />
      <View style={styles.storeGrid}>
        {brainStores.map(store => (
          <StoreCard key={store.id} store={store} onPress={handleStorePress} />
        ))}
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
  liveDotFallback: {backgroundColor: '#f97316'},
  liveText: {color: C.accent, fontSize: 11, fontWeight: '800'},
  liveTextFallback: {color: '#f97316'},
  cornerAccent: {
    position: 'absolute', bottom: -1, right: -1,
    width: 48, height: 48, borderTopLeftRadius: BR,
    backgroundColor: 'rgba(34,211,238,0.07)',
    borderTopWidth: 1, borderLeftWidth: 1,
    borderColor: 'rgba(34,211,238,0.2)',
  },

  metricsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14},
  demoHintBanner: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 12,
    gap: 10,
  },
  demoHintIcon: {fontSize: 22, marginBottom: 4},
  demoHintText: {flex: 1},
  demoHintTitle: {color: '#fbbf24', fontSize: 13, fontWeight: '700'},
  demoHintSub: {color: C.textMuted, fontSize: 11, marginTop: 3, lineHeight: 16},
  demoHintArrow: {color: '#fbbf24', fontSize: 20, fontWeight: '700'},
  demoHintActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  demoInjectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    alignItems: 'center',
  },
  demoInjectBtnText: {color: '#fbbf24', fontSize: 12, fontWeight: '900'},
  demoSettingsBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.15)',
    borderWidth: 1,
    borderColor: C.borderActive,
    alignItems: 'center',
  },
  demoSettingsBtnText: {color: C.primary, fontSize: 12, fontWeight: '900'},
  summaryGrid: {gap: 10, marginBottom: 2},
  summaryCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  summaryLabel: {fontSize: 11, fontWeight: '900', letterSpacing: 0.5},
  summaryValue: {color: C.textTitle, fontSize: 17, fontWeight: '900', marginTop: 6},
  summaryDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  actionQueueList: {gap: 10, marginBottom: 2},
  actionQueueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  actionQueueAccent: {width: 4, alignSelf: 'stretch', borderRadius: 999},
  actionQueueBody: {flex: 1},
  actionQueueTag: {fontSize: 11, fontWeight: '900', letterSpacing: 0.5},
  actionQueueTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900', marginTop: 4},
  actionQueueDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  actionQueueArrow: {color: C.textMuted, fontSize: 24, fontWeight: '300'},
  feedList: {gap: 9},
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
  confirmEmptyCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  confirmEmptyTitle: {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  confirmEmptyDesc: {color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6},

  footer: {height: 32},
});
