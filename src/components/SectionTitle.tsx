import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';

interface Props {
  title: string;
  hint?: string;
  action?: {label: string; onPress: () => void};
}

export function SectionTitle({title, hint, action}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {action ? (
        <Text style={styles.action} onPress={action.onPress}>
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  texts: {},
  title: {color: C.textTitle, fontSize: 18, fontWeight: '900'},
  hint:  {color: C.textMuted, fontSize: 11, marginTop: 4},
  action: {color: C.primary, fontSize: 12, fontWeight: '700'},
});
