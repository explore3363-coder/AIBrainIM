import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';

interface Props {
  label: string;
  emoji: string;
  focused: boolean;
  /** Red badge count shown top-right. Hidden when 0 or falsy. */
  badge?: number;
}

export function TabBarIcon({label, emoji, focused, badge}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Text style={styles.emoji}>{emoji}</Text>
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
  iconWrap:    {position: 'relative'},
  emoji:       {fontSize: 20},
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
});
