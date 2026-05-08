import React, {useMemo, useState} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import type {DispatchRecord, Task} from '../types';

type RootStackParamList = {
  Tabs: {screen?: 'Dashboard' | 'Chat' | 'Agent' | 'Tasks' | 'Profile'} | undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  ProjectLibrary: undefined;
  DispatchChain: {focusDispatchId?: string; focusTaskId?: string; focusSessionKey?: string} | undefined;
  Confirmations: {focusConfirmationId?: string; focusTaskId?: string; focusDispatchId?: string} | undefined;
  Upload: {focusFileId?: string; focusDispatchId?: string} | undefined;
  GatewaySettings: undefined;
};

type ProjectRoute = {
  screen: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
};

interface Project {
  id: string;
  name: string;
  domain: 'mobile' | 'mining' | 'infra';
  description: string;
  progress: number; // 0-100
  owner: string;
  priority: 'P0' | 'P1' | 'P2';
  updatedAt: string;
  statusLine: string;
  focus: string;
  primaryRoute: ProjectRoute;
  cta: string;
  secondaryRoute?: ProjectRoute;
  secondaryCta?: string;
}

const PROJECT_CATALOG: Project[] = [
  {
    id: 'p1',
    name: 'AIBrainIM 移动端',
    domain: 'mobile',
    description: 'AI 大脑驾驶舱移动端 Alpha，React Native 0.85 + OpenClaw',
    progress: 95,
    owner: '黑金',
    priority: 'P0',
    updatedAt: '2026-05-08',
    statusLine: 'P1 代码已完全收口：TypeScript ✅ / Jest 91 tests ✅ / iOS Build ✅，等待 Apple Developer 账号即可触发 TestFlight。',
    focus: '总览 / 对话 / 智能体 / 任务 / 我的',
    primaryRoute: {screen: 'Tabs'},
    cta: '回到首页看驾驶舱',
  },
  {
    id: 'p2',
    name: '聚源三维智慧矿山',
    domain: 'mining',
    description: '数字孪生矿山项目，含采掘优化、无人化与三维可视化',
    progress: 40,
    owner: '无垠',
    priority: 'P0',
    updatedAt: '2026-05-05',
    statusLine: '地形、建筑、井下网络已接入，当前主要盯视觉验收与坐标精度。',
    focus: '三维地形 / 建筑 / 井下网络',
    primaryRoute: {screen: 'DispatchChain'},
    cta: '去看调度链',
  },
  {
    id: 'p3',
    name: 'OpenClaw Agent Runtime',
    domain: 'infra',
    description: 'Gateway · Node 连接 · Skill 调度 · Memory API',
    progress: 90,
    owner: '助理',
    priority: 'P0',
    updatedAt: '2026-05-08',
    statusLine: 'Gateway 直连会话已支持，Feishu 回退完整，上传/记忆/知识三链路全部就绪，等 Apple 账号打通真机闭环。',
    focus: 'Gateway / Session / Dispatch',
    primaryRoute: {screen: 'GatewaySettings'},
    cta: '检查 Gateway 连接',
  },
  {
    id: 'p4',
    name: '钨矿研判知识库',
    domain: 'mining',
    description: '钨价、政策、全球供应链研判知识库与向量检索',
    progress: 55,
    owner: '寻龙',
    priority: 'P1',
    updatedAt: '2026-05-04',
    statusLine: '价格与政策双线更新，正从资料库向可复用判断库收口。',
    focus: '价格 / 政策 / 信源',
    primaryRoute: {screen: 'KnowledgeBase'},
    cta: '打开知识库',
  },
  {
    id: 'p5',
    name: '选矿工艺专家系统',
    domain: 'mining',
    description: 'XRT、磨浮、回收率、药剂的 AI 辅助判断系统',
    progress: 30,
    owner: '探索',
    priority: 'P1',
    updatedAt: '2026-05-03',
    statusLine: '工艺参数已开始结构化，后续要把项目与任务流真正串起来。',
    focus: 'XRT / 浮选 / 回收率',
    primaryRoute: {screen: 'Tabs', params: {screen: 'Agent'}},
    cta: '看智能体状态',
  },
];

const DOMAIN_META: Record<Project['domain'], {emoji: string; label: string; color: string}> = {
  mobile: {emoji: '📱', label: '移动端', color: C.primary},
  mining: {emoji: '⛏️', label: '矿业', color: '#fbbf24'},
  infra: {emoji: '🏗️', label: '基础', color: '#34d399'},
};

const PRIORITY_COLOR: Record<Project['priority'], string> = {
  P0: '#f87171',
  P1: C.normalUrgency,
  P2: C.lowUrgency,
};

const FILTER_DOMAINS = ['全部', '移动端', '矿业', '基础'] as const;
type FilterDomain = typeof FILTER_DOMAINS[number];

type RuntimeProjectKey = 'aibrainim' | 'juyuan' | 'runtime';

type ProjectFocusCue = {
  id: string;
  title: string;
  detail: string;
  accent: string;
  cta: string;
  route: ProjectRoute;
};

function normalizeProjectText(value: string | undefined): string {
  return (value ?? '').toLowerCase();
}

function detectRuntimeProjectFromText(value: string | undefined): RuntimeProjectKey | null {
  const text = normalizeProjectText(value);
  if (!text) return null;

  if (
    text.includes('aibrainim')
    || text.includes('移动端')
    || text.includes('react native')
    || text.includes('testflight')
    || text.includes('app store')
    || text.includes('appstore')
  ) {
    return 'aibrainim';
  }

  if (
    text.includes('聚源')
    || text.includes('三维')
    || text.includes('智慧矿山')
    || text.includes('数字孪生')
    || text.includes('井下')
    || text.includes('矿体')
  ) {
    return 'juyuan';
  }

  if (
    text.includes('gateway')
    || text.includes('openclaw')
    || text.includes('runtime')
    || text.includes('dispatch')
    || text.includes('session')
    || text.includes('agent')
    || text.includes('调度')
  ) {
    return 'runtime';
  }

  return null;
}

function detectRuntimeProjectFromTask(task: Task): RuntimeProjectKey | null {
  return detectRuntimeProjectFromText([
    task.title,
    task.owner,
    task.next,
    task.traceSummary,
    task.sessionKey,
    task.agentId,
  ].join(' '));
}

function detectRuntimeProjectFromDispatch(dispatch: DispatchRecord): RuntimeProjectKey | null {
  return detectRuntimeProjectFromText([
    dispatch.userText,
    dispatch.reply,
    dispatch.label,
    dispatch.sessionKey,
    dispatch.agentId,
  ].join(' '));
}

function clampProgress(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function ProgressBar({value, color}: {value: number; color: string}) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, {width: `${value}%`, backgroundColor: color}]} />
    </View>
  );
}

function openScreen(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  route: ProjectRoute,
) {
  if (route.screen === 'Tabs') {
    navigation.navigate('Tabs', route.params as RootStackParamList['Tabs']);
    return;
  }

  switch (route.screen) {
    case 'MemoryStore':
      navigation.navigate('MemoryStore');
      return;
    case 'KnowledgeBase':
      navigation.navigate('KnowledgeBase');
      return;
    case 'FileLibrary':
      navigation.navigate('FileLibrary');
      return;
    case 'ProjectLibrary':
      navigation.navigate('ProjectLibrary');
      return;
    case 'DispatchChain':
      navigation.navigate('DispatchChain', route.params as RootStackParamList['DispatchChain']);
      return;
    case 'Confirmations':
      navigation.navigate('Confirmations', route.params as RootStackParamList['Confirmations']);
      return;
    case 'Upload':
      navigation.navigate('Upload', route.params as RootStackParamList['Upload']);
      return;
    case 'GatewaySettings':
      navigation.navigate('GatewaySettings');
      return;
    default:
      return;
  }
}

export function ProjectLibraryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeDomain, setActiveDomain] = useState<FilterDomain>('全部');
  const {tasks, uploads, dispatches, confirmations, agents} = useAppContext();

  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeUploads = useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);
  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const safeConfirmations = useMemo(() => Array.isArray(confirmations) ? confirmations : [], [confirmations]);
  const safeAgents = useMemo(() => Array.isArray(agents) ? agents : [], [agents]);

  const runtimeProjects = useMemo<Project[]>(() => {
    const items: Project[] = [];

    const runningTaskCount = safeTasks.filter(task => task.state === 'running').length;
    const blockedTaskCount = safeTasks.filter(task => task.state === 'blocked').length;
    const doneTaskCount = safeTasks.filter(task => task.state === 'done').length;
    const activeUploadCount = safeUploads.filter(file => file.status === 'queued' || file.status === 'uploading' || file.status === 'processing').length;
    const latestDispatch = safeDispatches[0];
    const pendingConfirmations = safeConfirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length;
    const onlineAgents = safeAgents.filter(agent => agent.status === 'online' || agent.status === 'working').length;
    const workingAgents = safeAgents.filter(agent => agent.status === 'working').length;
    const latestDate = new Date().toLocaleDateString('zh-CN');

    const aibrainTasks = safeTasks.filter(task => detectRuntimeProjectFromTask(task) === 'aibrainim');
    const aibrainDispatches = safeDispatches.filter(dispatch => detectRuntimeProjectFromDispatch(dispatch) === 'aibrainim');
    const aibrainUploads = safeUploads.filter(file => detectRuntimeProjectFromText(`${file.name} ${file.agent ?? ''}`) === 'aibrainim');
    const aibrainBlocked = aibrainTasks.filter(task => task.state === 'blocked').length;

    const juyuanTasks = safeTasks.filter(task => detectRuntimeProjectFromTask(task) === 'juyuan');
    const juyuanDispatches = safeDispatches.filter(dispatch => detectRuntimeProjectFromDispatch(dispatch) === 'juyuan');
    const juyuanBlocked = juyuanTasks.filter(task => task.state === 'blocked').length;
    const juyuanRunning = juyuanTasks.filter(task => task.state === 'running').length;

    const runtimeTasks = safeTasks.filter(task => detectRuntimeProjectFromTask(task) === 'runtime');
    const runtimeDispatches = safeDispatches.filter(dispatch => detectRuntimeProjectFromDispatch(dispatch) === 'runtime');
    const runtimeBlocked = runtimeTasks.filter(task => task.state === 'blocked').length;

    items.push({
      id: 'runtime-mobile',
      name: 'AIBrainIM P1 实时闭环',
      domain: 'mobile',
      description: `已识别 ${aibrainTasks.length} 个移动端相关任务、${aibrainDispatches.length} 条调度、${aibrainUploads.length} 个相关附件，项目库开始按真实运行态自动归并，不再只是静态样板。`,
      progress: clampProgress(62 + aibrainTasks.length * 5 + aibrainDispatches.length * 6 + aibrainUploads.length * 4 - aibrainBlocked * 8, 36, 98),
      owner: '黑金 / 助理',
      priority: 'P0',
      updatedAt: latestDate,
      statusLine: aibrainDispatches.length > 0 ? `当前已看到 ${aibrainDispatches.length} 条移动端闭环调度信号。` : '当前还缺少更多真实移动端调度样本。',
      focus: '总览 / 对话 / 上传 / 上线闭环',
      primaryRoute: {screen: 'Tabs', params: {screen: 'Dashboard'}},
      cta: '回首页看总览',
      secondaryCta: '看上传队列',
      secondaryRoute: {screen: 'Upload'},
    });

    items.push({
      id: 'runtime-juyuan',
      name: '聚源三维运行投影',
      domain: 'mining',
      description: `已识别 ${juyuanTasks.length} 个聚源三维相关任务、${juyuanDispatches.length} 条调度信号，项目页现在能把数字孪生链路单独拎出来看，而不是混在总任务池里。`,
      progress: clampProgress(42 + juyuanRunning * 10 + juyuanDispatches.length * 8 - juyuanBlocked * 9, 24, 96),
      owner: '无垠 / 助理',
      priority: 'P0',
      updatedAt: latestDate,
      statusLine: juyuanRunning > 0 ? `当前有 ${juyuanRunning} 条矿山/三维任务仍在推进。` : '当前没有活跃中的聚源三维任务信号。',
      focus: '数字孪生 / 矿体 / 井下 / 验收',
      primaryRoute: {screen: 'DispatchChain'},
      cta: '去看调度链',
    });

    items.push({
      id: 'runtime-infra',
      name: 'OpenClaw 调度接入状态',
      domain: 'infra',
      description: runtimeDispatches.length > 0
        ? `已识别 ${runtimeDispatches.length} 条 Runtime / Gateway 相关调度，最近状态为 ${latestDispatch?.status ?? 'unknown'}，说明移动端已开始承接真实调度回流。`
        : latestDispatch
          ? `最近一条调度单状态为 ${latestDispatch.status}，taskId=${latestDispatch.taskId ?? '未生成'}，dispatchId=${latestDispatch.dispatchId ?? '未生成'}${latestDispatch.agentId ? `，当前执行方 ${latestDispatch.agentId}` : ''}。`
          : '尚无新的调度单样本，等待下一条真实对话指令进入链路。',
      progress: runtimeDispatches.length > 0
        ? clampProgress(66 + runtimeDispatches.length * 6 - runtimeBlocked * 10, 48, 96)
        : latestDispatch ? (latestDispatch.status === 'completed' ? 88 : latestDispatch.status === 'failed' ? 58 : 76) : 52,
      owner: '助理 / Gateway',
      priority: 'P1',
      updatedAt: latestDate,
      statusLine: latestDispatch ? `当前最新状态：${latestDispatch.status}。` : '当前还没有新的调度样本。',
      focus: 'Gateway / Session / Dispatch',
      primaryRoute: {screen: 'GatewaySettings'},
      cta: '检查 Gateway 连接',
      secondaryCta: '看最近调度',
      secondaryRoute: latestDispatch?.dispatchId
        ? {screen: 'DispatchChain', params: {focusDispatchId: latestDispatch.dispatchId}}
        : {screen: 'DispatchChain'},
    });

    items.push({
      id: 'runtime-agents',
      name: '智能体执行位负载',
      domain: 'infra',
      description: `当前在线 ${onlineAgents} 个、执行中 ${workingAgents} 个。任务和调度都在围绕真实 Agent 状态回流，前台能直接看到谁在跑、谁在待命。`,
      progress: Math.min(96, 45 + onlineAgents * 8 + workingAgents * 10),
      owner: '助理 / Agent Runtime',
      priority: 'P1',
      updatedAt: latestDate,
      statusLine: workingAgents > 0 ? `有 ${workingAgents} 个 Agent 仍在执行。` : '当前没有忙碌中的 Agent。',
      focus: '在线 / 执行中 / 待命',
      primaryRoute: {screen: 'Tabs', params: {screen: 'Agent'}},
      cta: '看智能体状态',
    });

    items.push({
      id: 'runtime-decision',
      name: '人工确认与收口',
      domain: 'infra',
      description: `当前有 ${blockedTaskCount} 个阻塞任务、${pendingConfirmations} 项待确认，说明“需确认项”这条人工决策链仍在工作，P1 还没完全收口。`,
      progress: Math.max(24, 70 - blockedTaskCount * 8 - pendingConfirmations * 10),
      owner: '助理',
      priority: 'P1',
      updatedAt: latestDate,
      statusLine: pendingConfirmations > 0 ? `还有 ${pendingConfirmations} 项待拍板。` : '确认链路当前已比较干净。',
      focus: '需确认项 / 阻塞任务',
      primaryRoute: {screen: 'Confirmations'},
      cta: '去清确认项',
    });

    const globalSignalScore = runningTaskCount + doneTaskCount + activeUploadCount;
    if (globalSignalScore > 0) {
      items.push({
        id: 'runtime-overview',
        name: '全局运行态概览',
        domain: 'infra',
        description: `当前运行中任务 ${runningTaskCount} 个、已完成 ${doneTaskCount} 个、上传链路活跃 ${activeUploadCount} 个，移动端已经开始承接真实运行态。`,
        progress: Math.min(98, 70 + runningTaskCount * 4 + doneTaskCount * 2 + activeUploadCount * 3),
        owner: '助理 / 运行态',
        priority: 'P1',
        updatedAt: latestDate,
        statusLine: runningTaskCount > 0 ? `当前最忙的链路有 ${runningTaskCount} 条任务在跑。` : '当前没有堆积中的执行任务。',
        focus: '任务流 / 上传流 / 调度流',
        primaryRoute: {screen: 'Tabs', params: {screen: 'Dashboard'}},
        cta: '看全局驾驶舱',
      });
    }

    return items;
  }, [safeAgents, safeConfirmations, safeDispatches, safeTasks, safeUploads]);

  const mergedProjects = useMemo(() => [...runtimeProjects, ...PROJECT_CATALOG], [runtimeProjects]);

  const projectFocusQueue = useMemo<ProjectFocusCue[]>(() => {
    const blockedCount = safeTasks.filter(task => task.state === 'blocked').length;
    const pendingConfirmations = safeConfirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length;
    const activeUploadCount = safeUploads.filter(file => file.status === 'queued' || file.status === 'uploading' || file.status === 'processing').length;
    const latestDispatch = safeDispatches[0];

    const ranked = mergedProjects
      .map(project => {
        let score = project.priority === 'P0' ? 120 : project.priority === 'P1' ? 80 : 50;
        score += 100 - project.progress;

        if (project.id === 'runtime-decision') {
          score += blockedCount * 18 + pendingConfirmations * 24;
        }
        if (project.id === 'runtime-mobile') {
          score += activeUploadCount * 8 + (latestDispatch && detectRuntimeProjectFromDispatch(latestDispatch) === 'aibrainim' ? 18 : 0);
        }
        if (project.id === 'runtime-infra') {
          score += latestDispatch?.status === 'failed' ? 26 : latestDispatch?.status === 'processing' || latestDispatch?.status === 'dispatched' ? 14 : 0;
        }
        if (project.id === 'runtime-juyuan') {
          score += safeTasks.filter(task => detectRuntimeProjectFromTask(task) === 'juyuan' && task.state === 'running').length * 10;
        }

        return {project, score};
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return ranked.map(({project}, index) => ({
      id: `focus-${project.id}`,
      title: index === 0 ? `现在先处理：${project.name}` : `接着推进：${project.name}`,
      detail:
        project.id === 'runtime-decision'
          ? `当前有 ${blockedCount} 个阻塞任务、${pendingConfirmations} 项待确认，这条链不清掉，其他项目再推进也会卡住。`
          : project.id === 'runtime-mobile'
            ? `移动端闭环正在收口，当前上传活跃 ${activeUploadCount} 个${latestDispatch ? `，最新调度状态是 ${latestDispatch.status}` : ''}。`
            : project.id === 'runtime-infra'
              ? latestDispatch
                ? `最新调度单 ${latestDispatch.status}，taskId=${latestDispatch.taskId ?? '未生成'}，需要确保调度状态能稳定回流到前台。`
                : '现在缺的不是展示页，而是更多真实调度样本回流。'
              : `${project.statusLine} 当前进度 ${project.progress}% ，继续把「${project.focus}」往可交付状态推。`,
      accent: DOMAIN_META[project.domain].color,
      cta: project.cta,
      route: project.primaryRoute,
    }));
  }, [mergedProjects, safeConfirmations, safeDispatches, safeTasks, safeUploads]);

  const filtered = activeDomain === '全部'
    ? mergedProjects
    : mergedProjects.filter(p => {
        const map: Record<string, Project['domain']> = {
          '移动端': 'mobile',
          '矿业': 'mining',
          '基础': 'infra',
        };
        return p.domain === map[activeDomain];
      });

  const summary = useMemo(() => ({
    total: mergedProjects.length,
    p0: mergedProjects.filter(project => project.priority === 'P0').length,
    mobile: mergedProjects.filter(project => project.domain === 'mobile').length,
    mining: mergedProjects.filter(project => project.domain === 'mining').length,
  }), [mergedProjects]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>📁 项目库</Text>
        <Text style={styles.sub}>{mergedProjects.length} 个项目 · 进度实时</Text>
        <Text style={styles.helper}>运行态项目实时投影 · 移动端闭环、调度与确认链同步可见</Text>
      </View>

      <View style={styles.summaryBoard}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillLabel}>总项目</Text>
          <Text style={styles.summaryPillValue}>{summary.total}</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillLabel}>P0</Text>
          <Text style={styles.summaryPillValue}>{summary.p0}</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillLabel}>移动端</Text>
          <Text style={styles.summaryPillValue}>{summary.mobile}</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillLabel}>矿业</Text>
          <Text style={styles.summaryPillValue}>{summary.mining}</Text>
        </View>
      </View>

      {projectFocusQueue.length > 0 && (
        <View style={styles.focusQueueBoard}>
          <Text style={styles.focusQueueTitle}>先做什么</Text>
          <Text style={styles.focusQueueSub}>这里不再平均铺开所有项目，而是把当前最该收口的 3 条链路顶出来。</Text>
          {projectFocusQueue.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.focusQueueCard}
              activeOpacity={0.82}
              onPress={() => openScreen(navigation, item.route)}
            >
              <View style={[styles.focusQueueAccent, {backgroundColor: item.accent}]} />
              <View style={styles.focusQueueBody}>
                <Text style={styles.focusQueueItemTitle}>{item.title}</Text>
                <Text style={styles.focusQueueItemDetail}>{item.detail}</Text>
                <Text style={[styles.focusQueueCTA, {color: item.accent}]}>{item.cta}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTER_DOMAINS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeDomain === f && styles.filterChipActive]}
            onPress={() => setActiveDomain(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, activeDomain === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {filtered.map(proj => {
          const meta = DOMAIN_META[proj.domain];
          return (
            <View key={proj.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.domainBadge, {backgroundColor: meta.color + '22', borderColor: meta.color + '44'}]}>
                  <Text style={styles.domainEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.domainLabel, {color: meta.color}]}>{meta.label}</Text>
                </View>
                <View style={[styles.priorityBadge, {borderColor: PRIORITY_COLOR[proj.priority]}]}>
                  <Text style={[styles.priorityText, {color: PRIORITY_COLOR[proj.priority]}]}>{proj.priority}</Text>
                </View>
              </View>
              <Text style={styles.projName}>{proj.name}</Text>
              <Text style={styles.projDesc}>{proj.description}</Text>
              <Text style={[styles.statusLine, {color: meta.color}]}>{proj.statusLine}</Text>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>进度</Text>
                <Text style={[styles.progressValue, {color: meta.color}]}>{proj.progress}%</Text>
              </View>
              <ProgressBar value={proj.progress} color={meta.color} />
              <View style={styles.focusRow}>
                <Text style={styles.focusText}>聚焦：{proj.focus}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>👤 {proj.owner}</Text>
                <Text style={styles.cardMeta}>更新 {proj.updatedAt}</Text>
              </View>
              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary, {borderColor: meta.color + '66'}]}
                  activeOpacity={0.8}
                  onPress={() => openScreen(navigation, proj.primaryRoute)}
                >
                  <Text style={[styles.actionBtnText, {color: meta.color}]}>{proj.cta}</Text>
                </TouchableOpacity>
                {proj.secondaryCta && proj.secondaryRoute ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSecondary]}
                    activeOpacity={0.8}
                    onPress={() => openScreen(navigation, proj.secondaryRoute!)}
                  >
                    <Text style={styles.actionBtnSecondaryText}>{proj.secondaryCta}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bgRoot},
  header: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title: {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub: {color: C.textMuted, fontSize: 12, marginTop: 4},
  helper: {color: C.primary, fontSize: 11, marginTop: 8, lineHeight: 16},
  summaryBoard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    flexDirection: 'row',
    gap: 8,
  },
  focusQueueBoard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.7)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 10,
  },
  focusQueueTitle: {color: C.textTitle, fontSize: 16, fontWeight: '900'},
  focusQueueSub: {color: C.textMuted, fontSize: 12, lineHeight: 18},
  focusQueueCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  focusQueueAccent: {
    width: 4,
    borderRadius: 999,
    alignSelf: 'stretch',
  },
  focusQueueBody: {flex: 1, gap: 4},
  focusQueueItemTitle: {color: C.textTitle, fontSize: 13, fontWeight: '900'},
  focusQueueItemDetail: {color: C.textBody, fontSize: 12, lineHeight: 18},
  focusQueueCTA: {fontSize: 12, fontWeight: '800', marginTop: 2},
  summaryPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  summaryPillLabel: {color: C.textMuted, fontSize: 10, fontWeight: '700'},
  summaryPillValue: {color: C.textTitle, fontSize: 16, fontWeight: '900', marginTop: 4},
  filterRow: {paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: 'row'},
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: 'rgba(56,100,200,0.25)',
    borderColor: C.borderActive,
  },
  filterText: {color: C.textMuted, fontSize: 13, fontWeight: '700'},
  filterTextActive: {color: C.primary},
  content: {padding: 16, paddingBottom: 100, gap: 10},
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  domainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  domainEmoji: {fontSize: 12},
  domainLabel: {fontSize: 11, fontWeight: '800'},
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityText: {fontSize: 11, fontWeight: '900'},
  projName: {color: C.textTitle, fontSize: 16, fontWeight: '900', marginBottom: 5},
  projDesc: {color: C.textBody, fontSize: 13, lineHeight: 18},
  statusLine: {marginTop: 8, fontSize: 12, lineHeight: 18, fontWeight: '700'},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6},
  progressLabel: {color: C.textMuted, fontSize: 12},
  progressValue: {fontSize: 12, fontWeight: '900'},
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(56,100,200,0.15)',
    overflow: 'hidden',
  },
  progressFill: {height: '100%', borderRadius: 3},
  focusRow: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  focusText: {color: C.textBody, fontSize: 12, lineHeight: 18},
  cardFooter: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 10},
  cardMeta: {color: C.textMuted, fontSize: 11},
  actionBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flex: 1,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtnPrimary: {
    marginTop: 0,
  },
  actionBtnSecondary: {
    marginTop: 0,
    borderColor: C.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  actionBtnText: {fontSize: 13, fontWeight: '900'},
  actionBtnSecondaryText: {fontSize: 13, fontWeight: '800', color: C.textBody},
  footer: {height: 24},
});
