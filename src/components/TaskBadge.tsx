import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {C} from '../data/constants';
import type {TaskState} from '../types';

interface Props {
  state: TaskState;
}

const STATE_LABEL: Record<TaskState, string> = {
  running: '进行中',
  todo:    '待处理',
  done:    '已完成',
  blocked: '需确认',
};

export function TaskBadge({state}: Props) {
  return (
    <View style={[styles.badge, styles[`badge_${state}`]]}>
      <Text style={styles.text}>{STATE_LABEL[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999},
  text:  {color: C.textBody, fontSize: 11, fontWeight: '800'},
  badge_running: {backgroundColor: C.stateRunning},
  badge_todo:    {backgroundColor: C.stateTodo},
  badge_done:    {backgroundColor: C.stateDone},
  badge_blocked: {backgroundColor: C.stateBlocked},
});
