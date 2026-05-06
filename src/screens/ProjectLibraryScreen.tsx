import React, {useMemo, useState} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';

// ─── Mock Projects ───────────────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
  domain: 'mobile' | 'mining' | 'infra';
  description: string;
  progress: number; // 0-100
  owner: string;
  priority: 'P0' | 'P1' | 'P2';
  updatedAt: string;
}

const PROJECTS: Project[] = [
  {
    id:'p1', name:'AIBrainIM 移动端', domain:'mobile',
    description:'AI 大脑驾驶舱移动端 Alpha，React Native 0.85 + OpenClaw',
    progress:65, owner:'黑金', priority:'P0', updatedAt:'2026-05-06',
  },
  {
    id:'p2', name:'聚源三维智慧矿山', domain:'mining',
    description:'数字孪生矿山项目，含采掘优化、无人化与三维可视化',
    progress:40, owner:'无垠', priority:'P0', updatedAt:'2026-05-05',
  },
  {
    id:'p3', name:'OpenClaw Agent Runtime', domain:'infra',
    description:'Gateway · Node 连接 · Skill 调度 · Memory API',
    progress:80, owner:'助理', priority:'P0', updatedAt:'2026-05-06',
  },
  {
    id:'p4', name:'钨矿研判知识库', domain:'mining',
    description:'钨矿价格、政策、全球供应链研判知识库与向量检索',
    progress:55, owner:'寻龙', priority:'P1', updatedAt:'2026-05-04',
  },
  {
    id:'p5', name:'选矿工艺专家系统', domain:'mining',
    description:'XRT、磨浮、回收率、药剂的 AI 辅助判断系统',
    progress:30, owner:'探索', priority:'P1', updatedAt:'2026-05-03',
  },
];

const DOMAIN_META: Record<Project['domain'], {emoji: string; label: string; color: string}> = {
  mobile: {emoji:'📱', label:'移动端', color:C.primary},
  mining: {emoji:'⛏️', label:'矿业',  color:'#fbbf24'},
  infra:  {emoji:'🏗️', label:'基础',  color:'#34d399'},
};
const PRIORITY_COLOR: Record<Project['priority'], string> = {
  P0:'#f87171', P1: C.normalUrgency, P2: C.lowUrgency,
};

const FILTER_DOMAINS = ['全部', '移动端', '矿业', '基础'] as const;
type FilterDomain = typeof FILTER_DOMAINS[number];

function ProgressBar({value, color}: {value: number; color: string}) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, {width:`${value}%`, backgroundColor: color}]} />
    </View>
  );
}

export function ProjectLibraryScreen() {
  const [activeDomain, setActiveDomain] = useState<FilterDomain>('全部');
  const {tasks, uploads, dispatches, confirmations, agents} = useAppContext();

  const runtimeProjects = useMemo<Project[]>(() => {
    const items: Project[] = [];

    const runningTaskCount = tasks.filter(task => task.state === 'running').length;
    const blockedTaskCount = tasks.filter(task => task.state === 'blocked').length;
    const doneTaskCount = tasks.filter(task => task.state === 'done').length;
    const activeUploadCount = uploads.filter(file => file.status === 'queued' || file.status === 'uploading' || file.status === 'processing').length;
    const latestDispatch = dispatches[0];
    const pendingConfirmations = confirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length;
    const onlineAgents = agents.filter(agent => agent.status === 'online' || agent.status === 'working').length;
    const workingAgents = agents.filter(agent => agent.status === 'working').length;
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
    });

    if (blockedTaskCount > 0 || pendingConfirmations > 0) {
      items.push({
        id: 'runtime-decision',
        name: '人工确认与收口',
        domain: 'infra',
        description: `当前有 ${blockedTaskCount} 个阻塞任务、${pendingConfirmations} 项待确认，说明“需确认项”这条人工决策链仍在工作，P1 还没完全收口。`,
        progress: Math.max(24, 70 - blockedTaskCount * 8 - pendingConfirmations * 10),
        owner: '助理',
        priority: 'P1',
        updatedAt: latestDate,
      });
    }

    return items;
  }, [agents, confirmations, dispatches, tasks, uploads]);

  const mergedProjects = useMemo(() => [...runtimeProjects, ...PROJECTS], [runtimeProjects]);

  const filtered = activeDomain === '全部'
    ? mergedProjects
    : mergedProjects.filter(p => {
        const map: Record<string, Project['domain']> = {
          '移动端':'mobile', '矿业':'mining', '基础':'infra',
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
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
                  <Text style={[styles.priorityText, {color: PRIORITY_COLOR[proj.priority]}]}>
                    {proj.priority}
                  </Text>
                </View>
              </View>
              <Text style={styles.projName}>{proj.name}</Text>
              <Text style={styles.projDesc}>{proj.description}</Text>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>进度</Text>
                <Text style={[styles.progressValue, {color: meta.color}]}>{proj.progress}%</Text>
              </View>
              <ProgressBar value={proj.progress} color={meta.color} />
              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>👤 {proj.owner}</Text>
                <Text style={styles.cardMeta}>更新 {proj.updatedAt}</Text>
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
  root:       {flex: 1, backgroundColor: C.bgRoot},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  helper:     {color: C.primary, fontSize: 11, marginTop: 8, lineHeight: 16},
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
  filterRow:  {paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: 'row'},
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: 'rgba(56,100,200,0.25)',
    borderColor: C.borderActive,
  },
  filterText:      {color: C.textMuted, fontSize: 13, fontWeight: '700'},
  filterTextActive:{color: C.primary},
  content:    {padding: 16, paddingBottom: 100, gap: 10},
  card: {
    padding: 14, borderRadius: 18,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  domainBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  domainEmoji:  {fontSize: 12},
  domainLabel:  {fontSize: 11, fontWeight: '800'},
  priorityBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
  },
  priorityText: {fontSize: 11, fontWeight: '900'},
  projName:   {color: C.textTitle, fontSize: 16, fontWeight: '900', marginBottom: 5},
  projDesc:   {color: C.textBody, fontSize: 13, lineHeight: 18},
  progressRow:{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6},
  progressLabel:{color: C.textMuted, fontSize: 12},
  progressValue: {fontSize: 12, fontWeight: '900'},
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(56,100,200,0.15)',
    overflow: 'hidden',
  },
  progressFill:{height:'100%', borderRadius:3},
  cardFooter:{flexDirection:'row', justifyContent:'space-between', marginTop:10},
  cardMeta:  {color: C.textMuted, fontSize: 11},
  footer:    {height: 24},
});
