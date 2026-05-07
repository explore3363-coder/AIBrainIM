import React from 'react';
import {Text, type TextStyle} from 'react-native';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

const MAP: Record<string, string> = {
  message:   '◉',
  memory:    '◈',
  knowledge: '◪',
  file:      '▣',
  chain:     '⬡',
  settings:  '⚙',
  send:      '↑',
  attach:    '＋',
  close:     '✕',
  check:     '✓',
  warning:   '⚠',
  loading:   '◌',
  agent:     '◉',
  task:      '◎',
  dispatch:  '⬡',
  chevron:   '›',
  archive:   '▣',
  upload:    '↑',
  camera:    '◯',
  doc:       '▤',
};

export function Icon({name, size = 16, color = '#94a3b8'}: IconProps): React.JSX.Element {
  return (
    <Text style={{fontSize: size, color, fontWeight: '700' as TextStyle['fontWeight']}}>
      {MAP[name] ?? '•'}
    </Text>
  );
}
