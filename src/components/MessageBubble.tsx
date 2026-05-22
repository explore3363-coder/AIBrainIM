import React, {memo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';
import type {Message} from '../types';

// ─── Agent accent color map ──────────────────────────────────────────────────
const AGENT_ACCENT: Record<string, string> = {
  zhuli:   C.zhuli,
  renzhi:  C.renzhi,
  xunlong: C.xunlong,
  wuyin:   C.wuyin,
  tansuo:  C.tansuo,
  zhilian: C.zhilian,
  heijin:  C.heijin,
  kaifa:   C.kaifa,
};

function getAccent(agentId?: string): string {
  if (!agentId) return C.primary;
  return AGENT_ACCENT[agentId] ?? C.primary;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ─── Status icon ──────────────────────────────────────────────────────────────
function StatusIcon({status}: {status?: 'pending' | 'success' | 'error'}) {
  if (!status) return null;
  if (status === 'pending') {
    return <Text style={styles.statusPending}>◌</Text>;
  }
  if (status === 'success') {
    return <Text style={styles.statusSuccess}>✓</Text>;
  }
  return <Text style={styles.statusError}>✕</Text>;
}

// ─── Bubble layouts per role ─────────────────────────────────────────────────
function UserBubble({content, timestamp, status}: {content: string; timestamp: number; status?: 'pending' | 'success' | 'error'}) {
  return (
    <View style={styles.bubbleUser}>
      <View style={styles.bubbleUserInner}>
        <Text style={styles.bubbleUserText}>{content}</Text>
        <View style={styles.bubbleMeta}>
          <Text style={styles.bubbleTime}>{formatTime(timestamp)}</Text>
          <StatusIcon status={status} />
        </View>
      </View>
    </View>
  );
}

function AgentBubble({
  agentName,
  agentId,
  content,
  timestamp,
  status,
}: {
  agentName?: string;
  agentId?: string;
  content: string;
  timestamp: number;
  status?: 'pending' | 'success' | 'error';
}) {
  const accent = getAccent(agentId);
  return (
    <View style={styles.bubbleAgent}>
      <View style={[styles.bubbleAgentInner, {borderColor: accent + '40'}]}>
        <View style={styles.bubbleHeader}>
          <View style={[styles.agentDot, {backgroundColor: accent}]} />
          <Text style={[styles.agentName, {color: accent}]}>{agentName ?? 'AI'}</Text>
          <StatusIcon status={status} />
        </View>
        <Text style={styles.bubbleAgentText}>{content}</Text>
        <Text style={styles.bubbleTime}>{formatTime(timestamp)}</Text>
      </View>
    </View>
  );
}

function SystemBubble({content, timestamp}: {content: string; timestamp: number}) {
  return (
    <View style={styles.bubbleSystem}>
      <View style={styles.bubbleSystemInner}>
        <Text style={styles.bubbleSystemText}>{content}</Text>
        <Text style={styles.bubbleTimeCenter}>{formatTime(timestamp)}</Text>
      </View>
    </View>
  );
}

function AIDispatchBubble({
  agentName,
  agentId,
  content,
  timestamp,
}: {
  agentName?: string;
  agentId?: string;
  content: string;
  timestamp: number;
}) {
  const accent = getAccent(agentId);
  return (
    <View style={styles.bubbleAIDispatch}>
      <View style={[styles.bubbleAIDispatchInner, {borderColor: accent + '60'}]}>
        <View style={styles.bubbleHeader}>
          <Text style={styles.dispatchLabel}>🤖 AI 调度</Text>
          <View style={[styles.agentDot, {backgroundColor: accent}]} />
          <Text style={[styles.agentName, {color: accent}]}>{agentName ?? 'Agent'}</Text>
        </View>
        <Text style={styles.bubbleDispatchText}>{content}</Text>
        <Text style={styles.bubbleTime}>{formatTime(timestamp)}</Text>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export interface MessageBubbleProps {
  message: Message;
  showTimestamp?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
}: MessageBubbleProps) {
  const {role, content, agentId, agentName, timestamp, status} = message;

  if (role === 'user') {
    return <UserBubble content={content} timestamp={timestamp} status={status} />;
  }

  if (role === 'agent') {
    return (
      <AgentBubble
        agentName={agentName}
        agentId={agentId}
        content={content}
        timestamp={timestamp}
        status={status}
      />
    );
  }

  if (role === 'system') {
    return <SystemBubble content={content} timestamp={timestamp} />;
  }

  if (role === 'ai-dispatch') {
    return (
      <AIDispatchBubble
        agentName={agentName}
        agentId={agentId}
        content={content}
        timestamp={timestamp}
      />
    );
  }

  // Fallback: treat as agent
  return (
    <AgentBubble
      agentName={agentName}
      agentId={agentId}
      content={content}
      timestamp={timestamp}
      status={status}
    />
  );
});

const styles = StyleSheet.create({
  // ── Common ───────────────────────────────────────────────────────────────
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  agentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  agentName: {
    fontSize: 11,
    fontWeight: '800',
  },
  bubbleTime: {
    color: C.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  bubbleTimeCenter: {
    color: C.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },

  // ── User bubble ──────────────────────────────────────────────────────────
  bubbleUser: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    marginBottom: 12,
  },
  bubbleUserInner: {
    padding: 14,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: 'rgba(2,132,199,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleUserText: {
    color: C.textBody,
    fontSize: 14,
    lineHeight: 20,
  },

  // ── Agent bubble ─────────────────────────────────────────────────────────
  bubbleAgent: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    marginBottom: 10,
  },
  bubbleAgentInner: {
    padding: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(14,24,42,0.85)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  bubbleAgentText: {
    color: C.textBody,
    fontSize: 14,
    lineHeight: 20,
  },

  // ── System bubble ────────────────────────────────────────────────────────
  bubbleSystem: {
    alignSelf: 'center',
    maxWidth: '90%',
    marginBottom: 10,
  },
  bubbleSystemInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(100,116,139,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  bubbleSystemText: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // ── AI-Dispatch bubble ───────────────────────────────────────────────────
  bubbleAIDispatch: {
    alignSelf: 'center',
    maxWidth: '88%',
    marginBottom: 10,
  },
  bubbleAIDispatchInner: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(8,18,36,0.78)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  dispatchLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bubbleDispatchText: {
    color: C.textBody,
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Status icons ─────────────────────────────────────────────────────────
  statusPending: {color: C.textMuted, fontSize: 14},
  statusSuccess: {color: C.success, fontSize: 12, fontWeight: '900'},
  statusError:   {color: C.error,   fontSize: 12, fontWeight: '900'},
});
