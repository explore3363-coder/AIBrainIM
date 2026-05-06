import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

const runtimeProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}}).process;
const IS_TEST_ENV = runtimeProcess?.env?.JEST_WORKER_ID != null || runtimeProcess?.env?.NODE_ENV === 'test';

import type {Agent, Task, ConfirmationItem, DispatchRecord, RuntimeMode} from '../types';
import {agentsMock, tasksMock, confirmationMock} from '../data/mockData';
import {
  fetchRuntimeSnapshot,
  fetchConfirmations,
  resolveConfirmation,
} from '../data/api';
import {uploadService, type UploadFile} from '../services/uploadService';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AppContextValue {
  agents: Agent[];
  tasks: Task[];
  confirmations: ConfirmationItem[];
  dispatches: DispatchRecord[];
  uploads: UploadFile[];
  refreshing: boolean;
  pendingConfirmations: number;
  runtimeMode: RuntimeMode;
  runtimeError?: string;
  lastSyncedAt?: number;
  sessionCount: number;
  refresh: () => void;
  confirmItem: (id: string) => void;
  deferItem: (id: string) => void;
  registerDispatch: (payload: {
    userText: string;
    reply: string;
    taskId?: string;
    dispatchId?: string;
    sessionKey?: string;
    sent: boolean;
  }) => void;
  markLatestDispatchActive: (label?: string, agentId?: string, sessionKey?: string) => void;
  finalizeLatestDispatch: (payload: {
    status: 'completed' | 'failed';
    reply?: string;
    eta?: string;
    next?: string;
  }) => void;
}

function updateConfirmationStatus(
  items: ConfirmationItem[],
  id: string,
  status: 'confirmed' | 'deferred',
  resolutionNote: string,
) {
  return items.map(item =>
    item.id === id
      ? {...item, status, resolutionNote}
      : item
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext<AppContextValue>({
  agents: agentsMock,
  tasks: tasksMock,
  confirmations: confirmationMock,
  dispatches: [],
  uploads: [],
  refreshing: false,
  pendingConfirmations: confirmationMock.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length,
  runtimeMode: 'fallback',
  runtimeError: undefined,
  lastSyncedAt: undefined,
  sessionCount: 0,
  refresh: () => {},
  confirmItem: () => {},
  deferItem: () => {},
  registerDispatch: () => {},
  markLatestDispatchActive: () => {},
  finalizeLatestDispatch: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({children}: {children: ReactNode}) {
  const [agents, setAgents] = useState<Agent[]>(agentsMock);
  const [tasks, setTasks]   = useState<Task[]>(tasksMock);
  const [confirmations, setConfirmations] = useState<ConfirmationItem[]>(confirmationMock);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('fallback');
  const [runtimeError, setRuntimeError] = useState<string | undefined>();
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>();
  const [sessionCount, setSessionCount] = useState(0);

  const pendingConfirmations = useMemo(
    () => confirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length,
    [confirmations],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [snapshot, c] = await Promise.all([
        fetchRuntimeSnapshot(),
        fetchConfirmations(),
      ]);
      setAgents(snapshot.agents);
      setTasks(snapshot.tasks);
      setRuntimeMode(snapshot.runtimeMode);
      setRuntimeError(snapshot.runtimeError);
      setLastSyncedAt(snapshot.lastSyncedAt);
      setSessionCount(snapshot.sessionCount);
      setConfirmations(c);
      setUploads(uploadService.getQueue());
    } finally {
      setRefreshing(false);
    }
  }, []);

  const confirmItem = useCallback((id: string) => {
    setConfirmations(items => updateConfirmationStatus(items, id, 'confirmed', '已确认，等待执行链继续推进'));
    void resolveConfirmation(id, 'confirmed');
  }, []);

  const deferItem = useCallback((id: string) => {
    setConfirmations(items => updateConfirmationStatus(items, id, 'deferred', '已延后，保留在确认队列中待后续处理'));
    void resolveConfirmation(id, 'deferred');
  }, []);

  const registerDispatch = useCallback((payload: {
    userText: string;
    reply: string;
    taskId?: string;
    dispatchId?: string;
    sessionKey?: string;
    sent: boolean;
  }) => {
    const record: DispatchRecord = {
      id: payload.dispatchId ?? payload.taskId ?? `dispatch-${Date.now()}`,
      userText: payload.userText,
      reply: payload.reply,
      taskId: payload.taskId,
      dispatchId: payload.dispatchId,
      sessionKey: payload.sessionKey,
      createdAt: Date.now(),
      status: payload.sent ? 'submitted' : 'failed',
    };

    setDispatches(items => [record, ...items].slice(0, 20));

    if (payload.taskId) {
      const nextTask: Task = {
        id: payload.taskId,
        title: payload.userText.length > 42 ? `${payload.userText.slice(0, 42)}…` : payload.userText,
        owner: '助理 / 调度链',
        state: payload.sent ? 'running' : 'blocked',
        eta: payload.sent ? '已提交' : '发送失败',
        next: payload.sent ? '等待助理拆解与分派' : '检查网络或网关后重试',
        priority: 'P1',
      };
      setTasks(items => [nextTask, ...items].slice(0, 20));
    }
  }, []);

  const markLatestDispatchActive = useCallback((label?: string, agentId?: string, sessionKey?: string) => {
    setDispatches(items => items.map((item, index) => {
      if (index !== 0) return item;
      const actor = agentId ? `${agentId}:${label ?? '处理中'}` : undefined;
      return {
        ...item,
        status: 'dispatched',
        reply: actor ? `${item.reply}\n已进入执行：${actor}` : item.reply,
        sessionKey: sessionKey ?? item.sessionKey,
      };
    }));

    setTasks(items => items.map((item, index) => {
      if (index !== 0) return item;
      return {
        ...item,
        state: 'running',
        eta: '执行中',
        next: label ? `当前执行：${label}` : '子 Agent 已开始处理',
      };
    }));
  }, []);

  const finalizeLatestDispatch = useCallback((payload: {
    status: 'completed' | 'failed';
    reply?: string;
    eta?: string;
    next?: string;
  }) => {
    setDispatches(items => items.map((item, index) => {
      if (index !== 0) return item;
      const suffix = payload.reply ? `\n${payload.reply}` : '';
      const alreadyIncluded = payload.reply ? item.reply.includes(payload.reply) : true;
      return {
        ...item,
        status: payload.status,
        reply: alreadyIncluded ? item.reply : `${item.reply}${suffix}`,
      };
    }));

    setTasks(items => items.map((item, index) => {
      if (index !== 0) return item;
      return {
        ...item,
        state: payload.status === 'completed' ? 'done' : 'blocked',
        eta: payload.eta ?? (payload.status === 'completed' ? '已完成' : '执行异常'),
        next: payload.next ?? (payload.status === 'completed' ? '结果已回流到移动端' : '请检查调度链并重试'),
      };
    }));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (IS_TEST_ENV) {
      return;
    }

    const poll = setInterval(() => {
      setUploads([...uploadService.getQueue()]);
    }, 1200);
    return () => clearInterval(poll);
  }, []);

  return (
    <AppContext.Provider
      value={{
        agents,
        tasks,
        confirmations,
        dispatches,
        uploads,
        refreshing,
        pendingConfirmations,
        runtimeMode,
        runtimeError,
        lastSyncedAt,
        sessionCount,
        refresh,
        confirmItem,
        deferItem,
        registerDispatch,
        markLatestDispatchActive,
        finalizeLatestDispatch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAppContext() {
  return useContext(AppContext);
}
