import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/mockData';

interface Props {
  title: string;
  value: string;
  detail: string;
  accent: string;
  onPress?: () => void;
}

export function OverviewCard({title, value, detail, accent}: Props) {
  return (
    <View style={[styles.card, {borderLeftColor: accent}]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, {color: accent}]}>{value}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderLeftWidth: 4,
  },
  title:  {color: C.textMuted, fontSize: 11, fontWeight: '700'},
  value:  {fontSize: 16, fontWeight: '900', marginTop: 5},
  detail: {color: C.textBody, fontSize: 13, lineHeight: 19, marginTop: 5},
});
