/**
 * ProcessFlowCard — 选矿工艺流程动画卡片
 * 参考图扑HT软件智慧矿山选矿demo的2D流程可视化风格
 * 动画展示：破碎→筛分→磨矿→分级→浮选→脱水→精矿七个环节的流动过程
 */
import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';
import {C, LAYOUT} from '../data/constants';

const STAGES = [
  {key: 'crush',   label: '破碎',    icon: '🔨', color: '#f59e0b'},
  {key: 'screen',  label: '筛分',    icon: '🔲', color: '#fb923c'},
  {key: 'grind',   label: '磨矿',    icon: '⚙️', color: '#a78bfa'},
  {key: 'class',   label: '分级',    icon: '📊', color: '#34d399'},
  {key: 'float',   label: '浮选',    icon: '🫧', color: '#60a5fa'},
  {key: 'dewater', label: '脱水',    icon: '💧', color: '#38bdf8'},
  {key: 'product', label: '精矿',    icon: '🪨', color: '#34d399'},
];

interface StageProps {
  stage: typeof STAGES[0];
  index: number;
  progress: Animated.Value;
  count: number;
}

function StageNode({stage, index, progress, count}: StageProps) {
  const opacity = progress.interpolate({
    inputRange: [(index - 0.5) / count, index / count, (index + 0.8) / count],
    outputRange: [0.35, 1, 0.5],
    extrapolate: 'clamp',
  });
  const scale = progress.interpolate({
    inputRange: [(index - 0.5) / count, index / count, (index + 0.8) / count],
    outputRange: [0.88, 1.06, 0.96],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[styles.stageWrap, {opacity, transform: [{scale}]}]}>
      <View style={[styles.stageIconBg, {backgroundColor: stage.color + '22', borderColor: stage.color + '60'}]}>
        <Text style={styles.stageIcon}>{stage.icon}</Text>
      </View>
      <Text style={[styles.stageLabel, {color: stage.color}]}>{stage.label}</Text>
    </Animated.View>
  );
}

interface FlowDotProps {
  progress: Animated.Value;
  fromIndex: number;
  toIndex: number;
  count: number;
}

function FlowDot({progress, fromIndex, toIndex, count}: FlowDotProps) {
  const opacity = progress.interpolate({
    inputRange: [
      (fromIndex + 0.1) / count,
      (fromIndex + 0.5) / count,
      (toIndex - 0.1) / count,
      toIndex / count,
    ],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[styles.flowDotWrap, {opacity}]}>
      <View style={styles.flowDot} />
    </Animated.View>
  );
}

export function ProcessFlowCard() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: STAGES.length,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [progress]);

  const count = STAGES.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🪨 生产工艺流程</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>实时</Text>
        </View>
      </View>

      <View style={styles.stagesRow}>
        {STAGES.map((stage, i) => (
          <React.Fragment key={stage.key}>
            <StageNode stage={stage} index={i} progress={progress} count={count} />
            {i < STAGES.length - 1 && (
              <FlowDot progress={progress} fromIndex={i} toIndex={i + 1} count={count} />
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.flowBar}>
        <Animated.View
          style={[
            styles.flowProgress,
            {
              width: progress.interpolate({
                inputRange: [0, count],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: LAYOUT.pageMargin,
    backgroundColor: C.bgCard,
    borderRadius: LAYOUT.cardRadius,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 16,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    color: C.textTitle,
    fontSize: 15,
    fontWeight: '800',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  liveText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  stagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 2,
  },
  stageWrap: {
    alignItems: 'center',
    flex: 1,
    minWidth: 36,
  },
  stageIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  stageIcon: {
    fontSize: 16,
  },
  stageLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  flowDotWrap: {
    width: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  flowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#34d399',
  },
  flowBar: {
    height: 3,
    backgroundColor: C.bgRoot,
    borderRadius: 2,
    overflow: 'hidden',
  },
  flowProgress: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 2,
  },
});
