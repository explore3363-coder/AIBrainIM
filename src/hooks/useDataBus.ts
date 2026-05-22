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
  /** 重连延迟（ms） */
  reconnectDelay?: number;
  /** 最大重连次数，0=无限 */
  maxRetries?: number;
}

/** 从 gatewayUrl 提取 host:port 部分（去掉 http:// 或 https://） */
function extractHost(config: GatewayConfig): string {
  return config.gatewayUrl.replace(/^https?:\/\//, '');
}

export function useDataBus(options: UseDataBusOptions = {}) {
  const {
    topics = [],
    enableWildcard = true,
    reconnectDelay = 3000,
    maxRetries = 10,
  } = options;

  const [messages, setMessages] = useState<DataBusMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

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

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // getGatewayConfig is async but we need to resolve it before using
    getGatewayConfig().then(config => {
      if (!mountedRef.current) return;

      const host = extractHost(config);
      const wsUrl = `${config.wsProtocol}://${host}/api/databus/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
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
        };

        ws.onmessage = event => {
          if (!mountedRef.current) return;
          try {
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
          if (!mountedRef.current) return;
          setError('WebSocket connection error');
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          setConnected(false);
          if (retriesRef.current < maxRetries) {
            retriesRef.current++;
            const delay = reconnectDelay * Math.min(retriesRef.current, 5);
            setTimeout(connect, delay);
          } else {
            setError('Max reconnection attempts reached');
          }
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    });
  }, [topics, enableWildcard, reconnectDelay, maxRetries]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);

  // 订阅新主题（运行时动态添加）
  const subscribe = useCallback(
    (newTopics: string[]) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'subscribe',
            topics: newTopics.map(t => ({pattern: t, wildcard: enableWildcard})),
          }),
        );
      }
    },
    [enableWildcard],
  );

  // 取消订阅
  const unsubscribe = useCallback((topicsToRemove: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'unsubscribe',
          topics: topicsToRemove,
        }),
      );
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
