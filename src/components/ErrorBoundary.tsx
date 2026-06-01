import React, {Component, type ReactNode} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
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
    console.warn('[ErrorBoundary] Caught error:', error.message, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>渲染出错</Text>
            <Text style={styles.message}>
              {this.state.error?.message ?? '页面渲染遇到问题，请尝试重启应用。'}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => this.setState({hasError: false, error: undefined})}
            >
              <Text style={styles.buttonText}>重新加载</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#171C26',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  icon: {
    fontSize: 40,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#4DFF88',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 16,
  },
  buttonText: {
    color: '#080A0F',
    fontWeight: '700',
    fontSize: 15,
  },
});
