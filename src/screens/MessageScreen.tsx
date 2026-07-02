/**
 * MessageScreen — 消息列表 UI
 *
 * 展示与各 Agent 的对话会话列表。
 * 真实数据源：飞书单聊消息历史（feishu_im_user_get_messages）
 * 降级：mock 数据（标注 TODO）
 *
 * 每个会话项显示：
 * - Agent 头像（彩色圆点 + 首字母）
 * - Agent 名称 + 角色
 * - 最后一条消息摘要
 * - 时间戳
 * - 未读badge（如有）
 */

import React, {useCallback, useEffect, useState, useMemo} from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/constants';
import {gatewayWS} from '../services/GatewayWSService';
import {MessageStore} from '../stores/MessageStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationItem {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  accent: string;
  lastMessage: string;
  timestamp: number; // ms
  unread: number;
  // TODO: replace with real API — 飞书消息历史
  // 接入 feishu_im_user_get_messages，按 sender open_id 聚合会话
}

// ─── Mock 数据（接真实 API 后删除 TODO 标注） ───────────────────────────────

const MOCK_CONVERSATIONS: ConversationItem[] = [
  {
    id: 'conv_zhuli',
    agentId: 'zhuli',
    agentName: '助理',
    agentRole: 'AI 总指挥',
    accent: C.zhuli,
    lastMessage: 'TestFlight 上架链路还需要你确认签名配置，点击查看详情。',
    timestamp: Date.now() - 5 * 60 * 1000,
    unread: 2,
  },
  {
    id: 'conv_xunlong',
    agentId: 'xunlong',
    agentName: '寻龙',
    agentRole: '矿业研究员',
    accent: C.xunlong,
    lastMessage: '钨精矿价格更新：65%品位报价11.8万元/吨，较昨日上涨2%。',
    timestamp: Date.now() - 38 * 60 * 1000,
    unread: 0,
  },
  {
    id: 'conv_wuyin',
    agentId: 'wuyin',
    agentName: '无垠',
    agentRole: '矿山项目工程',
    accent: C.wuyin,
    lastMessage: '聚源三维地形已更新，最新缓存已推送至 NAS。',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    unread: 0,
  },
  {
    id: 'conv_tansuo',
    agentId: 'tansuo',
    agentName: '探索',
    agentRole: '采选矿专家',
    accent: C.tansuo,
    lastMessage: 'XRT 智能分选系统今日处理量 3,200 吨，回收率 94.2%。',
    timestamp: Date.now() - 4 * 60 * 60 * 1000,
    unread: 0,
  },
  {
    id: 'conv_zhilian',
    agentId: 'zhilian',
    agentName: '智联',
    agentRole: '知识库管理员',
    accent: C.zhilian,
    lastMessage: '本周记忆归档已完成，共沉淀 12 条关键决策记录。',
    timestamp: Date.now() - 6 * 60 * 60 * 1000,
    unread: 0,
  },
  {
    id: 'conv_heijin',
    agentId: 'heijin',
    agentName: '黑金',
    agentRole: 'AI 项目工程师',
    accent: C.heijin,
    lastMessage: 'AIBrainIM Build 20260607 已推送 TestFlight，修复了 AppDelegate 启动崩溃。',
    timestamp: Date.now() - 18 * 60 * 60 * 1000,
    unread: 0,
  },
];

// ─── 时间格式化 ──────────────────────────────────────────────────────────────

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHr < 24) return `${diffHr} 小时前`;
  if (diffDay === 1) return '昨天';
  if (diffDay < 7) return `${diffDay} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── AgentAvatar ─────────────────────────────────────────────────────────────

function AgentAvatar({agentId, agentName, accent, size = 46}: {
  agentId: string; agentName: string; accent: string; size?: number;
}) {
  const initial = agentName.charAt(0);
  return (
    <View style={[
      styles.avatar,
      {width: size, height: size, borderRadius: size / 2, backgroundColor: accent + '28', borderColor: accent + '60'},
    ]}>
      <Text style={[styles.avatarInitial, {color: accent, fontSize: size * 0.42}]}>{initial}</Text>
    </View>
  );
}

// ─── ConversationRow ──────────────────────────────────────────────────────────

function ConversationRow({
  item,
  onPress,
}: {
  item: ConversationItem;
  onPress: (item: ConversationItem) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
    >
      <AgentAvatar agentId={item.agentId} agentName={item.agentName} accent={item.accent} />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.agentName, {color: item.accent}]} numberOfLines={1}>{item.agentName}</Text>
          <Text style={styles.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
        </View>
        <Text style={styles.agentRole} numberOfLines={1}>{item.agentRole}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
      </View>
      {item.unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── ListHeader ───────────────────────────────────────────────────────────────

function ListHeader({total}: {total: number}) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>消息</Text>
      <Text style={styles.headerSubtitle}>{total} 个活跃会话</Text>
    </View>
  );
}

// ─── 空状态 ──────────────────────────────────────────────────────────────────

function EmptyState({loading}: {loading: boolean}) {
  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.emptyText}>加载消息记录…</Text>
      </View>
    );
  }
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>💬</Text>
      <Text style={styles.emptyTitle}>暂无消息</Text>
      <Text style={styles.emptyText}>向助理发送指令，AI 大脑即刻响应{'\n'}回复会显示在这里</Text>
    </View>
  );
}

// ─── 真实数据获取（接入 gatewayWS.listSessions） ───────────────────────────────

/** 从 MessageStore 获取某 session 的最后一条消息 */
function getLastMessageText(sessionKey: string): string {
  const msgs = MessageStore.getMessages(sessionKey);
  if (msgs.length === 0) return '暂无消息';
  const last = msgs[msgs.length - 1];
  return last.content.length > 60 ? last.content.slice(0, 60) + '…' : last.content;
}

async function fetchConversations(): Promise<ConversationItem[]> {
  try {
    // 确保 gatewayWS 已连接
    if (!gatewayWS.isConnected()) {
      const result = await gatewayWS.connect();
      if (!result.ok) {
        console.warn('[MessageScreen] gatewayWS connect failed, using mock');
        return MOCK_CONVERSATIONS;
      }
    }

    const sessions = await gatewayWS.listSessions();
    if (!Array.isArray(sessions) || sessions.length === 0) {
      // 无活跃 session，回退到主会话
      return MOCK_CONVERSATIONS;
    }

    // 构建真实会话列表（优先 main/zhuli）
    const mainSession = sessions.find(
      (s: any) => s.key === 'main' || s.sessionKey === 'main'
    );

    const result: ConversationItem[] = [];

    // 主会话（助理）
    result.push({
      id: 'conv_zhuli',
      agentId: 'zhuli',
      agentName: '助理',
      agentRole: 'AI 总指挥',
      accent: C.zhuli,
      lastMessage: getLastMessageText('main'),
      timestamp: Date.now(),
      unread: 0,
    });

    // 其他活跃 session（如果有）
    for (const s of sessions) {
      const key = (s as any).key ?? (s as any).sessionKey ?? '';
      if (!key || key === 'main') continue;
      const agentId = (s as any).agentId ?? (s as any).id ?? key;
      const meta = getAgentMeta(agentId);
      result.push({
        id: `conv_${agentId}`,
        agentId,
        agentName: meta.name,
        agentRole: meta.role,
        accent: meta.accent,
        lastMessage: getLastMessageText(key),
        timestamp: (s as any).lastMessageAt ?? Date.now(),
        unread: (s as any).unreadCount ?? 0,
      });
    }

    return result;
  } catch (err) {
    console.warn('[MessageScreen] fetchConversations error, using mock:', err);
    return MOCK_CONVERSATIONS;
  }
}

/** 从 AgentMeta 表查 agent 基本信息 */
function getAgentMeta(agentId: string): {name: string; role: string; accent: string} {
  const META: Record<string, {name: string; role: string; accent: string}> = {
    xunlong: {name: '寻龙', role: '矿业研究员', accent: C.xunlong},
    wuyin:   {name: '无垠', role: '矿山项目工程', accent: C.wuyin},
    tansuo:  {name: '探索', role: '采选矿专家', accent: C.tansuo},
    zhilian: {name: '智联', role: '知识库管理员', accent: C.zhilian},
    heijin:  {name: '黑金', role: 'AI 项目工程师', accent: C.heijin},
    renzhi:  {name: '认知中枢', role: '后台认知层', accent: C.renzhi},
    jiancha: {name: '监察', role: '风险审计', accent: '#A78BFA'},
    kaifa:   {name: '开发', role: 'Codex 开发 Bot', accent: C.kaifa},
  };
  return META[agentId] ?? {name: agentId, role: 'Agent', accent: C.primary};
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

type RootStackParamList = {
  Tabs: {screen?: string} | undefined;
  Chat: {agentId?: string; agentName?: string};
  ChatAgent: {agentId: string; agentName: string; agentRole: string; accent: string};
};

export function MessageScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
    } catch (err) {
      console.warn('[MessageScreen] fetchConversations failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── 实时更新：监听 MessageStore 变化，刷新会话列表 ──
  useEffect(() => {
    const unsub = MessageStore.subscribe('main', (msgs) => {
      if (msgs.length === 0) return;
      const last = msgs[msgs.length - 1];
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === 'conv_zhuli');
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessage: last.content.length > 60 ? last.content.slice(0, 60) + '…' : last.content,
          timestamp: last.timestamp,
        };
        return updated;
      });
    });
    return unsub;
  }, []);

  const handleConversationPress = useCallback((item: ConversationItem) => {
    navigation.navigate('ChatAgent', {
      agentId: item.agentId,
      agentName: item.agentName,
      agentRole: item.agentRole,
      accent: item.accent,
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <ConversationRow item={item} onPress={handleConversationPress} />
        )}
        ListHeaderComponent={<ListHeader total={conversations.length} />}
        ListEmptyComponent={<EmptyState loading={loading} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadConversations(true)}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bgRoot},
  header: {
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  headerTitle: {fontSize: 30, fontWeight: '900', color: C.textPrimary},
  headerSubtitle: {fontSize: 14, color: C.textMuted, marginTop: 3},
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16, backgroundColor: C.bgRoot,
  },
  avatar: {justifyContent: 'center', alignItems: 'center', borderWidth: 2, flexShrink: 0},
  avatarInitial: {fontWeight: '800'},
  rowContent: {flex: 1, marginLeft: 16, marginRight: 10},
  rowTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  agentName: {fontSize: 16, fontWeight: '800', flex: 1},
  timestamp: {fontSize: 12, color: C.textMuted, marginLeft: 8},
  agentRole: {fontSize: 12, color: C.textMuted, marginTop: 2},
  lastMessage: {fontSize: 14, color: C.textSecondary, marginTop: 4, lineHeight: 20},
  badge: {
    backgroundColor: C.primary, borderRadius: 10,
    minWidth: 20, height: 20, paddingHorizontal: 6,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  badgeText: {color: '#000', fontSize: 11, fontWeight: '900'},
  separator: {height: 1, backgroundColor: C.borderSubtle, marginLeft: 80},
  emptyList: {flexGrow: 1},
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingTop: 80,
  },
  emptyEmoji: {fontSize: 56, marginBottom: 18},
  emptyTitle: {fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 10},
  emptyText: {fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22},
});
