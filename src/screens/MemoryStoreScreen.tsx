import React, {useMemo, useState, useCallback} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {gatewayInvoke} from '../data/api';

// ─── Mock Memory Entries ─────────────────────────────────────────────────────
interface MemoryEntry {
  id: string;
  category: 'preference' | 'decision' | 'fact' | 'rule';
  content: string;
  agent: string;
  timestamp: string;
}

const MEMORY_ENTRIES: MemoryEntry[] = [
  {id:'m1', category:'decision', content:'P0 只做 AI 大脑驾驶舱，不做通用 IM 功能', agent:'助理', timestamp:'2026-05-06'},
  {id:'m2', category:'rule',     content:'前端不设上下文长度限制，后端处理策略', agent:'黑金', timestamp:'2026-05-06'},
  {id:'m3', category:'fact',     content:'移动端 Alpha 采用 React Native 0.85.2', agent:'开发', timestamp:'2026-05-05'},
  {id:'m4', category:'preference', content:'用户偏好深色主题，星际蓝配色', agent:'助理', timestamp:'2026-05-05'},
  {id:'m5', category:'decision', content:'附件上传不设前端硬限制，后端自行分片', agent:'助理', timestamp:'2026-05-05'},
  {id:'m6', category:'rule',     content:'调度链必须可追踪，每条指令有 receive → deliver', agent:'助理', timestamp:'2026-05-04'},
  {id:'m7', category:'fact',     content:'聚源三维项目优先级高于内部效率工具', agent:'无垠', timestamp:'2026-05-04'},
  {id:'m8', category:'preference', content:'用户希望任务以 Kanban 视图呈现，优先级醒目', agent:'助理', timestamp:'2026-05-03'},
];

const CATEGORY_META: Record<MemoryEntry['category'], {emoji: string; label: string; color: string}> = {
  preference: {emoji:'⭐', label:'偏好', color:'#fbbf24'},
  decision:   {emoji:'✅', label:'决策', color:'#34d399'},
  fact:       {emoji:'📌', label:'事实', color:C.primary},
  rule:       {emoji:'⚙️', label:'规则', color:'#a78bfa'},
};

const CATEGORY_FILTER = ['全部', '偏好', '决策', '事实', '规则'] as const;
type FilterKey = typeof CATEGORY_FILTER[number];

interface SearchResult {
  id: string;
  category: MemoryEntry['category'];
  content: string;
  agent: string;
  timestamp: string;
}

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
      category: (item.category as MemoryEntry['category']) ?? 'fact',
      content: item.text,
      agent: item.scope ?? '远程记忆',
      timestamp: new Date().toLocaleDateString('zh-CN'),
    }));
  } catch {
    return [];
  }
}

export function MemoryStoreScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const {dispatches, tasks, uploads, confirmations} = useAppContext();

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
      });
    }

    const runningTask = tasks.find(task => task.state === 'running');
    if (runningTask) {
      items.push({
        id: `task-${runningTask.id}`,
        category: 'fact',
        content: `当前最活跃任务是「${runningTask.title}」，下一步：${runningTask.next}`,
        agent: runningTask.owner,
        timestamp: new Date().toLocaleDateString('zh-CN'),
      });
    }

    const activeUpload = uploads.find(file => file.status === 'uploading' || file.status === 'processing' || file.status === 'dispatched');
    if (activeUpload) {
      items.push({
        id: `upload-${activeUpload.id}`,
        category: 'decision',
        content: `附件链路已激活：${activeUpload.name} 当前处于「${activeUpload.status}」状态，前端上传闭环有效。`,
        agent: activeUpload.agent ?? '附件队列',
        timestamp: new Date().toLocaleDateString('zh-CN'),
      });
    }

    const pendingConfirmation = confirmations.find(item => item.status !== 'confirmed' && item.status !== 'deferred');
    if (pendingConfirmation) {
      items.push({
        id: `confirmation-${pendingConfirmation.id}`,
        category: 'rule',
        content: `仍有需确认项待处理：${pendingConfirmation.title}。产品层保留“需确认项”作为闭环中的人工决策入口。`,
        agent: pendingConfirmation.agent,
        timestamp: new Date().toLocaleDateString('zh-CN'),
      });
    }

    return items;
  }, [confirmations, dispatches, tasks, uploads]);

  const mergedEntries = useMemo(() => [...dynamicEntries, ...MEMORY_ENTRIES], [dynamicEntries]);

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

  const filtered = useMemo(() => {
    if (searchResults) {
      return activeFilter === '全部'
        ? searchResults
        : searchResults.filter(e => {
            const map: Record<string, MemoryEntry['category']> = {
              '偏好': 'preference', '决策': 'decision', '事实': 'fact', '规则': 'rule',
            };
            return e.category === map[activeFilter];
          });
    }
    if (activeFilter === '全部') return mergedEntries;
    return mergedEntries.filter(e => {
      const map: Record<string, MemoryEntry['category']> = {
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
        <Text style={styles.helper}>已接入实时上下文：最新调度、活跃任务、附件链路、待确认决策会自动汇入这里。</Text>

        {/* Search bar */}
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

      {/* Filter chips */}
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
              <Text style={styles.cardAgent}>👤 {entry.agent}</Text>
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
  cardAgent:  {color: C.textMuted, fontSize: 11, marginTop: 8},
  footer:     {height: 24},
});
