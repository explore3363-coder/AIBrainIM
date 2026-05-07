import React from 'react';
import {View, type ViewStyle} from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padding?: number;
  borderRadius?: number;
}

export function GlassCard({
  children,
  style,
  elevated = false,
  padding = 14,
  borderRadius = 18,
}: GlassCardProps): React.JSX.Element {
  return (
    <View
      style={[
        {
          padding,
          borderRadius,
          backgroundColor: elevated ? '#0d1830' : 'rgba(14,24,42,0.7)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
