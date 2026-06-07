/**
 * ErrorBoundary — 全局错误降级 UI（霓虹绿主题美化版）
 *
 * 捕获 React 渲染错误，显示品牌化降级界面。
 * 支持"重新加载"按钮恢复。
 */

import React, {Component, type ReactNode} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import {C} from '../data/constants';

interface Props {
  children: ReactNode;
  /** 可选：外部传入的降级 UI，优先级高于默认 */
  fallback?: ReactNode;
  /** 可选：出错后是否显示重试按钮，默认 true */
  showRetry?: boolean;
  /** 可选：自定义标题 */
  title?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const info = errorInfo.componentStack ?? '';
    // 取最后 5 行栈追踪，避免占用过多屏幕空间
    const shortStack = info
      .split('\n')
      .slice(0, 6)
      .join('\n')
      .replace(/\s*at\s+/g, ' @ ');
    this.setState({errorInfo: shortStack});
    console.warn('[ErrorBoundary] Caught:', error.message, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({hasError: false, error: undefined, errorInfo: undefined});
  };

  handleReport = () => {
    const {error} = this.state;
    const body = error
      ? `【Error Report】\n\nError: ${error.message}\nStack: ${error.stack}`
      : '【Error Report】\n\nNo error details available.';
    Linking.openURL(`mailto:support@example.com?subject=AIBrainIM Error Report&body=${encodeURIComponent(body)}`).catch(() => {
      // ignore
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const {showRetry = true, title} = this.props;
      const errorMsg = this.state.error?.message ?? '页面渲染遇到问题';

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            {/* 顶部品牌标识 */}
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Text style={styles.brandEmoji}>⚠️</Text>
              </View>
              <View style={styles.brandText}>
                <Text style={styles.brandTitle}>AIBrainIM</Text>
                <Text style={styles.brandSubtitle}>运行态异常</Text>
              </View>
            </View>

            {/* 分隔线 */}
            <View style={styles.divider} />

            {/* 错误标题 */}
            <Text style={styles.errorTitle}>{title ?? '渲染出错'}</Text>
            <Text style={styles.errorMessage} numberOfLines={3}>
              {errorMsg}
            </Text>

            {/* 栈追踪（可选折叠） */}
            {this.state.errorInfo && (
              <View style={styles.stackContainer}>
                <Text style={styles.stackLabel}>堆栈追踪</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  style={styles.stackScroll}
                >
                  <Text style={styles.stackText}>{this.state.errorInfo}</Text>
                </ScrollView>
              </View>
            )}

            {/* 操作按钮 */}
            <View style={styles.actions}>
              {showRetry && (
                <TouchableOpacity
                  style={styles.btnPrimary}
                  activeOpacity={0.8}
                  onPress={this.handleRetry}
                >
                  <Text style={styles.btnPrimaryText}>重新加载</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.btnSecondary}
                activeOpacity={0.8}
                onPress={this.handleReport}
              >
                <Text style={styles.btnSecondaryText}>报告问题</Text>
              </TouchableOpacity>
            </View>

            {/* 底部提示 */}
            <Text style={styles.footer}>
              如问题持续，请尝试重启应用或更新至最新版本
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgRoot,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(77,255,136,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(77,255,136,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandEmoji: {fontSize: 24},
  brandText: {flex: 1},
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.primary,
  },
  brandSubtitle: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: C.borderSubtle,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textPrimary,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  stackContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    marginBottom: 20,
  },
  stackLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  stackScroll: {maxHeight: 80},
  stackText: {
    fontSize: 10,
    color: '#FF7185',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 15,
  } as any,
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPrimaryText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.borderDefault,
  },
  btnSecondaryText: {
    color: C.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    fontSize: 11,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
