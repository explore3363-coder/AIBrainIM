import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {C} from '../data/constants';

interface Props {
  label: string;
  emoji: string;
  focused: boolean;
  badge?: number;
  isCenterFAB?: boolean;
  onPress?: () => void;
}

export function TabBarIcon({label, emoji, focused, badge, isCenterFAB, onPress}: Props) {
  if (isCenterFAB) {
    return (
      <TouchableOpacity style={styles.fabContainer} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.fab}>
          <Text style={styles.fabIcon}>+</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        {focused && <View style={styles.glow} />}
        <Text style={[styles.emoji, focused && styles.emojiActive]}>{emoji}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        {alignItems: 'center', justifyContent: 'center', marginBottom: 4},
  iconWrap:    {position: 'relative', padding: 4},
  iconWrapActive: {},
  glow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 16,
    backgroundColor: C.primaryGlow,
  },
  emoji:       {fontSize: 20},
  emojiActive: {},
  label:       {color: C.tabInactive, fontSize: 10, fontWeight: '700', marginTop: 2},
  labelActive: {color: C.tabActive},
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {color: '#fff', fontSize: 10, fontWeight: '900'},
  fabContainer: {alignItems: 'center', justifyContent: 'center', marginBottom: 20},
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: C.bgRoot,
    fontWeight: '700',
    marginTop: -2,
  },
});
