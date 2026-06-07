/**
 * NetworkStatusBar — 网络状态检测组件
 *
 * 检测网络可用性，无网络时显示友好提示条。
 * 使用 @react-native-community/netinfo 或原生 Connectivity API。
 *
 * TODO: replace with real network detection
 * 当前使用模拟状态（isConnected=true），接入手淘/原生网络 API 后替换
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, Animated, LayoutAnimation, Platform, UIManager} from 'react-native';
import {C} from '../data/constants';

// ─── TODO: 替换为真实网络检测 ────────────────────────────────────────────────

function checkNetworkStatus(): Promise<boolean> {
  // TODO: replace with @react-native-community/netinfo
  // import NetInfo from '@react-native-community/netinfo';
  // return NetInfo.fetch().then(state => state.isConnected ?? false);
  return Promise.resolve(true);
}

// ─── NetworkStatusBar ────────────────────────────────────────────────────────

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function NetworkStatusBar() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  // isConnected = null 表示尚未检测（启动时）

  useEffect(() => {
    let mounted = true;

    async function detect() {
      const connected = await checkNetworkStatus();
      if (mounted) setIsConnected(connected);
    }

    detect();

    // 定期重新检测（每 30s）
    const interval = setInterval(detect, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 尚未完成检测，不渲染任何内容
  if (isConnected === null) return null;

  // 网络正常，不渲染提示条
  if (isConnected === true) return null;

  // 网络断开，显示警告条
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.text}>无网络连接，部分功能可能无法使用</Text>
    </View>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNetworkStatus(): boolean {
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    checkNetworkStatus().then(setConnected);
    const interval = setInterval(() => checkNetworkStatus().then(setConnected), 30000);
    return () => clearInterval(interval);
  }, []);
  return connected;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 187, 0, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 187, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  icon: {fontSize: 14},
  text: {
    fontSize: 12,
    color: '#FFBB00',
    fontWeight: '600',
  },
});
