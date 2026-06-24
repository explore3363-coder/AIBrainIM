/**
 * TabBarIcon — 精修版 v4
 * 针对 iPhone 17 Pro Max 优化：更大触控目标、更精致图标设计
 */
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
      <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
        {focused && <View style={styles.focusRing} />}
        <Text style={[styles.emoji, focused && styles.emojiFocused]}>{emoji}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  iconWrap: {
    position: 'relative',
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapFocused: {},
  focusRing: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  emoji: {
    fontSize: 22,
    opacity: 0.7,
  },
  emojiFocused: {
    opacity: 1,
  },
  label: {
    color: C.tabInactive,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  labelFocused: {
    color: C.tabActive,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: '#FF4D6A',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#07090E',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  fabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: -10,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: {
    fontSize: 28,
    color: C.bgRoot,
    fontWeight: '700',
    marginTop: -2,
  },
});
