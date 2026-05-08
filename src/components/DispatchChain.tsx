import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {C} from '../data/mockData';
import type {CommandTrace} from '../types';

interface Props {
  traces: CommandTrace[];
  activeStage?: string;
}

export function DispatchChain({traces, activeStage}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {traces.map((item, i) => {
        const isLast = i === traces.length - 1;
        const isActive = item.stage === activeStage;
        return (
          <View key={item.stage} style={styles.step}>
            {!isLast && <View style={styles.connector} />}
            <View style={[styles.dot, isActive && styles.dotActive]} />
            <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
              {item.title}
            </Text>
            <Text style={styles.stepActor}>{item.actor}</Text>
            {item.detail ? (
              <Text style={styles.stepDetail} numberOfLines={3}>{item.detail}</Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const STEP_W = 160;
const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 0,
  },
  step: {
    width: STEP_W,
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  connector: {
    position: 'absolute',
    top: 16,
    left: '50%',
    width: STEP_W - 40,
    height: 2,
    backgroundColor: C.borderSubtle,
    zIndex: 0,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.borderSubtle,
    borderWidth: 2,
    borderColor: C.primary,
    zIndex: 1,
    marginTop: 10,
  },
  dotActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  stepTitle:  {color: C.textMuted, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center'},
  stepTitleActive: {color: C.accent},
  stepActor:  {color: C.textMuted, fontSize: 10, marginTop: 4, textAlign: 'center'},
  stepDetail: {color: C.textMuted, fontSize: 9, marginTop: 4, textAlign: 'center', lineHeight: 12},
});
