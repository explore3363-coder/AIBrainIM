/**
 * SplashScreen — 品牌化启动画面
 *
 * iOS 13+ 使用 launchScreen.storyboard（在 ios/ 目录配置）。
 * 此组件用于 JS 层补充品牌渲染（在 launch image 之后、App 主体加载前短暂显示）。
 *
 * 品牌元素：
 * - AIBrainIM Logo 文字
 * - 霓虹绿主色调 + 光晕效果
 * - 标语：矿业大脑 · 移动主控
 */

import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';
import {C} from '../data/constants';

interface SplashScreenProps {
  /** 启动画面最小展示时长（ms），确保品牌曝光 */
  minDuration?: number;
  /** 渐隐动画时长（ms） */
  fadeOutDuration?: number;
  /** 加载完成回调 */
  onReady?: () => void;
}

export function SplashScreen({
  minDuration = 1200,
  fadeOutDuration = 400,
  onReady,
}: SplashScreenProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // 光晕脉动动画
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowAnim]);

  // 最小展示时长后触发渐隐
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: fadeOutDuration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => onReady?.());
    }, minDuration);

    return () => clearTimeout(timer);
  }, [opacity, minDuration, fadeOutDuration, onReady]);

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  return (
    <Animated.View style={[styles.container, {opacity}]}>
      {/* 背景氛围光 */}
      <View style={styles.bgGlow} />

      {/* 主内容 */}
      <View style={styles.content}>
        {/* Logo 区域 */}
        <Animated.View
          style={[
            styles.logoCircle,
            {
              transform: [{scale: glowScale}],
              opacity: glowOpacity,
            },
          ]}
        >
          <View style={styles.logoInner}>
            <Text style={styles.logoEmoji}>🧠</Text>
          </View>
        </Animated.View>

        {/* App 名称 */}
        <Text style={styles.appName}>AIBrainIM</Text>
        <Text style={styles.slogan}>矿业大脑 · 移动主控</Text>

        {/* 版本信息 */}
        <Text style={styles.version}>v2.0 Alpha</Text>

        {/* 加载指示器 */}
        <View style={styles.loadingRow}>
          <Animated.View
            style={[styles.dot, styles.dot1]}
          />
          <Animated.View
            style={[styles.dot, styles.dot2]}
          />
          <Animated.View
            style={[styles.dot, styles.dot3]}
          />
        </View>
      </View>

      {/* 底部版权 */}
      <Text style={styles.copyright}>
        © 2026 Tungsten Codex · Mining AI Platform
      </Text>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: C.bgRoot,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  bgGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: C.primary,
    opacity: 0.06,
    top: '50%',
    left: '50%',
    marginTop: -160,
    marginLeft: -160,
  },
  content: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(77,255,136,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(77,255,136,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(77,255,136,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 34,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: 1.5,
    marginBottom: 6,
    textShadowColor: 'rgba(77,255,136,0.4)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 16,
  },
  slogan: {
    fontSize: 14,
    color: C.textSecondary,
    letterSpacing: 2,
    marginBottom: 20,
  },
  version: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 32,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  dot1: {},
  dot2: {opacity: 0.65},
  dot3: {opacity: 0.35},
  copyright: {
    position: 'absolute',
    bottom: 40,
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 0.3,
  },
});
