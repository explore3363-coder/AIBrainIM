import React, {useMemo, useState} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';

// ─── Mock Knowledge Docs ──────────────────────────────────────────────────────
interface KBDoc {
  id: string;
  category: 'mining' | 'engineering' | 'technical' | 'policy';
  title: string;
  summary: string;
  updatedAt: string;
}

const KB_DOCS: KBDoc[] = [
  {id:'k1', category:'technical', title:'OpenClaw Agent Runtime 架构', summary:'Gateway · Node · Skill 调度 · Memory API · 任务状态流', updatedAt:'2026-05-06'},
  {id:'k2', category:'mining',    title:'中国钨矿资源分布与全球供应链', summary:'储量 · 品位 · 六大矿区 · 进出口政策 · 价格驱动因素', updatedAt:'2026-05-05'},
  {id:'k3', category:'engineering', title:'智慧矿山数字孪生技术路线', summary:'三维建模 · 实时传感器 · 采掘优化 · 无人化趋势', updatedAt:'2026-05-05'},
  {id:'k4', category:'policy',    title:'矿业开发审批流程与合规要点', summary:'采矿许可证 · 环评 · 安全生产 · 近年政策变化', updatedAt:'2026-05-04'},
  {id:'k5', category:'technical', title:'React Native 0.85 + OpenClaw 集成', summary:'Navigation · SafeArea · Context · API Bridge · 已知问题', updatedAt:'2026-05-06'},
  {id:'k6', category:'mining',    title:'XRT 智能选矿技术原理与应用', summary:'XRT 射线穿透 · 图像识别 · 预选废石 · 回收率提升', updatedAt:'2026-05-03'},
  {id:'k7', category:'engineering', title:'聚源三维智慧矿山项目方案', summary:'数字孪生 · 三维可视化 · 数据中台 · 实施路径', updatedAt:'2026-05-04'},
  {id:'k8', category:'policy',    title:'2026 年矿业税费与补贴政策', summary:'资源税 · 增值税返还 · 绿色矿山补贴 · 跨境投资', updatedAt:'2026-05-02'},
];

const CAT_META: Record<KBDoc['category'], {emoji: string; label: string; color: string}> = {
  mining:      {emoji:'⛏️', label:'矿业',    color:'#fbbf24'},
  engineering: {emoji:'🏗️', label:'工程',    color:'#34d399'},
  technical:   {emoji:'⚙️', label:'技术',    color: C.primary},
  policy:      {emoji:'📋', label:'政策',    color:'#a78bfa'},
};

const FILTER_CATS = ['全部', '矿业', '工程', '技术', '政策'] as const;
type FilterCat = typeof FILTER_CATS[number];

export function KnowledgeBaseScreen() {
  const [activeCat, setActiveCat] = useState<FilterCat>('全部');
  const {agents, tasks, uploads, dispatches} = useAppContext();

  const runtimeDocs = useMemo<KBDoc[]>(() => {
    const docs: KBDoc[] = [];

    const activeAgentCount = agents.filter(agent => agent.status === 'online' || agent.status === 'working').length;
    docs.push({
      id: 'runtime-agents',
      category: 'technical',
      title: '当前 Agent Runtime 在线态势',
      summary: `${activeAgentCount}/${agents.length} 个 Agent 当前在线或工作中，移动端已经能消费实时智能体状态。`,
      updatedAt: new Date().toLocaleDateString('zh-CN'),
    });

    const currentTask = tasks.find(task => task.state === 'running' || task.state === 'todo');
    if (currentTask) {
      docs.push({
        id: `runtime-task-${currentTask.id}`,
        category: currentTask.owner.includes('黑金') || currentTask.owner.includes('开发') ? 'engineering' : 'technical',
        title: `当前任务链路：${currentTask.title}`,
        summary: `负责人：${currentTask.owner}；下一步：${currentTask.next}；状态：${currentTask.state}`,
        updatedAt: new Date().toLocaleDateString('zh-CN'),
      });
    }

    const uploadDoc = uploads.find(file => file.status === 'processing' || file.status === 'dispatched' || file.status === 'done');
    if (uploadDoc) {
      docs.push({
        id: `runtime-upload-${uploadDoc.id}`,
        category: 'engineering',
        title: '附件处理闭环样本',
        summary: `附件「${uploadDoc.name}」已走到「${uploadDoc.status}」阶段，说明上传 → 处理 → 分派链路已经接通。`,
        updatedAt: new Date().toLocaleDateString('zh-CN'),
      });
    }

    const latestDispatch = dispatches[0];
    if (latestDispatch) {
      docs.push({
        id: `runtime-dispatch-${latestDispatch.id}`,
        category: 'technical',
        title: '调度链最新样本',
        summary: `taskId=${latestDispatch.taskId ?? '未生成'}，dispatchId=${latestDispatch.dispatchId ?? '未生成'}，状态=${latestDispatch.status}。`,
        updatedAt: new Date().toLocaleDateString('zh-CN'),
      });
    }

    return docs;
  }, [agents, dispatches, tasks, uploads]);

  const mergedDocs = useMemo(() => [...runtimeDocs, ...KB_DOCS], [runtimeDocs]);

  const filtered = activeCat === '全部'
    ? mergedDocs
    : mergedDocs.filter(d => {
        const map: Record<string, KBDoc['category']> = {
          '矿业':'mining', '工程':'engineering', '技术':'technical', '政策':'policy',
        };
        return d.category === map[activeCat];
      });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 知识库</Text>
        <Text style={styles.sub}>{mergedDocs.length} 篇文档 · 全文入口已贯通</Text>
        <Text style={styles.helper}>运行态知识已汇入这里：实时 Agent 状态、任务链路、附件闭环与最新调度单会自动生成样本。</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTER_CATS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeCat === f && styles.filterChipActive]}
            onPress={() => setActiveCat(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, activeCat === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {filtered.map(doc => {
          const meta = CAT_META[doc.category];
          return (
            <View key={doc.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.catBadge, {backgroundColor: meta.color + '22', borderColor: meta.color + '44'}]}>
                  <Text style={styles.catEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.catLabel, {color: meta.color}]}>{meta.label}</Text>
                </View>
                <Text style={styles.updatedAt}>更新 {doc.updatedAt}</Text>
              </View>
              <Text style={styles.docTitle}>{doc.title}</Text>
              <Text style={styles.docSummary}>{doc.summary}</Text>
              <TouchableOpacity style={styles.readBtn} activeOpacity={0.75}>
                <Text style={styles.readBtnText}>查看全文</Text>
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
  root:       {flex: 1, backgroundColor: C.bgRoot},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  helper:     {color: C.primary, fontSize: 11, marginTop: 8, lineHeight: 16},
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
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  catEmoji:  {fontSize: 12},
  catLabel:  {fontSize: 11, fontWeight: '800'},
  updatedAt: {color: C.textMuted, fontSize: 11},
  docTitle:   {color: C.textTitle, fontSize: 15, fontWeight: '900', marginBottom: 6},
  docSummary: {color: C.textBody, fontSize: 13, lineHeight: 19},
  readBtn: {
    alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  readBtnText:{color: C.primary, fontSize: 12, fontWeight: '800'},
  footer:     {height: 24},
});
