/**
 * DispatchCard — 调度状态卡片
 *
 * 显示被调度 Agent 的头像、名称、状态和处理结果。
 *
 * 状态定义：
 *   pending    — 灰色圆点，等待发送
 *   processing — 绿色脉冲动画，执行中
 *   done       — 绿色勾号 + 结果文本
 *   failed     — 红色叉号 + 错误信息
 */

import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';
import {C} from '../data/constants';
import type {DispatchStatus} from '../services/DispatchService';

// ─── Agent 元信息 ─────────────────────────────────────────────────────────

interface AgentMeta {
  name: string;
  role: string;
  accent: string;
}

const AGENT_META: Record<string, AgentMeta> = {
  xunlong:  {name: '寻龙',  role: '矿业研究员',   accent: '#fbbf24'},
  tansuo:   {name: '探索',  role: '采选矿专家',    accent: '#fb7185'},
  wuyin:    {name: '无垠',  role: '矿山项目工程',  accent: '#34d399'},
  kaifa:    {name: '开发',  role: 'Codex 开发Bot', accent: '#4ade80'},
  zhilian:  {name: '智联',  role: '知识库管理员',  accent: '#38bdf8'},
  heijin:   {name: '黑金',  role: 'AI项目工程师',  accent: '#f97316'},
  zhuli:    {name: '助理',  role: 'AI 总指挥',     accent: '#22d3ee'},
};

const UNKNOWN_AGENT: AgentMeta = {name: '未知', role: '', accent: C.textMuted};

// ─── Avatar 组件 ──────────────────────────────────────────────────────────

interface AvatarProps {
  agentId: string;
  size?: number;
}

function AgentAvatar({agentId, size = 40}: AvatarProps) {
  const meta = AGENT_META[agentId] ?? UNKNOWN_AGENT;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: meta.accent + '22',
          borderColor: meta.accent,
        },
      ]}
    >
      <Text
        style={[
          styles.avatarInitial,
          {fontSize: size * 0.38, color: meta.accent},
        ]}
      >
        {meta.name.charAt(0)}
      </Text>
    </View>
  );
}

// ─── 状态指示器 ──────────────────────────────────────────────────────────

interface StatusDotProps {
  status: DispatchStatus;
}

function StatusDot({status}: StatusDotProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'processing') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [status, pulseAnim]);

  if (status === 'pending') {
    return <View style={[styles.dot, styles.dotPending]} />;
  }

  if (status === 'processing') {
    return (
      <View style={styles.dotProcessingWrapper}>
        <Animated.View
          style={[
            styles.dotPulse,
            {
              backgroundColor: C.success,
              opacity: pulseAnim.interpolate({inputRange: [0, 1], outputRange: [0.5, 0]}),
              transform: [{scale: pulseAnim.interpolate({inputRange: [0, 1], outputRange: [1, 1.8]})}],
            },
          ]}
        />
        <View style={[styles.dot, styles.dotProcessing]} />
      </View>
    );
  }

  if (status === 'done') {
    return (
      <View style={[styles.dot, styles.dotDone]}>
        <Text style={styles.checkmark}>✓</Text>
      </View>
    );
  }

  // failed
  return (
    <View style={[styles.dot, styles.dotFailed]}>
      <Text style={styles.checkmark}>✕</Text>
    </View>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────

interface DispatchCardProps {
  agentId: string;
  description?: string;
  status: DispatchStatus;
  replyText?: string;
  errorText?: string;
}

export function DispatchCard({
  agentId,
  description,
  status,
  replyText,
  errorText,
}: DispatchCardProps) {
  const meta = AGENT_META[agentId] ?? UNKNOWN_AGENT;

  return (
    <View style={styles.card}>
      {/* Header: Avatar + Agent Info + Status */}
      <View style={styles.header}>
        <AgentAvatar agentId={agentId} size={40} />
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>{meta.name}</Text>
          <Text style={styles.agentRole}>{meta.role}</Text>
        </View>
        <StatusDot status={status} />
      </View>

      {/* Description (routing reason) */}
      {description ? (
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      {/* Result area */}
      {status === 'done' && replyText ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText} numberOfLines={4}>
            {replyText}
          </Text>
        </View>
      ) : null}

      {status === 'failed' && errorText ? (
        <View style={[styles.resultBox, styles.resultBoxError]}>
          <Text style={[styles.resultText, styles.resultTextError]}>
            {errorText}
          </Text>
        </View>
      ) : null}

      {status === 'processing' ? (
        <View style={styles.processingRow}>
          <Text style={styles.processingText}>正在处理中…</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── 样式 ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontWeight: '700',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  agentRole: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  description: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 10,
    lineHeight: 16,
  },
  resultBox: {
    marginTop: 10,
    backgroundColor: C.bgElevated,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.success,
  },
  resultBoxError: {
    borderLeftColor: C.error,
  },
  resultText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  resultTextError: {
    color: C.error,
  },
  processingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  processingText: {
    color: C.textMuted,
    fontSize: 12,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPending: {
    backgroundColor: C.textMuted,
  },
  dotProcessing: {
    backgroundColor: C.success,
  },
  dotDone: {
    backgroundColor: C.success,
  },
  dotFailed: {
    backgroundColor: C.error,
  },
  dotProcessingWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dotPulse: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  checkmark: {
    color: C.bgRoot,
    fontSize: 11,
    fontWeight: '900',
  },
});
