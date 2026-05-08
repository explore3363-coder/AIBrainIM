import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {C} from '../data/constants';
import type {BrainStore} from '../types';

interface Props {
  store: BrainStore;
  onPress?: (store: BrainStore) => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  pending: '待接入',
  standby: '待机',
};

export function StoreCard({store, onPress}: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => onPress?.(store)}
    >
      <View style={[styles.topBar, {backgroundColor: store.accent}]} />
      <Text style={styles.title}>{store.title}</Text>
      <Text style={[styles.value, {color: store.accent}]}>{store.value}</Text>
      <View style={[styles.badge, {borderColor: store.accent}]}>
        <Text style={[styles.badgeText, {color: store.accent}]}>
          {STATUS_LABEL[store.status]}
        </Text>
      </View>
      <Text style={styles.detail}>{store.detail}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    overflow: 'hidden',
  },
  topBar: {height: 3, borderRadius: 2, marginBottom: 10, opacity: 0.8},
  title:  {color: C.textTitle, fontSize: 15, fontWeight: '900'},
  value:  {fontSize: 13, fontWeight: '700', marginTop: 6},
  badge: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {fontSize: 10, fontWeight: '800'},
  detail: {color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7},
});
