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

// ─── 真实数据获取（TODO: 替换为真实 API） ────────────────────────────────────

/**
 * TODO: replace with real Feishu message API
 * 正确路径：feishu_im_user_get_messages — 获取单聊历史
 * 按 sender open_id 聚合，提取最后一条消息
 */
async function fetchConversations(): Promise<ConversationItem[]> {
  // TODO: replace with real API call
  await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
  return MOCK_CONVERSATIONS;
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
