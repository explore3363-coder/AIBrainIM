import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';

interface Props {
  label: string;
  emoji: string;
  focused: boolean;
}

export function TabBarIcon({label, emoji, focused}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        {alignItems: 'center', justifyContent: 'center', marginBottom: 4},
  emoji:       {fontSize: 20},
  label:       {color: C.tabInactive, fontSize: 10, fontWeight: '700', marginTop: 2},
  labelActive: {color: C.tabActive},
});
