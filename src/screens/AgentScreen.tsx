import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import type {Agent, AgentStatus} from '../types';

const STATUS_LABEL: Record<AgentStatus, string> = {
  online:  '在线',
  working: '执行中',
  idle:    '空闲',
  watching:'后台观察',
};
const STATUS_COLOR: Record<AgentStatus, string> = {
  online:  C.online,
  working: C.working,
  idle:    C.idle,
  watching:C.watching,
};

export function AgentScreen() {
  const {agents, refreshing} = useAppContext();
  const [selected, setSelected] = useState<Agent>(agents[0] ?? {
    id: 'placeholder',
    name: '助理',
    role: 'AI 总指挥',
    status: 'idle',
    focus: '等待状态同步',
    accent: C.primary,
    current: '待命',
  });

  useEffect(() => {
    if (!agents.length) return;
    const synced = agents.find(agent => agent.id === selected.id);
    setSelected(synced ?? agents[0]);
  }, [agents, selected.id]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>智能体</Text>
        <Text style={styles.sub}>{agents.length} 个 Agent · 实时状态</Text>
        <Text style={styles.syncText}>{refreshing ? '正在拉取智能体状态…' : '智能体状态实时同步 · 后台任务自动可见'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {/* Grid */}
        <View style={styles.agentGrid}>
          {agents.map(agent => {
            const sel = selected.id === agent.id;
            return (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.gridCard,
                  sel && styles.gridCardSel,
                  {borderTopColor: agent.accent},
                ]}
                onPress={() => setSelected(agent)}
                activeOpacity={0.8}
              >
                <View style={[styles.avatar, {backgroundColor: agent.accent}]}>
                  <Text style={styles.avatarText}>{agent.name.slice(0, 1)}</Text>
                </View>
                <Text style={styles.agentName}>{agent.name}</Text>
                <Text style={styles.agentRole}>{agent.role}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, {backgroundColor: STATUS_COLOR[agent.status]}]} />
                  <Text style={styles.statusText}>{STATUS_LABEL[agent.status]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Detail */}
        <View style={styles.detail}>
          <View style={[styles.detailTop, {borderBottomColor: selected.accent}]}>
            <View style={[styles.avatarLg, {backgroundColor: selected.accent}]}>
              <Text style={styles.avatarTextLg}>{selected.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailName}>{selected.name}</Text>
              <Text style={styles.detailRole}>{selected.role}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, {backgroundColor: STATUS_COLOR[selected.status]}]} />
                <Text style={styles.statusText}>{STATUS_LABEL[selected.status]}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.detailLabel}>专注领域</Text>
          <Text style={styles.detailValue}>{selected.focus}</Text>

          <Text style={styles.detailLabel}>当前任务</Text>
          <Text style={styles.detailValue}>📍 {selected.current}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BR = 24;
const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: C.bgRoot},
  header:       {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:        {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:          {color: C.textMuted, fontSize: 12, marginTop: 4},
  syncText:     {color: C.primary, fontSize: 11, marginTop: 8, fontWeight: '700'},
  grid:         {padding: 16, paddingBottom: 100},
  agentGrid:    {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  gridCard: {
    width: '47%',
    padding: 14,
    borderRadius: BR,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderTopWidth: 3,
    paddingBottom: 18,
  },
  gridCardSel: {
    backgroundColor: 'rgba(20,38,68,0.88)',
    borderColor: C.primary,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {color: '#020617', fontSize: 18, fontWeight: '900'},
  agentName:  {color: C.textTitle, fontSize: 18, fontWeight: '800'},
  agentRole:  {color: C.primary, fontSize: 11, marginTop: 4},
  statusRow:  {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  statusDot: {width: 7, height: 7, borderRadius: 4, marginRight: 6},
  statusText: {color: C.textBody, fontSize: 12, fontWeight: '700'},

  detail: {
    marginTop: 16, padding: 16, borderRadius: BR,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  detailTop: {
    flexDirection: 'row', gap: 16, paddingBottom: 14, marginBottom: 14,
    borderBottomWidth: 1,
  },
  avatarLg: {
    width: 56, height: 56, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTextLg: {color: '#020617', fontSize: 24, fontWeight: '900'},
  detailInfo:  {flex: 1, justifyContent: 'center'},
  detailName: {color: C.textTitle, fontSize: 20, fontWeight: '900'},
  detailRole: {color: C.primary, fontSize: 12, marginTop: 4},
  detailLabel: {color: C.textMuted, fontSize: 11, fontWeight: '700', marginTop: 14},
  detailValue: {color: C.textBody, fontSize: 14, lineHeight: 20, marginTop: 5},
});
