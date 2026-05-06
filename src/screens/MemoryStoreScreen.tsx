import React, {useMemo, useState, useCallback} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {gatewayInvoke} from '../data/api';

interface MemoryEntry {
  id: string;
  category: 'preference' | 'decision' | 'fact' | 'rule';
  content: string;
  agent: string;
  timestamp: string;
  source?: 'seed' | 'runtime' | 'created' | 'remote';
  remoteStatus?: 'synced' | 'local_only';
  editable?: boolean;
}

const MEMORY_ENTRIES: MemoryEntry[] = [
  {id:'m1', category:'preference', content:'偏好深色主题，操作界面以星际蓝为主色调', agent:'助理', timestamp:'2026-05-06', source:'seed'},
  {id:'m2', category:'preference', content:'任务以 Kanban 视图呈现，优先级要醒目', agent:'助理', timestamp:'2026-05-06', source:'seed'},
  {id:'m3', category:'fact',     content:'聚源三维智慧矿山项目是当前最高优先级', agent:'助理', timestamp:'2026-05-05', source:'seed'},
  {id:'m4', category:'decision', content:'上传文件不设大小限制，由后端自动处理分片', agent:'助理', timestamp:'2026-05-05', source:'seed'},
  {id:'m5', category:'rule',     content:'调度链每条指令必须可追踪，有 receive → deliver 完整路径', agent:'助理', timestamp:'2026-05-04', source:'seed'},
  {id:'m6', category:'fact',     content:'钨矿 AI 大脑主攻矿业领域知识与矿山数字化', agent:'助理', timestamp:'2026-05-03', source:'seed'},
  {id:'m7', category:'preference', content:'希望智能体状态实时可见，首页看到正在发生什么', agent:'助理', timestamp:'2026-05-03', source:'seed'},
  {id:'m8', category:'rule',     content:'需确认项必须人工拍板后才能继续推进，不能跳过', agent:'助理', timestamp:'2026-05-02', source:'seed'},
];

const CATEGORY_META: Record<MemoryEntry['category'], {emoji: string; label: string; color: string}> = {
  preference: {emoji:'⭐', label:'偏好', color:'#fbbf24'},
  decision:   {emoji:'✅', label:'决策', color:'#34d399'},
  fact:       {emoji:'📌', label:'事实', color:C.primary},
  rule:       {emoji:'⚙️', label:'规则', color:'#a78bfa'},
};

const CATEGORY_FILTER = ['全部', '偏好', '决策', '事实', '规则'] as const;
type FilterKey = typeof CATEGORY_FILTER[number];
type MemoryCategory = MemoryEntry['category'];

type SearchResult = MemoryEntry;

function localSearch(query: string, entries: MemoryEntry[]): MemoryEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return entries;
  return entries.filter(e =>
    e.content.toLowerCase().includes(q) ||
    e.agent.toLowerCase().includes(q) ||
    e.category.toLowerCase().includes(q),
  );
}

async function remoteSearch(query: string): Promise<SearchResult[]> {
  try {
    const result = await gatewayInvoke('memory_recall', 'search', {query, limit: 10});
    const r = result as {results?: Array<{id: string; text: string; category?: string; scope?: string}>};
    if (!r?.results?.length) return [];
    return r.results.map(item => ({
      id: item.id ?? `remote-${Date.now()}`,
      category: (item.category as MemoryCategory) ?? 'fact',
      content: item.text,
      agent: item.scope ?? '远程记忆',
      timestamp: new Date().toLocaleDateString('zh-CN'),
      source: 'remote',
      remoteStatus: 'synced',
      editable: false,
    }));
  } catch {
    return [];
  }
}

async function storeRemoteMemory(payload: {
  text: string;
  category: MemoryCategory;
}): Promise<boolean> {
  try {
    await gatewayInvoke('memory_store', 'remember', {
      text: payload.text,
      category: payload.category,
      importance: payload.category === 'decision' || payload.category === 'rule' ? 0.85 : 0.72,
    });
    return true;
  } catch {
    return false;
  }
}

function toFilterCategory(category: MemoryCategory): FilterKey {
  switch (category) {
    case 'preference': return '偏好';
    case 'decision':   return '决策';
    case 'fact':       return '事实';
    case 'rule':       return '规则';
    default:           return '全部';
  }
}

function formatMemoryTimestamp(): string {
  return new Date().toLocaleDateString('zh-CN');
}

export function MemoryStoreScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [draftCategory, setDraftCategory] = useState<MemoryCategory>('decision');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [retryingEntryId, setRetryingEntryId] = useState<string | null>(null);
  const [localCreatedEntries, setLocalCreatedEntries] = useState<MemoryEntry[]>([]);
  const {dispatches, tasks, uploads, confirmations, registerMemoryCapture} = useAppContext();

  const dynamicEntries = useMemo<MemoryEntry[]>(() => {
    const items: MemoryEntry[] = [];

    const latestDispatch = dispatches[0];
    if (latestDispatch) {
      items.push({
        id: `dispatch-${latestDispatch.id}`,
        category: latestDispatch.status === 'failed' ? 'rule' : 'decision',
        content: `最新调度单状态为「${latestDispatch.status}」：${latestDispatch.userText}`,
        agent: '助理',
        timestamp: new Date(latestDispatch.createdAt).toLocaleDateString('zh-CN'),
        source: 'runtime',
      });
    }

    const runningTask = tasks.find(task => task.state === 'running');
    if (runningTask) {
      items.push({
        id: `task-${runningTask.id}`,
        category: 'fact',
        content: `当前最活跃任务是「${runningTask.title}」，下一步：${runningTask.next}`,
        agent: runningTask.owner,
        timestamp: formatMemoryTimestamp(),
        source: 'runtime',
      });
    }

    const activeUpload = uploads.find(file => file.status === 'uploading' || file.status === 'processing' || file.status === 'dispatched');
    if (activeUpload) {
      items.push({
        id: `upload-${activeUpload.id}`,
        category: 'decision',
        content: `附件链路已激活：${activeUpload.name} 当前处于「${activeUpload.status}」状态，前端上传闭环有效。`,
        agent: activeUpload.agent ?? '附件队列',
        timestamp: formatMemoryTimestamp(),
        source: 'runtime',
      });
    }

    const pendingConfirmation = confirmations.find(item => item.status !== 'confirmed' && item.status !== 'deferred');
    if (pendingConfirmation) {
      items.push({
        id: `confirmation-${pendingConfirmation.id}`,
        category: 'rule',
        content: `仍有需确认项待处理：${pendingConfirmation.title}。产品层保留“需确认项”作为闭环中的人工决策入口。`,
        agent: pendingConfirmation.agent,
        timestamp: formatMemoryTimestamp(),
        source: 'runtime',
      });
    }

    return items;
  }, [confirmations, dispatches, tasks, uploads]);

  const mergedEntries = useMemo(
    () => [...localCreatedEntries, ...dynamicEntries, ...MEMORY_ENTRIES],
    [dynamicEntries, localCreatedEntries],
  );

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const local = localSearch(q, mergedEntries);
    setSearchResults(local.length > 0 ? local : null);
    setSearching(true);
    try {
      const remote = await remoteSearch(q);
      if (remote.length > 0) {
        setSearchResults(remote);
      }
    } finally {
      setSearching(false);
    }
  }, [mergedEntries]);

  const resetComposer = useCallback(() => {
    setDraftContent('');
    setEditingEntryId(null);
  }, []);

  const handleSaveMemory = useCallback(async () => {
    const text = draftContent.trim();
    if (!text || saving) {
      return;
    }

    setSaving(true);
    setSaveNotice(null);

    const timestamp = formatMemoryTimestamp();

    if (editingEntryId) {
      setLocalCreatedEntries(items => items.map(item =>
        item.id === editingEntryId
          ? {...item, category: draftCategory, content: text, timestamp}
          : item,
      ));

      const ok = await storeRemoteMemory({text, category: draftCategory});

      setLocalCreatedEntries(items => items.map(item =>
        item.id === editingEntryId
          ? {
              ...item,
              remoteStatus: ok ? 'synced' : 'local_only',
              agent: ok ? '移动端写入 / 已同步' : '移动端写入 / 待补写',
            }
          : item,
      ));

      registerMemoryCapture({
        content: text,
        category: draftCategory,
        savedRemotely: ok,
        mode: 'updated',
      });

      setSaving(false);
      setSaveNotice(ok
        ? '✓ 已更新这条记忆，并重新同步到 OpenClaw 记忆层。'
        : '⚠️ 已更新本地内容，但远程补写仍未成功，稍后可继续补写。');
      resetComposer();
      return;
    }

    const optimisticEntry: MemoryEntry = {
      id: `local-${Date.now()}`,
      category: draftCategory,
      content: text,
      agent: '移动端写入',
      timestamp,
      source: 'created',
      remoteStatus: 'local_only',
      editable: true,
    };

    setLocalCreatedEntries(items => [optimisticEntry, ...items]);
    setActiveFilter(toFilterCategory(draftCategory));
    setSearchQuery('');
    setSearchResults(null);

    const ok = await storeRemoteMemory({text, category: draftCategory});

    setLocalCreatedEntries(items => items.map(item =>
      item.id === optimisticEntry.id
        ? {
            ...item,
            remoteStatus: ok ? 'synced' : 'local_only',
            agent: ok ? '移动端写入 / 已同步' : '移动端写入 / 待补写',
          }
        : item,
    ));

    registerMemoryCapture({
      content: text,
      category: draftCategory,
      savedRemotely: ok,
      mode: 'created',
    });

    setSaving(false);
    setSaveNotice(ok
      ? '✓ 已写入 OpenClaw 记忆层，并同步保留在移动端列表中。'
      : '⚠️ 远程写入暂未成功，已先保存在本地当前会话里。');
    resetComposer();
  }, [draftCategory, draftContent, editingEntryId, resetComposer, saving]);

  const handleReplayToComposer = useCallback((entry: MemoryEntry) => {
    setDraftCategory(entry.category);
    setDraftContent(entry.content);
    setEditingEntryId(entry.source === 'created' ? entry.id : null);
    setSaveNotice(entry.source === 'created'
      ? '已把这条记忆回填到编辑区，你可以直接改后再补写。'
      : '已把这条记忆回填到编辑区，你可以基于它整理出新的沉淀版本。');
  }, []);

  const handleRetryRemoteSync = useCallback(async (entry: MemoryEntry) => {
    if (retryingEntryId || entry.source !== 'created') {
      return;
    }

    setRetryingEntryId(entry.id);
    setSaveNotice(null);
    const ok = await storeRemoteMemory({text: entry.content, category: entry.category});

    setLocalCreatedEntries(items => items.map(item =>
      item.id === entry.id
        ? {
            ...item,
            remoteStatus: ok ? 'synced' : 'local_only',
            agent: ok ? '移动端写入 / 已同步' : '移动端写入 / 待补写',
            timestamp: formatMemoryTimestamp(),
          }
        : item,
    ));

    if (ok) {
      registerMemoryCapture({
        content: entry.content,
        category: entry.category,
        savedRemotely: true,
        mode: 'resynced',
      });
    }

    setRetryingEntryId(null);
    setSaveNotice(ok
      ? '✓ 已把待补写记忆成功补入 OpenClaw 远程记忆层。'
      : '⚠️ 补写仍未成功，这条内容继续保留在本地闭环中。');
  }, [registerMemoryCapture, retryingEntryId]);

  const filtered = useMemo(() => {
    if (searchResults) {
      return activeFilter === '全部'
        ? searchResults
        : searchResults.filter(e => {
            const map: Record<string, MemoryCategory> = {
              '偏好': 'preference', '决策': 'decision', '事实': 'fact', '规则': 'rule',
            };
            return e.category === map[activeFilter];
          });
    }
    if (activeFilter === '全部') return mergedEntries;
    return mergedEntries.filter(e => {
      const map: Record<string, MemoryCategory> = {
        '偏好': 'preference', '决策': 'decision', '事实': 'fact', '规则': 'rule',
      };
      return e.category === map[activeFilter];
    });
  }, [activeFilter, mergedEntries, searchResults]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>🧠 记忆库</Text>
        <Text style={styles.sub}>{mergedEntries.length} 条记忆 · {searchResults ? `搜索结果 ${filtered.length} 条` : '长期 + 短期'}</Text>
        <Text style={styles.helper}>实时状态自动汇入 · 新增记忆支持本地与远程同步</Text>

        <View style={styles.composerCard}>
          <Text style={styles.composerTitle}>{editingEntryId ? '编辑记忆' : '新增记忆'}</Text>
          <Text style={styles.composerHint}>{editingEntryId ? '这次不是重新新建，而是直接修改刚才那条记忆，并尝试重新同步。' : '把这轮对话里真正值得沉淀的事实、决策、偏好或规则直接写回 OpenClaw 记忆层。'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerChipRow}>
            {(['preference', 'decision', 'fact', 'rule'] as MemoryCategory[]).map(category => {
              const meta = CATEGORY_META[category];
              const active = draftCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.composerChip,
                    active && {backgroundColor: `${meta.color}22`, borderColor: meta.color},
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setDraftCategory(category)}
                >
                  <Text style={styles.composerChipEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.composerChipText, active && {color: meta.color}]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TextInput
            value={draftContent}
            onChangeText={setDraftContent}
            placeholder="比如：用户明确要求首页只展示 AI 产出流、调度状态、需确认项。"
            placeholderTextColor={C.textMuted}
            style={styles.composerInput}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.composerFooter}>
            <Text style={styles.composerFooterHint}>{saving ? '正在写入 OpenClaw 记忆层…' : editingEntryId ? '保存后会先更新本地，再尝试补写远程记忆层。' : '移动端先本地落一份，再尝试远程写入。'}</Text>
            <View style={styles.composerFooterActions}>
              {editingEntryId ? (
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.8} onPress={resetComposer}>
                  <Text style={styles.cancelBtnText}>取消编辑</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.saveBtn, (!draftContent.trim() || saving) && styles.saveBtnDisabled]}
                activeOpacity={0.8}
                onPress={handleSaveMemory}
                disabled={!draftContent.trim() || saving}
              >
                <Text style={styles.saveBtnText}>{saving ? '写入中' : editingEntryId ? '保存并补写' : '写入记忆'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {saveNotice ? <Text style={styles.saveNotice}>{saveNotice}</Text> : null}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            onSubmitEditing={e => handleSearch(e.nativeEvent.text)}
            placeholder="搜索记忆…"
            placeholderTextColor={C.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={C.primary} style={styles.searchSpinner} />}
          {searchQuery.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {searchResults !== null && (
          <Text style={styles.searchHint}>
            本地 {localSearch(searchQuery, mergedEntries).length} 条 · {searchResults.length} 条远程记忆
          </Text>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {CATEGORY_FILTER.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {filtered.map(entry => {
          const meta = CATEGORY_META[entry.category];
          const isRetrying = retryingEntryId === entry.id;
          const showActions = entry.source === 'created' || entry.source === 'remote';
          return (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.catBadge, {backgroundColor: meta.color + '22', borderColor: meta.color + '44'}]}>
                  <Text style={styles.catEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.catLabel, {color: meta.color}]}>{meta.label}</Text>
                </View>
                <Text style={styles.timestamp}>{entry.timestamp}</Text>
              </View>
              <Text style={styles.cardContent}>{entry.content}</Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardAgent}>👤 {entry.agent}</Text>
                {entry.source === 'created' ? (
                  <View style={[
                    styles.syncBadge,
                    entry.remoteStatus === 'synced' ? styles.syncBadgeOk : styles.syncBadgeWarn,
                  ]}>
                    <Text style={styles.syncBadgeText}>
                      {entry.remoteStatus === 'synced' ? '已同步远程' : '待补写'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {showActions ? (
                <View style={styles.cardActionRow}>
                  <TouchableOpacity style={styles.cardActionBtn} activeOpacity={0.8} onPress={() => handleReplayToComposer(entry)}>
                    <Text style={styles.cardActionText}>{entry.source === 'created' ? '继续编辑' : '回填草稿'}</Text>
                  </TouchableOpacity>
                  {entry.source === 'created' && entry.remoteStatus !== 'synced' ? (
                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.retryBtn, isRetrying && styles.retryBtnDisabled]}
                      activeOpacity={0.8}
                      onPress={() => handleRetryRemoteSync(entry)}
                      disabled={isRetrying}
                    >
                      <Text style={styles.retryBtnText}>{isRetrying ? '补写中…' : '补写远程'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
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
  composerCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.7)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  composerTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900'},
  composerHint: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6},
  composerChipRow: {gap: 8, flexDirection: 'row', marginTop: 12},
  composerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.1)', borderWidth: 1, borderColor: C.borderSubtle,
  },
  composerChipEmoji: {fontSize: 12},
  composerChipText: {color: C.textMuted, fontSize: 12, fontWeight: '800'},
  composerInput: {
    minHeight: 88,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: C.textTitle,
    backgroundColor: 'rgba(5,13,26,0.9)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
  composerFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  composerFooterHint: {flex: 1, color: C.textMuted, fontSize: 11, lineHeight: 16},
  composerFooterActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  saveBtnDisabled: {opacity: 0.45},
  saveBtnText: {color: C.bgRoot, fontSize: 13, fontWeight: '900'},
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    backgroundColor: 'rgba(56,100,200,0.08)',
  },
  cancelBtnText: {color: C.textBody, fontSize: 12, fontWeight: '800'},
  saveNotice: {color: C.primary, fontSize: 11, lineHeight: 16, marginTop: 10},
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
  searchSpinner: {marginLeft: -4},
  clearBtn:     {color: C.textMuted, fontSize: 16, fontWeight: '700', paddingHorizontal: 8},
  searchHint:   {color: C.textMuted, fontSize: 11, marginTop: 6},
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
  timestamp: {color: C.textMuted, fontSize: 11},
  cardContent:{color: C.textBody, fontSize: 14, lineHeight: 20},
  cardMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardAgent:  {color: C.textMuted, fontSize: 11, flex: 1},
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  syncBadgeOk: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: '#34d399',
  },
  syncBadgeWarn: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: '#fbbf24',
  },
  syncBadgeText: {color: C.textBody, fontSize: 10, fontWeight: '800'},
  cardActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  cardActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  cardActionText: {color: C.primary, fontSize: 12, fontWeight: '800'},
  retryBtn: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: '#fbbf24',
  },
  retryBtnDisabled: {opacity: 0.5},
  retryBtnText: {color: '#fbbf24', fontSize: 12, fontWeight: '800'},
  footer:     {height: 24},
});
