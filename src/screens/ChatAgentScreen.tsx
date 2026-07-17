/**
 * ChatAgentScreen — 飞书风格单聊界面（指定 Agent）
 *
 * 对话架构：
 * - Header: Agent 头像 + 名称 + 在线状态
 * - 消息列表: 按时间正序，显示用户/Agent 双方气泡
 * - 底部: 文字输入框 + 发送按钮
 * - 空状态: 首次对话提示语
 *
 * 导航参数:
 *   agentId   — Agent ID (拼音)
 *   agentName — 显示名
 *   agentRole — 角色描述
 *   accent   — 主题色
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/constants';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChatAgentStackParam = {
  ChatAgent: {
    agentId: string;
    agentName: string;
    agentRole: string;
    accent: string;
  };
};

type Message = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
};

// ─── Mock 历史消息（接真实 API 后替换）─────────────────────────────────────

function buildMockHistory(agentId: string, agentName: string): Message[] {
  const now = Date.now();
  const welcomeMessages: Record<string, Message[]> = {
    zhuli: [
      {id: '1', role: 'agent', text: '我是助理，随时接收指令。回复将显示在下方，可前往「智能体」查看调度详情。', timestamp: now - 5 * 60 * 1000},
    ],
    xunlong: [
      {id: '1', role: 'agent', text: '我是寻龙，专注于全球矿业情报。钨价、供需、政策、地缘，我都能追踪。有任何矿业研究需求，直接说。', timestamp: now - 38 * 60 * 1000},
    ],
    wuyin: [
      {id: '1', role: 'agent', text: '我是无垠，负责矿山工程与智慧矿山落地。三维建模、井巷设计、智能管控，有项目问题随时发。', timestamp: now - 2 * 60 * 60 * 1000},
    ],
    tansuo: [
      {id: '1', role: 'agent', text: '我是探索，专注于采选矿工艺。浮选参数、回收率优化、矿石化验，统统可以聊。', timestamp: now - 3 * 60 * 60 * 1000},
    ],
    zhilian: [
      {id: '1', role: 'agent', text: '我是智联，负责知识库与记忆管理。资料归档、NAS 备份、知识检索，找我就对。', timestamp: now - 5 * 60 * 60 * 1000},
    ],
    heijin: [
      {id: '1', role: 'agent', text: '我是黑金，专注 AI 协作平台与产品工程。代码、架构、产品推进，我来扛。', timestamp: now - 8 * 60 * 60 * 1000},
    ],
  };
  return welcomeMessages[agentId] ?? [
    {id: '1', role: 'agent', text: `你好，我是${agentName}。有什么可以帮你的？`, timestamp: now - 60 * 1000},
  ];
}

// ─── 单条气泡 ───────────────────────────────────────────────────────────────

function MessageBubble({msg, accent, agentName}: {msg: Message; accent: string; agentName: string}) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.bubbleAvatar, {backgroundColor: accent + '28', borderColor: accent + '60'}]}>
          <Text style={[styles.bubbleAvatarText, {color: accent}]}>{agentName.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.bubbleCol}>
        {!isUser && (
          <Text style={[styles.bubbleName, {color: accent}]}>{agentName}</Text>
        )}
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAgent,
          isUser ? {backgroundColor: C.primary} : {backgroundColor: C.bgCard},
        ]}>
          <Text style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextAgent,
          ]}>{msg.text}</Text>
        </View>
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}
        </Text>
      </View>
    </View>
  );
}

// ─── 主界面 ────────────────────────────────────────────────────────────────

export function ChatAgentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ChatAgentStackParam>>();
  const route = useRoute<RouteProp<ChatAgentStackParam, 'ChatAgent'>>();
  const {agentId, agentName, agentRole, accent} = route.params;

  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // 加载历史（接真实 API 后替换）
  useEffect(() => {
    setLoading(true);
    // TODO: 接入 feishu_im_user_get_messages，按 agentId 对应的飞书单聊获取历史
    const timer = setTimeout(() => {
      setMessages(buildMockHistory(agentId, agentName));
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: false}), 50);
    }, 400);
    return () => clearTimeout(timer);
  }, [agentId, agentName]);

  // 发送消息
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const userMsg: Message = {id: String(Date.now()), role: 'user', text, timestamp: Date.now()};
    setMessages(m => [...m, userMsg]);
    setDraft('');
    setSending(true);
    scrollRef.current?.scrollToEnd({animated: true});

    try {
      // TODO: 接入真实 API（feishu_im_user_message 或 Agent dispatch）
      await new Promise<void>(resolve => setTimeout(() => resolve(), 800));
      const agentMsg: Message = {
        id: String(Date.now() + 1),
        role: 'agent',
        text: `[${agentName} 回复]: 已收到「${text.slice(0, 20)}${text.length > 20 ? '…' : ''}」，功能接入中请稍候。`,
        timestamp: Date.now(),
      };
      setMessages(m => [...m, agentMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: String(Date.now() + 1),
        role: 'agent',
        text: `⚠️ 发送失败: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages(m => [...m, errMsg]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [draft, sending, agentName]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flexCol}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={[styles.headerAvatar, {backgroundColor: accent + '28', borderColor: accent + '60'}]}>
            <Text style={[styles.headerAvatarText, {color: accent}]}>{agentName.charAt(0)}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, {color: accent}]}>{agentName}</Text>
            <Text style={styles.headerSub}>{agentRole}</Text>
          </View>
          <View style={[styles.headerOnlineDot, {backgroundColor: accent}]} />
        </View>

        {/* ── 消息列表 ── */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>加载对话记录…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>向 {agentName} 发起对话</Text>
            <Text style={styles.emptyText}>
              输入内容发送即可对话{'\n'}{agentRole}
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({animated: true})}
          >
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} accent={accent} agentName={agentName} />
            ))}
          </ScrollView>
        )}

        {/* ── 输入框 ── */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={`发消息给 ${agentName}…`}
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={2000}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>›</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bgRoot},
  flexCol: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgCard,
    gap: 10,
  },
  backBtn: {width: 32, height: 32, justifyContent: 'center', alignItems: 'center'},
  backBtnText: {fontSize: 26, color: C.primary, fontWeight: '400'},
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: {fontSize: 15, fontWeight: '900'},
  headerText: {flex: 1},
  headerTitle: {fontSize: 16, fontWeight: '800'},
  headerSub: {fontSize: 12, color: C.textMuted, marginTop: 1},
  headerOnlineDot: {width: 8, height: 8, borderRadius: 4, marginLeft: 4},
  messageList: {flex: 1},
  messageListContent: {paddingHorizontal: 16, paddingVertical: 16, gap: 12},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12},
  loadingText: {color: C.textMuted, fontSize: 14},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40},
  emptyEmoji: {fontSize: 52, marginBottom: 16},
  emptyTitle: {fontSize: 20, fontWeight: '800', color: C.textTitle, marginBottom: 8},
  emptyText: {fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22},
  bubbleRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  bubbleRowUser: {flexDirection: 'row-reverse'},
  bubbleAvatar: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  bubbleAvatarText: {fontSize: 12, fontWeight: '900'},
  bubbleCol: {maxWidth: '75%', gap: 3},
  bubbleName: {fontSize: 12, fontWeight: '700', marginLeft: 4},
  bubble: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: '100%'},
  bubbleUser: {borderBottomRightRadius: 4},
  bubbleAgent: {borderBottomLeftRadius: 4},
  bubbleText: {fontSize: 15, lineHeight: 21},
  bubbleTextAgent: {color: C.textBody},
  bubbleTextUser: {color: '#fff'},
  bubbleTime: {fontSize: 11, color: C.textMuted, marginLeft: 4},
  bubbleTimeUser: {textAlign: 'right', marginRight: 4},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
    backgroundColor: C.bgCard,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.bgRoot,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: C.textTitle,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: {backgroundColor: C.borderSubtle},
  sendBtnText: {color: '#fff', fontSize: 20, fontWeight: '900'},
});
