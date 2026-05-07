import React, {useMemo, useState, useCallback} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {gatewayInvoke} from '../data/api';

// ─── Feishu Wiki / Doc integration for "查看全文" ─────────────────────────────
// P1 now goes through gatewayInvoke directly instead of relying on a global tool bridge.

interface KBDoc {
  id: string;
  category: 'mining' | 'engineering' | 'technical' | 'policy';
  title: string;
  summary: string;
  updatedAt: string;
  /** Optional Feishu wiki search query — enables real "查看全文" for P1 */
  wikiQuery?: string;
}

// ─── Mock Knowledge Docs ──────────────────────────────────────────────────────

const KB_DOCS: KBDoc[] = [
  {id:'k1', category:'technical', title:'OpenClaw Agent Runtime 架构', summary:'Gateway · Node · Skill 调度 · Memory API · 任务状态流', updatedAt:'2026-05-06', wikiQuery:'OpenClaw Agent Runtime'},
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

function localDocSearch(query: string, docs: KBDoc[]): KBDoc[] {
  const q = query.toLowerCase().trim();
  if (!q) return docs;
  return docs.filter(d =>
    d.title.toLowerCase().includes(q) ||
    d.summary.toLowerCase().includes(q) ||
    d.category.toLowerCase().includes(q),
  );
}

function categoryToMemoryCategory(category: KBDoc['category']): 'fact' | 'decision' | 'rule' {
  switch (category) {
    case 'policy':
      return 'rule';
    case 'engineering':
      return 'decision';
    default:
      return 'fact';
  }
}

export function KnowledgeBaseScreen() {
  const [activeCat, setActiveCat] = useState<FilterCat>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBDoc[] | null>(null);
  // Per-doc loading: which doc ID is currently being read (null = none)
  const [readingDocId, setReadingDocId] = useState<string | null>(null);
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const {agents, tasks, uploads, dispatches, registerKnowledgeCapture} = useAppContext();

  const safeAgents = useMemo(() => Array.isArray(agents) ? agents : [], [agents]);
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeUploads = useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);
  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);

  const runtimeDocs = useMemo<KBDoc[]>(() => {
    const docs: KBDoc[] = [];

    const activeAgentCount = safeAgents.filter(agent => agent.status === 'online' || agent.status === 'working').length;
    docs.push({
      id: 'runtime-agents',
      category: 'technical',
      title: '当前 Agent Runtime 在线态势',
      summary: `${activeAgentCount}/${safeAgents.length} 个 Agent 当前在线或工作中，移动端已经能消费实时智能体状态。`,
      updatedAt: new Date().toLocaleDateString('zh-CN'),
    });

    const currentTask = safeTasks.find(task => task.state === 'running' || task.state === 'todo');
    if (currentTask) {
      docs.push({
        id: `runtime-task-${currentTask.id}`,
        category: currentTask.owner.includes('黑金') || currentTask.owner.includes('开发') ? 'engineering' : 'technical',
        title: `当前任务链路：${currentTask.title}`,
        summary: `负责人：${currentTask.owner}；下一步：${currentTask.next}；状态：${currentTask.state}`,
        updatedAt: new Date().toLocaleDateString('zh-CN'),
      });
    }

    const uploadDoc = safeUploads.find(file => file.status === 'processing' || file.status === 'dispatched' || file.status === 'done');
    if (uploadDoc) {
      docs.push({
        id: `runtime-upload-${uploadDoc.id}`,
        category: 'engineering',
        title: '附件处理闭环样本',
        summary: `附件「${uploadDoc.name}」已走到「${uploadDoc.status}」阶段，说明上传 → 处理 → 分派链路已经接通。`,
        updatedAt: new Date().toLocaleDateString('zh-CN'),
      });
    }

    const latestDispatch = safeDispatches[0];
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
  }, [safeAgents, safeDispatches, safeTasks, safeUploads]);

  const mergedDocs = useMemo(() => [...runtimeDocs, ...KB_DOCS], [runtimeDocs]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    setSearchResults(localDocSearch(q, mergedDocs));
  }, [mergedDocs]);

  /**
   * "查看全文" handler — P1 实现：
   * 1. 如果 doc 有 wikiQuery，尝试用 feishu_wiki 搜索真实文档
   * 2. 取第一个结果，用 feishu_doc 读取正文内容并弹 Alert 显示
   * 3. 如果任何一步失败，降级为 Alert 显示文档摘要（本地 mock 也有内容可看）
   */
  const handleReadDoc = useCallback(async (doc: KBDoc) => {
    if (readingDocId !== null) return; // prevent double-open
    setReadingDocId(doc.id);
    let resolved = false;

    try {
      if (doc.wikiQuery) {
        let wikiToken = '';
        try {
          const results = await gatewayInvoke('feishu_wiki', 'search', {
            query: doc.wikiQuery,
          }) as {nodes?: Array<{node_token?: string}>};
          if (results?.nodes?.[0]?.node_token) {
            wikiToken = results.nodes[0].node_token;
          }
        } catch {
          // 搜索失败，走降级路径
        }

        if (wikiToken) {
          try {
            const content = await gatewayInvoke('feishu_doc', 'read', {
              doc_token: wikiToken,
            });
            if (content) {
              resolved = true;
              Alert.alert(doc.title, String(content).slice(0, 2000));
            }
          } catch {
            // 读取失败，走降级路径
          }
        }
      }
    } finally {
      setReadingDocId(null);
    }

    if (resolved) {
      return;
    }

    // 降级：始终显示摘要作为「全文」
    const meta = CAT_META[doc.category];
    Alert.alert(
      `${meta.emoji} ${doc.title}`,
      [
        `分类：${meta.label}　更新时间：${doc.updatedAt}`,
        '',
        doc.summary,
        '',
        '—— 完整知识库接入生产向量检索后，将在此处显示正文内容。',
      ].join('\n'),
      [{text: '知道了'}],
    );
  }, [readingDocId]);

  const handleSaveToMemory = useCallback(async (doc: KBDoc) => {
    if (savingDocId !== null) {
      return;
    }

    setSavingDocId(doc.id);
    const memoryCategory = categoryToMemoryCategory(doc.category);
    try {
      await gatewayInvoke('memory_store', 'remember', {
        text: `${doc.title}\n\n${doc.summary}`,
        category: memoryCategory,
        importance: doc.category === 'policy' ? 0.82 : 0.72,
      });
      registerKnowledgeCapture({
        title: doc.title,
        summary: doc.summary,
        category: memoryCategory,
        source: '知识库',
        savedRemotely: true,
      });
      Alert.alert('已收录', `「${doc.title}」已写入 OpenClaw 记忆层，并回流到任务/调度链。`);
    } catch (error) {
      registerKnowledgeCapture({
        title: doc.title,
        summary: doc.summary,
        category: memoryCategory,
        source: '知识库',
        savedRemotely: false,
      });
      Alert.alert(
        '已先保留到闭环',
        `远程记忆层暂时不可用，这条知识已经先回流到任务/调度链，后续可补写。\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSavingDocId(null);
    }
  }, [registerKnowledgeCapture, savingDocId]);

  const filtered = useMemo(() => {
    const source = searchResults !== null ? searchResults : mergedDocs;
    if (activeCat === '全部') return source;
    const map: Record<string, KBDoc['category']> = {
      '矿业':'mining', '工程':'engineering', '技术':'technical', '政策':'policy',
    };
    return source.filter(d => d.category === map[activeCat]);
  }, [activeCat, mergedDocs, searchResults]);

  const displayCount = searchResults !== null ? filtered.length : mergedDocs.length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 知识库</Text>
        <Text style={styles.sub}>{displayCount} 篇文档 · {searchResults ? '搜索结果' : '矿业 + 工程 + 技术 + 政策'}</Text>
        <Text style={styles.helper}>运行态知识自动汇入 · 收录后可同步到任务与调度链</Text>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            onSubmitEditing={e => handleSearch(e.nativeEvent.text)}
            placeholder="搜索知识库…"
            placeholderTextColor={C.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {searchResults !== null && (
          <Text style={styles.searchHint}>{filtered.length} 条匹配结果</Text>
        )}
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
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyTitle}>知识库暂无内容</Text>
            <Text style={styles.emptySub}>上传文档或由助理自动沉淀知识条目后，会在此显示。</Text>
            <Text style={styles.emptySub2}>矿业知识、工程经验、技术规范、政策文件都可以沉淀。</Text>
          </View>
        )}
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
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.readBtn, readingDocId === doc.id && styles.readBtnDisabled]}
                  activeOpacity={0.75}
                  onPress={() => handleReadDoc(doc)}
                  disabled={readingDocId !== null || savingDocId !== null}
                >
                  <Text style={styles.readBtnText}>
                    {readingDocId === doc.id ? '⏳ 加载中…' : '查看全文'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveMemoryBtn, savingDocId === doc.id && styles.readBtnDisabled]}
                  activeOpacity={0.75}
                  onPress={() => handleSaveToMemory(doc)}
                  disabled={readingDocId !== null || savingDocId !== null}
                >
                  <Text style={styles.saveMemoryBtnText}>
                    {savingDocId === doc.id ? '⏳ 收录中…' : '收录到记忆'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={styles.footer} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       {flex: 1, backgroundColor: C.bgRoot},
  flex:       {flex: 1},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  helper:     {color: C.primary, fontSize: 11, marginTop: 8, lineHeight: 16},
  searchRow:  {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12},
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: C.textTitle,
    backgroundColor: 'rgba(5,13,26,0.9)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    fontSize: 14,
  },
  clearBtn:   {color: C.textMuted, fontSize: 16, fontWeight: '700', paddingHorizontal: 8},
  searchHint: {color: C.textMuted, fontSize: 11, marginTop: 6},
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
  emptyState:  {alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24},
  emptyIcon:   {fontSize: 44, marginBottom: 12},
  emptyTitle:  {color: C.textTitle, fontSize: 17, fontWeight: '800', marginBottom: 8},
  emptySub:    {color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20},
  emptySub2:   {color: C.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6, fontStyle: 'italic'},
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  readBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  saveMemoryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1, borderColor: '#34d399',
  },
  readBtnDisabled: {
    opacity: 0.5,
  },
  readBtnText:{color: C.primary, fontSize: 12, fontWeight: '800'},
  saveMemoryBtnText:{color: '#34d399', fontSize: 12, fontWeight: '800'},
  footer:     {height: 24},
});
