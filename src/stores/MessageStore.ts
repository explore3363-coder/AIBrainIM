/**
 * MessageStore — 实时消息存储
 *
 * 为 AIBrainIM 提供内存消息缓存，支持：
 * - 按 sessionKey 存储/读取消息
 * - 实时消息追加
 * - 监听器模式（变化时通知 UI）
 */

export interface ChatMessage {
  id: string;
  sessionKey: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agentName?: string;
}

type Listener = (messages: ChatMessage[]) => void;

const messages: Record<string, ChatMessage[]> = {};
const listeners: Record<string, Listener[]> = {};

export const MessageStore = {
  addMessage(sessionKey: string, msg: ChatMessage) {
    if (!messages[sessionKey]) messages[sessionKey] = [];
    messages[sessionKey].push(msg);
    (listeners[sessionKey] ?? []).forEach(fn => {
      try { fn(messages[sessionKey]); } catch {}
    });
  },

  getMessages(sessionKey: string): ChatMessage[] {
    return messages[sessionKey] ?? [];
  },

  clearSession(sessionKey: string) {
    messages[sessionKey] = [];
    (listeners[sessionKey] ?? []).forEach(fn => {
      try { fn([]); } catch {}
    });
  },

  subscribe(sessionKey: string, fn: Listener): () => void {
    if (!listeners[sessionKey]) listeners[sessionKey] = [];
    listeners[sessionKey].push(fn);
    try { fn(messages[sessionKey] ?? []); } catch {}
    return () => {
      listeners[sessionKey] = (listeners[sessionKey] ?? []).filter(l => l !== fn);
    };
  },

  initSession(sessionKey: string) {
    if (!messages[sessionKey] || messages[sessionKey].length === 0) {
      messages[sessionKey] = [{
        id: `init-${Date.now()}`,
        sessionKey,
        role: 'assistant',
        content: '我已上线，随时接收指令。回复将显示在下方，可前往「智能体」查看调度详情。',
        timestamp: Date.now(),
        agentName: '助理',
      }];
    }
  },
};
