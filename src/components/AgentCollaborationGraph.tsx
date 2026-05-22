import React, {memo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';

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

export interface AgentNode {
  agentId: string;
  agentName: string;
  action?: string;
}

export interface CollaborationLink {
  from: string; // agentId
  to: string;   // agentId
  label?: string;
}

export interface AgentCollaborationGraphProps {
  nodes: AgentNode[];
  links: CollaborationLink[];
  timestamp: number;
}

export const AgentCollaborationGraph = memo(function AgentCollaborationGraph({
  nodes,
  links,
  timestamp,
}: AgentCollaborationGraphProps) {
  const timeStr = (() => {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  })();

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.headerIcon}>🔗</Text>
          <Text style={styles.headerTitle}>Agent 协作链路</Text>
          <Text style={styles.headerTime}>{timeStr}</Text>
        </View>

        {/* Nodes row */}
        <View style={styles.nodesRow}>
          {nodes.map((node, i) => {
            const accent = getAccent(node.agentId);
            return (
              <React.Fragment key={node.agentId}>
                <View style={styles.nodeWrap}>
                  <View style={[styles.nodeAvatar, {backgroundColor: accent + '25', borderColor: accent}]}>
                    <Text style={[styles.nodeAvatarText, {color: accent}]}>
                      {node.agentName.slice(0, 1)}
                    </Text>
                  </View>
                  <Text style={[styles.nodeName, {color: accent}]} numberOfLines={1}>
                    {node.agentName}
                  </Text>
                  {node.action && (
                    <Text style={styles.nodeAction} numberOfLines={1}>{node.action}</Text>
                  )}
                </View>
                {i < nodes.length - 1 && (
                  <View style={styles.arrowWrap}>
                    <Text style={styles.arrow}>→</Text>
                    {links[i]?.label ? (
                      <Text style={styles.linkLabel}>{links[i].label}</Text>
                    ) : null}
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    borderRadius: 14,
    backgroundColor: 'rgba(14,24,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(179,102,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  headerIcon: {fontSize: 14},
  headerTitle: {
    color: C.textTitle,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  headerTime: {
    color: C.textMuted,
    fontSize: 10,
  },

  nodesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 0,
  },
  nodeWrap: {
    alignItems: 'center',
    minWidth: 56,
    maxWidth: 80,
  },
  nodeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  nodeAvatarText: {
    fontSize: 14,
    fontWeight: '900',
  },
  nodeName: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  nodeAction: {
    color: C.textMuted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },

  arrowWrap: {
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  arrow: {
    color: C.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  linkLabel: {
    color: C.textMuted,
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
});
