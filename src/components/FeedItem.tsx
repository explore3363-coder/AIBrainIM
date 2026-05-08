import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';
import type {AIFeedItem} from '../types';

interface Props {
  item: AIFeedItem;
}

const TYPE_ICONS: Record<string, string> = {
  output: '💬',
  dispatch: '🔄',
  confirmation: '⚠️',
  system: '⚙️',
  upload: '📤',
  knowledge: '📖',
  memory: '🧠',
};

export function FeedItem({item}: Props) {
  return (
    <View style={[styles.item, {borderLeftColor: item.agentAccent}]}>
      <View style={styles.header}>
        <Text style={[styles.agent, {color: item.agentAccent}]}>
          {TYPE_ICONS[item.type]} {item.agent}
        </Text>
        <Text style={styles.time}>{item.timestamp}</Text>
      </View>
      <Text style={styles.text}>{item.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    padding: 13,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agent: {fontSize: 12, fontWeight: '900'},
  time:  {color: C.textMuted, fontSize: 11},
  text:  {color: C.textBody, fontSize: 14, lineHeight: 20, marginTop: 4},
});
