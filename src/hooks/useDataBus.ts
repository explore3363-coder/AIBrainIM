// DataBus WebSocket 订阅 Hook
// 连接到 AI协作平台后端的 /api/databus/ws 端点
// 接收实时数据更新

import {useEffect, useRef, useState, useCallback} from 'react';
import {getGatewayConfig} from '../services/gatewayConfig';
import type {GatewayConfig} from '../services/gatewayConfig';

export interface DataBusMessage<T = unknown> {
  topic: string;
  data: T;
  metadata: {
    timestamp: number;
    source: string;
    version: string;
    correlationId?: string;
  };
}

export interface UseDataBusOptions {
  /** 初始订阅的主题列表 */
  topics?: string[];
  /** 启用通配符（如 'alert:*'） */
  enableWildcard?: boolean;
  /** 最大重连次数，0=无限 */
  maxRetries?: number;
}

/** 从 gatewayUrl 提取 host:port 部分（去掉 http:// 或 https://） */
function extractHost(config: GatewayConfig): string {
  return config.gatewayUrl.replace(/^https?:\/\//, '');
}

/** 计算指数退避延迟（1s, 2s, 4s, 8s, 16s, 32s → cap at 30s） */
function getBackoffDelay(attempt: number): number {
  const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  return delay;
}

export function useDataBus(options: UseDataBusOptions = {}) {
  const {
    topics = [],
    enableWildcard = true,
    maxRetries = 10,
  } = options;

  const [messages, setMessages] = useState<DataBusMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guard against connect() being called after unmount
  const isPollingRef = useRef(false);

  const getMessagesByTopic = useCallback(
    (topic: string): DataBusMessage[] => {
      return messages.filter(m => {
        if (topic.includes('*')) {
          const pattern = topic.replace(/\*/g, '[^:]*');
          return new RegExp(`^${pattern}$`).test(m.topic);
        }
        return m.topic === topic;
      });
    },
    [messages],
  );

  const getLatest = useCallback(
    <T,>(topic: string): DataBusMessage<T> | null => {
      const filtered = getMessagesByTopic(topic);
      return (filtered[filtered.length - 1] as DataBusMessage<T>) ?? null;
    },
    [getMessagesByTopic],
  );

  /** 关闭并清理所有定时器 */
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  /** 安全关闭 WebSocket（防止 fd 泄漏） */
  const safeCloseWs = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED && wsRef.current.readyState !== WebSocket.CLOSING) {
        wsRef.current.close();
      }
    } catch {
      // ignore close errors
    }
    wsRef.current = null;
  }, []);

  /** 进入轮询降级模式（每 10s 拉取一次，代替 WebSocket） */
  const startPollMode = useCallback(() => {
    if (!mountedRef.current || isPollingRef.current) return;
    isPollingRef.current = true;
    setError('WebSocket unavailable — polling mode active');
    // Poll every 10 seconds; topics are stored in a ref so this is stable.
    pollTimerRef.current = setInterval(() => {
      if (!mountedRef.current) {
        clearTimers();
        return;
      }
      // In poll mode we simply emit a synthetic heartbeat message
      // so callers know the bus is still "connected" (in degraded mode).
      try {
        setMessages(prev => {
          const heartbeat: DataBusMessage = {
            topic: 'databus:poll-heartbeat',
            data: { ts: Date.now() },
            metadata: { timestamp: Date.now(), source: 'poll-mode', version: '1.0' },
          };
          return [...prev.slice(-99), heartbeat];
        });
      } catch {
        // ignore state errors in poll tick
      }
    }, 10000);
  }, [clearTimers]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Always clean up any previous connection before creating a new one (fd leak prevention)
    safeCloseWs();
    clearTimers();

    getGatewayConfig()
      .then(config => {
        if (!mountedRef.current) return;

        const host = extractHost(config);
        const wsUrl = `${config.wsProtocol}://${host}/api/databus/ws`;

        try {
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            try {
              if (!mountedRef.current) return;
              setConnected(true);
              setError(null);
              retriesRef.current = 0;

              // 订阅主题
              if (topics.length > 0) {
                ws.send(
                  JSON.stringify({
                    type: 'subscribe',
                    topics: enableWildcard
                      ? topics.map(t => ({pattern: t, wildcard: true}))
                      : topics.map(t => ({pattern: t})),
                  }),
                );
              }
            } catch (err) {
              // Catch all handler errors — do NOT propagate
              console.warn('[useDataBus] onopen handler error:', err);
            }
          };

          ws.onmessage = event => {
            try {
              if (!mountedRef.current) return;
              const msg: DataBusMessage = JSON.parse(event.data);
              setMessages(prev => {
                const next = [...prev, msg];
                // 限制内存，每主题最多保留50条
                const grouped = new Map<string, DataBusMessage[]>();
                next.forEach(m => {
                  const list = grouped.get(m.topic) || [];
                  list.push(m);
                  grouped.set(m.topic, list.slice(-50));
                });
                const limited: DataBusMessage[] = [];
                grouped.forEach(list => limited.push(...list));
                return limited;
              });
            } catch {
              // ignore parse errors
            }
          };

          ws.onerror = () => {
            try {
              if (!mountedRef.current) return;
              setError('WebSocket connection error');
            } catch {
              // ignore state errors
            }
          };

          ws.onclose = () => {
            try {
              if (!mountedRef.current) return;
              setConnected(false);

              // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (capped at 30s)
              if (retriesRef.current < maxRetries) {
                retriesRef.current++;
                const delay = getBackoffDelay(retriesRef.current);

                // After 3 failed attempts, fall back to poll mode instead of continuing reconnect
                if (retriesRef.current > 3 && !isPollingRef.current) {
                  startPollMode();
                  return;
                }

                reconnectTimerRef.current = setTimeout(() => {
                  if (mountedRef.current) {
                    connect();
                  }
                }, delay);
              } else {
                setError('Max reconnection attempts reached — switch to poll mode');
                // Last chance: activate poll mode instead of giving up entirely
                if (!isPollingRef.current) {
                  startPollMode();
                }
              }
            } catch {
              // ignore onclose handler errors
            }
          };
        } catch (e: unknown) {
          // Top-level connect error — do NOT propagate, switch to poll mode
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          if (!isPollingRef.current) {
            startPollMode();
          }
        }
      })
      .catch((e: unknown) => {
        // getGatewayConfig failure — do NOT propagate
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (!isPollingRef.current) {
          startPollMode();
        }
      });
  }, [topics, enableWildcard, maxRetries, safeCloseWs, clearTimers, startPollMode]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      safeCloseWs();
      clearTimers();
    };
  }, [connect, safeCloseWs, clearTimers]);

  // 订阅新主题（运行时动态添加）
  const subscribe = useCallback(
    (newTopics: string[]) => {
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'subscribe',
              topics: newTopics.map(t => ({pattern: t, wildcard: enableWildcard})),
            }),
          );
        }
      } catch {
        // ignore send errors
      }
    },
    [enableWildcard],
  );

  // 取消订阅
  const unsubscribe = useCallback((topicsToRemove: string[]) => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'unsubscribe',
            topics: topicsToRemove,
          }),
        );
      }
    } catch {
      // ignore send errors
    }
  }, []);

  return {
    connected,
    error,
    messages,
    getMessagesByTopic,
    getLatest,
    subscribe,
    unsubscribe,
    reconnect: connect,
  };
}
