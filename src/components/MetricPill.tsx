/**
 * MetricPill — Horizontal scrolling pill for Dashboard stats
 * Inspired by: Industrial OS dark theme with neon green accents
 */
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';

interface Props {
  label: string;
  value: string;
  accent?: string;
  subLabel?: string;
}

export function MetricPill({label, value, accent = C.primary, subLabel}: Props) {
  return (
    <View style={styles.pill}>
      <View style={[styles.accentBar, {backgroundColor: accent}]} />
      <View style={styles.content}>
        <Text style={[styles.value, {color: accent}]} numberOfLines={1}>{value}</Text>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 16,
    minWidth: 88,
    height: 72,
    marginRight: 10,
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    height: '100%',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  label: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  subLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 13,
    marginTop: 1,
  },
});
