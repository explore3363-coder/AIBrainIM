import React, {useMemo} from 'react';
import {Text, View, StyleSheet, ScrollView, TouchableOpacity, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';

const URGENCY_COLOR: Record<string, string> = {
  high:   C.highUrgency,
  normal: C.normalUrgency,
  low:    C.lowUrgency,
};
const URGENCY_LABEL: Record<string, string> = {
  high: '紧急', normal: '一般', low: '低',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  deferred: '已延后',
};
const STATUS_COLOR: Record<string, string> = {
  pending: C.normalUrgency,
  confirmed: '#34d399',
  deferred: C.textMuted,
};

export function ConfirmationsScreen() {
  const navigation = useNavigation();
  const {confirmations, pendingConfirmations, confirmItem, deferItem} = useAppContext();

  const sortedItems = useMemo(() => {
    const order = {pending: 0, deferred: 1, confirmed: 2} as const;
    return [...confirmations].sort((a, b) => {
      const aStatus = a.status ?? 'pending';
      const bStatus = b.status ?? 'pending';
      return order[aStatus] - order[bStatus];
    });
  }, [confirmations]);

  const handleConfirm = (id: string, title: string) => {
    Alert.alert('确认操作', `确定「${title}」？`, [
      {text: '取消', style: 'cancel'},
      {text: '确认', onPress: () => {
        confirmItem(id);
        navigation.goBack();
      }},
    ]);
  };

  const handleDefer = (id: string, title: string) => {
    Alert.alert('延后处理', `将「${title}」标记为稍后处理？`, [
      {text: '取消', style: 'cancel'},
      {text: '稍后', onPress: () => {
        deferItem(id);
        navigation.goBack();
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>⚠️ 需确认项</Text>
        <Text style={styles.sub}>{pendingConfirmations} 项待你决策 · 已支持状态流转</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {sortedItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>暂无待确认项</Text>
            <Text style={styles.emptyDesc}>
              所有确认项都已处理完毕。当前闭环中没有需要人工拍板的节点。
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                activeOpacity={0.8}
                onPress={() => (navigation as any).navigate('Tabs', {screen: 'Chat'})}
              >
                <Text style={styles.emptyPrimaryBtnText}>去对话</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptySecondaryBtn}
                activeOpacity={0.8}
                onPress={() => (navigation as any).navigate('DispatchChain')}
              >
                <Text style={styles.emptySecondaryBtnText}>看调度链</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.emptyNote}>
              有新的需要决策事项时，会自动出现在这里。
            </Text>
          </View>
        )}
        {sortedItems.map(item => {
          const currentStatus = item.status ?? 'pending';
          const isResolved = currentStatus !== 'pending';
          return (
            <View key={item.id} style={[styles.card, isResolved && styles.cardResolved]}>
              <View style={styles.cardTop}>
                <View style={[styles.urgencyDot, {backgroundColor: URGENCY_COLOR[item.urgency]}]} />
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.urgencyBadge, {borderColor: URGENCY_COLOR[item.urgency]}]}>
                  <Text style={[styles.urgencyText, {color: URGENCY_COLOR[item.urgency]}]}>
                    {URGENCY_LABEL[item.urgency]}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{item.description}</Text>
              <Text style={styles.cardMeta}>{item.agent} · {item.timestamp}</Text>

              <View style={[styles.statusBadge, {borderColor: STATUS_COLOR[currentStatus] + '44'}]}>
                <Text style={[styles.statusText, {color: STATUS_COLOR[currentStatus]}]}>
                  {STATUS_LABEL[currentStatus]}
                </Text>
              </View>

              {item.resolutionNote ? (
                <Text style={styles.resolutionNote}>{item.resolutionNote}</Text>
              ) : null}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.confirmBtn, isResolved && styles.actionBtnDisabled]}
                  activeOpacity={0.8}
                  onPress={() => handleConfirm(item.id, item.title)}
                  disabled={isResolved}
                >
                  <Text style={styles.confirmBtnText}>确认</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deferBtn, isResolved && styles.actionBtnDisabled]}
                  activeOpacity={0.8}
                  onPress={() => handleDefer(item.id, item.title)}
                  disabled={isResolved}
                >
                  <Text style={styles.deferBtnText}>稍后</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       {flex: 1, backgroundColor: C.bgRoot},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  content:    {padding: 16, paddingBottom: 100, gap: 12},
  card: {
    padding: 16, borderRadius: 20,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  cardResolved: {
    opacity: 0.82,
  },
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: 8},
  urgencyDot: {width: 8, height: 8, borderRadius: 4},
  cardTitle: {flex: 1, color: C.textTitle, fontSize: 15, fontWeight: '800'},
  urgencyBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
  },
  urgencyText: {fontSize: 10, fontWeight: '800'},
  cardDesc:  {color: C.textBody, fontSize: 13, lineHeight: 19, marginTop: 8},
  cardMeta:  {color: C.textMuted, fontSize: 11, marginTop: 6},
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statusText: {fontSize: 10, fontWeight: '800'},
  resolutionNote: {color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8},
  cardActions: {flexDirection: 'row', gap: 10, marginTop: 12},
  confirmBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.primary, alignItems: 'center',
  },
  confirmBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
  deferBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1, borderColor: C.borderActive, alignItems: 'center',
  },
  deferBtnText: {color: C.primary, fontWeight: '700', fontSize: 14},
  actionBtnDisabled: {opacity: 0.45},

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 14,
  },
  emptyEmoji: {fontSize: 52},
  emptyTitle: {color: C.textTitle, fontSize: 20, fontWeight: '900', textAlign: 'center'},
  emptyDesc: {color: C.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center'},
  emptyActions: {flexDirection: 'row', gap: 10, marginTop: 4},
  emptyPrimaryBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    backgroundColor: C.primary,
  },
  emptyPrimaryBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 13},
  emptySecondaryBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  emptySecondaryBtnText: {color: C.primary, fontWeight: '800', fontSize: 13},
  emptyNote: {
    color: C.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center',
    marginTop: 6, fontStyle: 'italic',
  },
});
