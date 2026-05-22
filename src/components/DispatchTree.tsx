import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {C} from '../data/constants';
import type {CommandTrace} from '../types';

interface TreeNode {
  id: string;
  title: string;
  stage: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  timestamp?: number;
  children?: TreeNode[];
}

interface Props {
  root: TreeNode;
  initialExpanded?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

const STAGE_ICONS: Record<string, string> = {
  receive:   '📥',
  dispatch:  '⚙️',
  feedback:  '🔄',
  synthesis: '🧩',
  deliver:   '✅',
};

const STATUS_COLORS: Record<TreeNode['status'], string> = {
  pending: C.textMuted,
  active:  C.working,
  done:    C.success,
  failed:  C.error,
};

function NodeRow({node, depth, expanded, onToggle}: {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const statusColor = STATUS_COLORS[node.status];
  const icon = STAGE_ICONS[node.stage] ?? '📎';

  return (
    <View style={styles.nodeRow}>
      {depth > 0 && (
        <View style={styles.indentWrap}>
          {Array.from({length: depth}).map((_, i) => (
            <View key={i} style={[styles.indentLine, {top: 0, left: i * 20 + 9}]} />
          ))}
        </View>
      )}
      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={onToggle}
        disabled={!hasChildren}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
      >
        <Text style={styles.toggleIcon}>
          {hasChildren ? (expanded ? '▼' : '▶') : ' '}
        </Text>
      </TouchableOpacity>
      <Text style={styles.nodeIcon}>{icon}</Text>
      <View style={styles.nodeContent}>
        <Text style={[styles.nodeTitle, {color: statusColor}]} numberOfLines={1}>
          {node.title}
        </Text>
        {node.timestamp ? (
          <Text style={styles.nodeTime}>{formatTime(node.timestamp)}</Text>
        ) : null}
      </View>
      <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
    </View>
  );
}

function Tree({node, depth, expandedMap, onToggle}: {
  node: TreeNode;
  depth: number;
  expandedMap: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const expanded = expandedMap[node.id] ?? false;
  const children = node.children ?? [];

  return (
    <View style={styles.treeNode}>
      <NodeRow
        node={node}
        depth={depth}
        expanded={expanded}
        onToggle={() => onToggle(node.id)}
      />
      {expanded && children.length > 0 && (
        <View style={styles.childrenWrap}>
          {children.map(child => (
            <Tree
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedMap={expandedMap}
              onToggle={onToggle}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function DispatchTree({root, initialExpanded = true}: Props) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({
    [root.id]: initialExpanded,
  });

  const handleToggle = (id: string) => {
    setExpandedMap(prev => ({...prev, [id]: !prev[id]}));
  };

  return (
    <View style={styles.wrap}>
      <Tree node={root} depth={0} expandedMap={expandedMap} onToggle={handleToggle} />
    </View>
  );
}

export function buildTreeFromTraces(
  traces: CommandTrace[],
  statusMap?: Record<string, TreeNode['status']>,
): TreeNode {
  const children: TreeNode[] = traces.map((t, i) => {
    const stageStatus = statusMap?.[t.stage] ?? (i === traces.length - 1 ? 'done' : 'active');
    return {
      id: t.stage,
      title: t.title,
      stage: t.stage,
      status: stageStatus,
      timestamp: undefined,
      children: t.detail
        ? [{
            id: `${t.stage}-detail`,
            title: t.detail,
            stage: t.stage,
            status: stageStatus,
          }]
        : undefined,
    };
  });

  return {
    id: 'root',
    title: '调度链',
    stage: 'synthesis',
    status: 'active',
    children,
  };
}

const styles = StyleSheet.create({
  wrap: {paddingVertical: 4},
  treeNode: {},
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingRight: 8,
    gap: 6,
  },
  indentWrap: {
    position: 'relative',
    width: 0,
    height: '100%',
    alignSelf: 'stretch',
  },
  indentLine: {
    position: 'absolute',
    width: 1,
    bottom: -7,
    top: 0,
    backgroundColor: 'rgba(77,255,136,0.15)',
  },
  toggleBtn: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleIcon: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  nodeIcon: {fontSize: 13},
  nodeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nodeTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  nodeTime: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  childrenWrap: {
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(77,255,136,0.10)',
    marginLeft: 8,
  },
});
