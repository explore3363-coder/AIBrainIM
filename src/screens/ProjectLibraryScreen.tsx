import React, {useMemo, useState} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';

type RootStackParamList = {
  Tabs: {screen?: 'Dashboard' | 'Chat' | 'Agent' | 'Tasks' | 'Profile'} | undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  ProjectLibrary: undefined;
  DispatchChain: undefined;
  Confirmations: undefined;
  Upload: undefined;
  GatewaySettings: undefined;
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
  linkedScreen: keyof RootStackParamList;
  linkedParams?: RootStackParamList[keyof RootStackParamList];
  cta: string;
}

const PROJECT_CATALOG: Project[] = [
  {
    id: 'p1',
    name: 'AIBrainIM 移动端',
    domain: 'mobile',
    description: 'AI 大脑驾驶舱移动端 Alpha，React Native 0.85 + OpenClaw',
    progress: 65,
    owner: '黑金',
    priority: 'P0',
    updatedAt: '2026-05-06',
    statusLine: '主工程已收口到五主功能，当前重点在真实闭环与上线物料。',
    focus: '总览 / 对话 / 智能体 / 任务 / 我的',
    linkedScreen: 'Tabs',
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
    linkedScreen: 'DispatchChain',
    cta: '去看调度链',
  },
  {
    id: 'p3',
    name: 'OpenClaw Agent Runtime',
    domain: 'infra',
    description: 'Gateway · Node 连接 · Skill 调度 · Memory API',
    progress: 80,
    owner: '助理',
    priority: 'P0',
    updatedAt: '2026-05-06',
    statusLine: '运行态已接通，重点是稳定回流、附件链路与调度状态一致。',
    focus: 'Gateway / Session / Dispatch',
    linkedScreen: 'GatewaySettings',
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
    linkedScreen: 'KnowledgeBase',
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
    linkedScreen: 'Tabs',
    linkedParams: {screen: 'Agent'},
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

function ProgressBar({value, color}: {value: number; color: string}) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, {width: `${value}%`, backgroundColor: color}]} />
    </View>
  );
}

type ProjectRoute = {
  screen: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
};

function openScreen(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  route: ProjectRoute,
) {
  if (route.params === undefined) {
    navigation.navigate(route.screen);
    return;
  }

  if (route.screen === 'Tabs') {
    navigation.navigate('Tabs', route.params as RootStackParamList['Tabs']);
    return;
  }

  navigation.navigate(route.screen);
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

    items.push({
      id: 'runtime-mobile',
      name: 'AIBrainIM P1 实时闭环',
      domain: 'mobile',
      description: `当前运行中任务 ${runningTaskCount} 个、已完成 ${doneTaskCount} 个、上传链路活跃 ${activeUploadCount} 个，移动端已经开始承接真实运行态，不再只是静态样板。`,
      progress: Math.min(98, 70 + runningTaskCount * 4 + doneTaskCount * 2 + activeUploadCount * 3),
      owner: '黑金 / 助理',
      priority: 'P0',
      updatedAt: latestDate,
      statusLine: runningTaskCount > 0 ? `当前最忙的链路有 ${runningTaskCount} 条任务在跑。` : '当前没有堆积中的执行任务。',
      focus: '任务流 / 上传流 / 首页驾驶舱',
      linkedScreen: 'Tabs',
      linkedParams: {screen: 'Dashboard'},
      cta: '回首页看总览',
    });

    items.push({
      id: 'runtime-infra',
      name: 'OpenClaw 调度接入状态',
      domain: 'infra',
      description: latestDispatch
        ? `最近一条调度单状态为 ${latestDispatch.status}，taskId=${latestDispatch.taskId ?? '未生成'}，dispatchId=${latestDispatch.dispatchId ?? '未生成'}${latestDispatch.agentId ? `，当前执行方 ${latestDispatch.agentId}` : ''}。`
        : '尚无新的调度单样本，等待下一条真实对话指令进入链路。',
      progress: latestDispatch ? (latestDispatch.status === 'completed' ? 88 : latestDispatch.status === 'failed' ? 58 : 76) : 52,
      owner: '助理 / Gateway',
      priority: 'P1',
      updatedAt: latestDate,
      statusLine: latestDispatch ? `当前最新状态：${latestDispatch.status}。` : '当前还没有新的调度样本。',
      focus: 'Gateway / Session / Dispatch',
      linkedScreen: 'GatewaySettings',
      cta: '检查 Gateway 连接',
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
      linkedScreen: 'Tabs',
      linkedParams: {screen: 'Agent'},
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
      linkedScreen: 'Confirmations',
      cta: '去清确认项',
    });

    return items;
  }, [safeAgents, safeConfirmations, safeDispatches, safeTasks, safeUploads]);

  const mergedProjects = useMemo(() => [...runtimeProjects, ...PROJECT_CATALOG], [runtimeProjects]);

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
    infra: mergedProjects.filter(project => project.domain === 'infra').length,
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
          <Text style={styles.summaryPillLabel}>基础</Text>
          <Text style={styles.summaryPillValue}>{summary.infra}</Text>
        </View>
      </View>

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
              <TouchableOpacity
                style={[styles.actionBtn, {borderColor: meta.color + '66'}]}
                activeOpacity={0.8}
                onPress={() => openScreen(navigation, {screen: proj.linkedScreen, params: proj.linkedParams})}
              >
                <Text style={[styles.actionBtnText, {color: meta.color}]}>{proj.cta}</Text>
              </TouchableOpacity>
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
  },
  actionBtnText: {fontSize: 13, fontWeight: '900'},
  footer: {height: 24},
});
