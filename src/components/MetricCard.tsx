import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';

interface Props {
  label: string;
  value: string;
  accent?: string;
}

export function MetricCard({label, value, accent = C.primary}: Props) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, {color: accent}]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
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
  },
  value: {fontSize: 26, fontWeight: '900'},
  label: {color: C.textMuted, fontSize: 12, marginTop: 4},
});
