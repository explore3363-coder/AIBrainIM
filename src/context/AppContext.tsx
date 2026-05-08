import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const runtimeProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}}).process;
const IS_TEST_ENV = runtimeProcess?.env?.JEST_WORKER_ID != null || runtimeProcess?.env?.NODE_ENV === 'test';

import type {Agent, Task, ConfirmationItem, DispatchRecord, RuntimeMode, TaskState, CaptureEntry} from '../types';
import {agentsMock, tasksMock, confirmationMock} from '../data/mockData';
import {
  fetchRuntimeSnapshot,
  fetchConfirmations,
  resolveConfirmation,
  pollForActivity,
  buildDispatchRecordUpdate,
} from '../data/api';
import {uploadService, type UploadFile} from '../services/uploadService';
import {
  getGatewayConfig,
  summarizeGatewayConfig,
  validateGatewayConfig,
} from '../services/gatewayConfig';

// ─── Types ─────────────────────────────────────────────────────────────────────
const APP_CONTEXT_STORAGE_KEY = '@AIBrainIM:appContext';

interface PersistedAppContextState {
  tasks: Task[];
  confirmations: ConfirmationItem[];
  dispatches: DispatchRecord[];
  recentCaptures: CaptureEntry[];
}

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
  gatewaySummary: string;
  gatewayConfigValid: boolean;
  gatewayWarningCount: number;
  refresh: () => void;
  refreshGatewayStatus: () => Promise<void>;
  confirmItem: (id: string) => void;
  deferItem: (id: string) => void;
  reopenItem: (id: string) => void;
  registerDispatch: (payload: {
    userText: string;
    reply: string;
    taskId?: string;
    dispatchId?: string;
    sessionKey?: string;
    sent: boolean;
    source?: 'chat' | 'upload' | 'knowledge' | 'memory' | 'confirmation' | 'system';
    attachmentFiles?: Array<{id: string; name: string; type: string; size: number; status: string; dispatchId?: string}>;
  }) => void;
  markLatestDispatchActive: (label?: string, agentId?: string, sessionKey?: string, runtimeMs?: number, updatedAt?: number) => void;
  finalizeLatestDispatch: (payload: {
    status: 'completed' | 'failed';
    reply?: string;
    eta?: string;
    next?: string;
    agentId?: string;
    label?: string;
    sessionKey?: string;
    updatedAt?: number;
  }) => void;
  registerKnowledgeCapture: (payload: {
    title: string;
    summary: string;
    category: 'fact' | 'decision' | 'rule';
    source: string;
    savedRemotely: boolean;
  }) => void;
  registerMemoryCapture: (payload: {
    content: string;
    category: 'preference' | 'decision' | 'fact' | 'rule';
    savedRemotely: boolean;
    mode: 'created' | 'updated' | 'resynced';
  }) => void;
  recentCaptures: CaptureEntry[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _updateConfirmationStatus(
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

function mergeConfirmations(
  localItems: ConfirmationItem[],
  liveItems: ConfirmationItem[],
): ConfirmationItem[] {
  const localMap = new Map(localItems.map(item => [item.id, item]));

  return liveItems.map(item => {
    const local = localMap.get(item.id);
    if (!local) {
      return item;
    }

    return {
      ...item,
      status: local.status ?? item.status,
      resolutionNote: local.resolutionNote ?? item.resolutionNote,
    };
  });
}

function sanitizePersistedState(value: unknown): PersistedAppContextState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<PersistedAppContextState>;

  return {
    tasks: Array.isArray(source.tasks) ? source.tasks : [],
    confirmations: Array.isArray(source.confirmations) ? source.confirmations : [],
    dispatches: Array.isArray(source.dispatches) ? source.dispatches : [],
    recentCaptures: Array.isArray(source.recentCaptures) ? source.recentCaptures : [],
  };
}

function getDispatchIdentity(record: DispatchRecord): string {
  if (record.sessionKey) return `session:${record.sessionKey}`;
  if (record.dispatchId) return `dispatch:${record.dispatchId}`;
  if (record.taskId) return `task:${record.taskId}`;
  return `text:${record.userText}`;
}

function mergeDispatchRecords(
  localRecords: DispatchRecord[],
  liveRecords: DispatchRecord[],
): DispatchRecord[] {
  const merged = new Map<string, DispatchRecord>();

  const push = (record: DispatchRecord) => {
    const key = getDispatchIdentity(record);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, record);
      return;
    }

    const existingTime = existing.updatedAt ?? existing.createdAt;
    const nextTime = record.updatedAt ?? record.createdAt;
    const preferred = nextTime >= existingTime
      ? {
          ...existing,
          ...record,
          reply: record.reply || existing.reply,
          userText: record.userText || existing.userText,
        }
      : {
          ...record,
          ...existing,
          reply: existing.reply || record.reply,
          userText: existing.userText || record.userText,
        };

    merged.set(key, preferred);
  };

  localRecords.forEach(push);
  liveRecords.forEach(push);

  return Array.from(merged.values())
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, 20);
}

function getTaskIdentity(task: Task): string {
  if (task.sessionKey) return `session:${task.sessionKey}`;
  return task.id;
}

function mergeTasks(localTasks: Task[], liveTasks: Task[]): Task[] {
  const merged = new Map<string, Task>();

  const push = (task: Task) => {
    const key = getTaskIdentity(task);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, task);
      return;
    }

    const existingTime = existing.updatedAt ?? 0;
    const nextTime = task.updatedAt ?? 0;
    const preferred = nextTime >= existingTime
      ? {
          ...existing,
          ...task,
          title: task.title || existing.title,
          owner: task.owner || existing.owner,
          traceSummary: task.traceSummary || existing.traceSummary,
        }
      : {
          ...task,
          ...existing,
          title: existing.title || task.title,
          owner: existing.owner || task.owner,
          traceSummary: existing.traceSummary || task.traceSummary,
        };

    merged.set(key, preferred);
  };

  localTasks.forEach(push);
  liveTasks.forEach(push);

  return Array.from(merged.values())
    .sort((a, b) => {
      const aTime = a.updatedAt ?? 0;
      const bTime = b.updatedAt ?? 0;
      return bTime - aTime;
    })
    .slice(0, 20);
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
  gatewaySummary: '配置读取中…',
  gatewayConfigValid: false,
  gatewayWarningCount: 0,
  refresh: () => {},
  refreshGatewayStatus: async () => {},
  confirmItem: () => {},
  deferItem: () => {},
  reopenItem: () => {},
  registerDispatch: () => {},
  markLatestDispatchActive: () => {},
  finalizeLatestDispatch: () => {},
  registerKnowledgeCapture: () => {},
  registerMemoryCapture: () => {},
  recentCaptures: [],
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
  const [gatewaySummary, setGatewaySummary] = useState('配置读取中…');
  const [gatewayConfigValid, setGatewayConfigValid] = useState(false);
  const [gatewayWarningCount, setGatewayWarningCount] = useState(0);
  const [recentCaptures, setRecentCaptures] = useState<CaptureEntry[]>([]);
  const uploadStatusRef = useRef<Record<string, UploadFile['status']>>({});
  const hasHydratedRef = useRef(false);

  const latestDispatch = Array.isArray(dispatches) ? dispatches[0] : undefined;

  const pendingConfirmations = useMemo(
    () => confirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length,
    [confirmations],
  );

  const refreshGatewayStatus = useCallback(async () => {
    const gatewayConfig = await getGatewayConfig();
    const gatewayValidation = validateGatewayConfig(gatewayConfig);
    setGatewaySummary(summarizeGatewayConfig(gatewayConfig));
    setGatewayConfigValid(gatewayValidation.valid);
    setGatewayWarningCount(gatewayValidation.warnings.length);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(APP_CONTEXT_STORAGE_KEY)
      .then(raw => {
        if (!raw) {
          hasHydratedRef.current = true;
          return;
        }

        const parsed = sanitizePersistedState(JSON.parse(raw));
        if (!parsed) {
          hasHydratedRef.current = true;
          return;
        }

        if (parsed.tasks.length > 0) {
          setTasks(current => mergeTasks(current, parsed.tasks));
        }
        if (parsed.dispatches.length > 0) {
          setDispatches(current => mergeDispatchRecords(current, parsed.dispatches));
        }
        if (parsed.confirmations.length > 0) {
          setConfirmations(current => mergeConfirmations(parsed.confirmations, current));
        }
        if (parsed.recentCaptures.length > 0) {
          setRecentCaptures(parsed.recentCaptures.slice(0, 10));
        }
      })
      .catch(() => {
        // Ignore corrupt local state and continue with fresh runtime data.
      })
      .finally(() => {
        hasHydratedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    const nextState: PersistedAppContextState = {
      tasks: tasks.slice(0, 20),
      confirmations,
      dispatches: dispatches.slice(0, 20),
      recentCaptures: recentCaptures.slice(0, 10),
    };

    AsyncStorage.setItem(APP_CONTEXT_STORAGE_KEY, JSON.stringify(nextState)).catch(() => {
      // Ignore local persistence failures; runtime state should keep working.
    });
  }, [tasks, confirmations, dispatches, recentCaptures]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [snapshot, c] = await Promise.all([
        fetchRuntimeSnapshot(),
        fetchConfirmations(),
      ]);
      setAgents(Array.isArray(snapshot.agents) ? snapshot.agents : []);
      setTasks(current => mergeTasks(current, Array.isArray(snapshot.tasks) ? snapshot.tasks : []));
      setDispatches(current => mergeDispatchRecords(current, snapshot.dispatches ?? []));
      setRuntimeMode(snapshot.runtimeMode);
      setRuntimeError(snapshot.runtimeError);
      setLastSyncedAt(snapshot.lastSyncedAt);
      setSessionCount(typeof snapshot.sessionCount === 'number' ? snapshot.sessionCount : 0);
      setConfirmations(current => mergeConfirmations(current, c));
      setUploads(uploadService.getQueue());
      await refreshGatewayStatus();
    } finally {
      setRefreshing(false);
    }
  }, [refreshGatewayStatus]);

  const confirmItem = useCallback((id: string) => {
    const target = confirmations.find(item => item.id === id);
    const updatedAt = Date.now();

    if (!target) {
      return;
    }

    const taskId = `confirm-${id}`;
    const dispatchId = `confirm-dp-${updatedAt.toString(36)}`;
    const resolutionNote = '已确认，等待执行链继续推进';

    setConfirmations(items => items.map(item =>
      item.id === id
        ? {
            ...item,
            status: 'confirmed',
            resolutionNote,
            resolvedAt: updatedAt,
            followUpTaskId: taskId,
            followUpDispatchId: dispatchId,
          }
        : item,
    ));

    setTasks(items => {
      const nextTask: Task = {
        id: taskId,
        title: `确认执行：${target.title}`,
        owner: `${target.agent} / 确认链路`,
        state: 'running',
        eta: '已确认',
        next: '确认结果已回流，等待对应 Agent 继续推进',
        priority: target.urgency === 'high' ? 'P0' : target.urgency === 'normal' ? 'P1' : 'P2',
        updatedAt,
        sourceType: 'confirmation',
        traceSummary: '确认链路已拍板，执行重新进入推进态',
      };
      return [nextTask, ...items.filter(item => item.id !== taskId)].slice(0, 20);
    });

    const confirmDispatch: DispatchRecord = {
      id: `confirm-dispatch-${id}-${updatedAt}`,
      userText: `确认：${target.title}`,
      reply: `✓ 你已确认「${target.title}」，结果已回流到任务流，后续执行会继续沿调度链推进。`,
      taskId,
      dispatchId,
      createdAt: updatedAt,
      updatedAt,
      status: 'processing',
      source: 'confirmation',
      agentId: target.agent,
      label: '确认链路继续推进',
      stageText: '已确认，等待对应 Agent 继续执行',
    };

    setDispatches(items => [confirmDispatch, ...items].slice(0, 20));

    resolveConfirmation(id, 'confirmed').catch(() => {});
  }, [confirmations]);

  const deferItem = useCallback((id: string) => {
    const target = confirmations.find(item => item.id === id);
    const updatedAt = Date.now();

    if (!target) {
      return;
    }

    const taskId = `confirm-${id}`;
    const dispatchId = `defer-dp-${updatedAt.toString(36)}`;
    const resolutionNote = '已延后，保留在确认队列中待后续处理';

    setConfirmations(items => items.map(item =>
      item.id === id
        ? {
            ...item,
            status: 'deferred',
            resolutionNote,
            resolvedAt: updatedAt,
            followUpTaskId: taskId,
            followUpDispatchId: dispatchId,
          }
        : item,
    ));

    setTasks(items => {
      const deferredTask: Task = {
        id: taskId,
        title: `确认待处理：${target.title}`,
        owner: `${target.agent} / 确认链路`,
        state: 'blocked',
        eta: '已延后',
        next: '等待你稍后重新拍板，再继续推进对应执行链',
        priority: target.urgency === 'high' ? 'P0' : target.urgency === 'normal' ? 'P1' : 'P2',
        updatedAt,
        sourceType: 'confirmation',
        traceSummary: '确认链路已延后，保留人工决策入口',
      };
      return [deferredTask, ...items.filter(item => item.id !== taskId)].slice(0, 20);
    });

    const deferDispatch: DispatchRecord = {
      id: `defer-dispatch-${id}-${updatedAt}`,
      userText: `延后：${target.title}`,
      reply: `🕒 你已将「${target.title}」标记为稍后处理，系统会保留这条决策入口，不会直接丢失。`,
      taskId,
      dispatchId,
      createdAt: updatedAt,
      updatedAt,
      status: 'submitted',
      source: 'confirmation',
      agentId: target.agent,
      label: '确认链路暂缓',
      stageText: '已延后，等待重新确认',
    };

    setDispatches(items => [deferDispatch, ...items].slice(0, 20));

    resolveConfirmation(id, 'deferred').catch(() => {});
  }, [confirmations]);

  const reopenItem = useCallback((id: string) => {
    const target = confirmations.find(item => item.id === id);
    const updatedAt = Date.now();

    if (!target || (target.status ?? 'pending') !== 'deferred') {
      return;
    }

    const taskId = target.followUpTaskId ?? `confirm-${id}`;
    const dispatchId = `reopen-dp-${updatedAt.toString(36)}`;
    const nextReopenCount = (target.reopenCount ?? 0) + 1;
    const resolutionNote = nextReopenCount > 1
      ? `已重新打开确认（第 ${nextReopenCount} 次），等待你再次拍板`
      : '已重新打开确认，等待你再次拍板';

    setConfirmations(items => items.map(item =>
      item.id === id
        ? {
            ...item,
            status: 'pending',
            resolutionNote,
            reopenedAt: updatedAt,
            reopenCount: nextReopenCount,
            followUpTaskId: taskId,
            followUpDispatchId: dispatchId,
          }
        : item,
    ));

    setTasks(items => {
      const reopenedTask: Task = {
        id: taskId,
        title: `等待确认：${target.title}`,
        owner: `${target.agent} / 确认链路`,
        state: 'blocked',
        eta: '重新待确认',
        next: '请重新确认或再次延后，决定后再继续推进执行链',
        priority: target.urgency === 'high' ? 'P0' : target.urgency === 'normal' ? 'P1' : 'P2',
        updatedAt,
        sourceType: 'confirmation',
        traceSummary: '确认链路已重新打开，等待新的人工决策',
      };
      return [reopenedTask, ...items.filter(item => item.id !== taskId)].slice(0, 20);
    });

    const reopenDispatch: DispatchRecord = {
      id: `reopen-dispatch-${id}-${updatedAt}`,
      userText: `重新打开确认：${target.title}`,
      reply: `↩️ 已重新打开「${target.title}」的确认入口，这条事项重新回到待拍板状态。`,
      taskId,
      dispatchId,
      createdAt: updatedAt,
      updatedAt,
      status: 'submitted',
      source: 'confirmation',
      agentId: target.agent,
      label: '确认链路重新打开',
      stageText: '已重新打开，等待再次确认',
    };

    setDispatches(items => [reopenDispatch, ...items].slice(0, 20));
  }, [confirmations]);

  const registerDispatch = useCallback((payload: {
    userText: string;
    reply: string;
    taskId?: string;
    dispatchId?: string;
    sessionKey?: string;
    sent: boolean;
    source?: 'chat' | 'upload' | 'knowledge' | 'memory' | 'confirmation' | 'system';
    attachmentFiles?: Array<{id: string; name: string; type: string; size: number; status: string; dispatchId?: string}>;
  }) => {
    const createdAt = Date.now();
    const record: DispatchRecord = {
      id: payload.dispatchId ?? payload.taskId ?? `dispatch-${createdAt}`,
      userText: payload.userText,
      reply: payload.reply,
      taskId: payload.taskId,
      dispatchId: payload.dispatchId,
      sessionKey: payload.sessionKey,
      createdAt,
      updatedAt: createdAt,
      status: payload.sent ? 'submitted' : 'failed',
      source: payload.source ?? (payload.attachmentFiles && payload.attachmentFiles.length > 0 ? 'upload' : 'chat'),
    };

    setDispatches(items => [record, ...items].slice(0, 20));

    // Back-link uploaded files to this dispatch so the UploadScreen and
    // DispatchChainScreen can show which files were involved.
    if (payload.attachmentFiles) {
      payload.attachmentFiles.forEach(file => {
        uploadService.updateFileDispatchId(file.id, record.id);
      });
    }

    if (payload.taskId) {
      const attachmentCount = payload.attachmentFiles?.length ?? 0;
      const nextTask: Task = {
        id: payload.taskId,
        title: payload.userText.length > 42 ? `${payload.userText.slice(0, 42)}…` : payload.userText,
        owner: payload.source === 'upload' || attachmentCount > 0
          ? '附件入口 / 调度链'
          : payload.source === 'knowledge'
            ? '知识库 / 调度链'
            : payload.source === 'memory'
              ? '记忆库 / 调度链'
              : payload.source === 'confirmation'
                ? '确认链 / 调度链'
                : payload.source === 'system'
                  ? '系统检查 / 调度链'
                  : '助理 / 调度链',
        state: payload.sent ? 'running' : 'blocked',
        eta: payload.sent ? '已提交' : '发送失败',
        next: payload.sent ? '等待助理拆解与分派' : '检查网络或网关后重试',
        priority: payload.source === 'confirmation' ? 'P0' : payload.source === 'system' ? 'P2' : 'P1',
        sessionKey: payload.sessionKey,
        updatedAt: createdAt,
        sourceType: payload.source ?? (attachmentCount > 0 ? 'upload' : 'chat'),
        traceSummary: payload.sent
          ? `移动端已生成调度单${attachmentCount > 0 ? `，含 ${attachmentCount} 个附件` : ''}，等待状态继续回流`
          : '发送失败，等待重试',
        attachmentCount,
      };
      setTasks(items => [nextTask, ...items].slice(0, 20));
    }
  }, []);

  const markLatestDispatchActive = useCallback((label?: string, agentId?: string, sessionKey?: string, runtimeMs?: number, updatedAt?: number) => {
    const update = buildDispatchRecordUpdate({label, agentId, sessionKey, status: 'running', runtimeMs, updatedAt});

    setDispatches(items => items.map((item, index) => {
      if (index !== 0) return item;
      const alreadyIncluded = update.stageText ? item.reply.includes(update.stageText) : true;
      return {
        ...item,
        ...update,
        reply: update.stageText && !alreadyIncluded ? `${item.reply}\n已进入执行：${update.stageText}` : item.reply,
      };
    }));

    setTasks(items => items.map((item, index) => {
      if (index !== 0) return item;
      return {
        ...item,
        state: 'running',
        eta: runtimeMs && runtimeMs > 0 ? `${Math.round(runtimeMs / 1000)}s` : '执行中',
        next: label ? `当前执行：${label}` : '子 Agent 已开始处理',
        agentId: agentId ?? item.agentId,
        sessionKey: sessionKey ?? item.sessionKey,
        updatedAt: updatedAt ?? Date.now(),
        sourceType: item.sourceType ?? 'chat',
        traceSummary: update.stageText ?? item.traceSummary,
      };
    }));
  }, []);

  const finalizeLatestDispatch = useCallback((payload: {
    status: 'completed' | 'failed';
    reply?: string;
    eta?: string;
    next?: string;
    agentId?: string;
    label?: string;
    sessionKey?: string;
    updatedAt?: number;
  }) => {
    setDispatches(items => items.map((item, index) => {
      if (index !== 0) return item;
      const suffix = payload.reply ? `\n${payload.reply}` : '';
      const alreadyIncluded = payload.reply ? item.reply.includes(payload.reply) : true;
      return {
        ...item,
        status: payload.status,
        reply: alreadyIncluded ? item.reply : `${item.reply}${suffix}`,
        updatedAt: payload.updatedAt ?? Date.now(),
        agentId: payload.agentId ?? item.agentId,
        label: payload.label ?? item.label,
        sessionKey: payload.sessionKey ?? item.sessionKey,
        stageText: payload.label ?? item.stageText,
      };
    }));

    setTasks(items => items.map((item, index) => {
      if (index !== 0) return item;
      return {
        ...item,
        state: payload.status === 'completed' ? 'done' : 'blocked',
        eta: payload.eta ?? (payload.status === 'completed' ? '已完成' : '执行异常'),
        next: payload.next ?? (payload.status === 'completed' ? '结果已回流到移动端' : '请检查调度链并重试'),
        agentId: payload.agentId ?? item.agentId,
        sessionKey: payload.sessionKey ?? item.sessionKey,
        updatedAt: payload.updatedAt ?? Date.now(),
        traceSummary: payload.label ?? item.traceSummary,
      };
    }));
  }, []);

  const registerKnowledgeCapture = useCallback((payload: {
    title: string;
    summary: string;
    category: 'fact' | 'decision' | 'rule';
    source: string;
    savedRemotely: boolean;
  }) => {
    const createdAt = Date.now();
    const taskId = `kb-${createdAt}`;
    const dispatchId = `kb-dp-${createdAt.toString(36)}`;
    const status: DispatchRecord['status'] = payload.savedRemotely ? 'completed' : 'processing';
    const taskState: TaskState = payload.savedRemotely ? 'done' : 'running';
    const priority: Task['priority'] = payload.category === 'rule' ? 'P0' : payload.category === 'decision' ? 'P1' : 'P2';
    const reply = payload.savedRemotely
      ? `📚 已将「${payload.title}」收录到记忆层，来源：${payload.source}。`
      : `📚 已先将「${payload.title}」保留在移动端闭环中，待网关恢复后再补写远程记忆层。`;

    const dispatchRecord: DispatchRecord = {
      id: dispatchId,
      userText: `知识收录：${payload.title}`,
      reply,
      taskId,
      dispatchId,
      createdAt,
      status,
    };

    const taskRecord: Task = {
      id: taskId,
      title: `知识收录：${payload.title}`,
      owner: '知识库 / 记忆层',
      state: taskState,
      eta: payload.savedRemotely ? '已收录' : '待补写',
      next: payload.savedRemotely
        ? `${payload.category} 已进入长期记忆，可继续在记忆库检索与复用`
        : '当前先保留本地闭环，等待远程记忆层恢复后自动补齐',
      priority,
    };

    setDispatches(items => [dispatchRecord, ...items].slice(0, 20));

    setTasks(items => [taskRecord, ...items.filter(item => item.id !== taskId)].slice(0, 20));

    setRecentCaptures(items => [
      {
        id: `capture-kb-${createdAt}`,
        type: 'knowledge' as const,
        title: payload.title,
        summary: payload.summary,
        category: payload.category,
        savedRemotely: payload.savedRemotely,
        timestamp: createdAt,
      },
      ...items,
    ].slice(0, 10));
  }, []);

  const registerMemoryCapture = useCallback((payload: {
    content: string;
    category: 'preference' | 'decision' | 'fact' | 'rule';
    savedRemotely: boolean;
    mode: 'created' | 'updated' | 'resynced';
  }) => {
    const createdAt = Date.now();
    const taskId = `memory-${createdAt}`;
    const dispatchId = `memory-dp-${createdAt.toString(36)}`;
    const title = payload.content.length > 28 ? `${payload.content.slice(0, 28)}…` : payload.content;
    const normalizedCategory = payload.category === 'preference' ? 'fact' : payload.category;
    const priority: Task['priority'] = normalizedCategory === 'rule' ? 'P0' : normalizedCategory === 'decision' ? 'P1' : 'P2';
    const status: DispatchRecord['status'] = payload.savedRemotely ? 'completed' : 'processing';
    const taskState: TaskState = payload.savedRemotely ? 'done' : 'running';
    const modeLabel = payload.mode === 'updated' ? '记忆更新' : payload.mode === 'resynced' ? '记忆补写' : '记忆写入';
    const reply = payload.savedRemotely
      ? `🧠 ${modeLabel}已完成：「${title}」已进入 OpenClaw 记忆层。`
      : `🧠 ${modeLabel}已先保留在移动端闭环中，待远程记忆层恢复后再补写：「${title}」。`;

    const dispatchRecord: DispatchRecord = {
      id: dispatchId,
      userText: `${modeLabel}：${title}`,
      reply,
      taskId,
      dispatchId,
      createdAt,
      status,
    };

    const taskRecord: Task = {
      id: taskId,
      title: `${modeLabel}：${title}`,
      owner: '记忆库 / 记忆层',
      state: taskState,
      eta: payload.savedRemotely ? '已收录' : '待补写',
      next: payload.savedRemotely
        ? `${payload.category} 记忆已可在移动端与远程记忆层继续检索复用`
        : '当前先保留本地闭环，等待远程记忆层恢复后自动补齐',
      priority,
    };

    setDispatches(items => [dispatchRecord, ...items].slice(0, 20));
    setTasks(items => [taskRecord, ...items.filter(item => item.id !== taskId)].slice(0, 20));

    setRecentCaptures(items => [
      {
        id: `capture-mem-${createdAt}`,
        type: 'memory' as const,
        title,
        summary: payload.content,
        category: normalizedCategory,
        savedRemotely: payload.savedRemotely,
        timestamp: createdAt,
      },
      ...items,
    ].slice(0, 10));
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

  useEffect(() => {
    if (!uploads.length) {
      return;
    }

    const seen = uploadStatusRef.current;
    const nextSeen: Record<string, UploadFile['status']> = {};

    uploads.forEach(file => {
      const previousStatus = seen[file.id];
      nextSeen[file.id] = file.status;

      if (previousStatus === file.status) {
        return;
      }

      const createdAt = Date.now();
      const taskId = `upload-${file.id}`;
      const dispatchId = `upload-dp-${file.id}-${createdAt.toString(36)}`;

      if (file.status === 'processing') {
        setDispatches(items => {
          const record: DispatchRecord = {
            id: dispatchId,
            userText: `附件进入处理：${file.name}`,
            reply: `📎 附件「${file.name}」已上传完成，正在进入后台处理队列。`,
            taskId,
            dispatchId,
            createdAt,
            status: 'processing',
          };
          return [record, ...items].slice(0, 20);
        });

        setTasks(items => {
          const nextTask: Task = {
            id: taskId,
            title: `附件处理：${file.name}`,
            owner: file.agent ? `${file.agent} / 附件链路` : '附件链路',
            state: 'running',
            eta: '后台处理中',
            next: '等待 AI 分析与分派结果回流',
            priority: file.type === 'video' || file.type === 'archive' ? 'P1' : 'P2',
          };
          return [nextTask, ...items.filter(item => item.id !== taskId)].slice(0, 20);
        });
        return;
      }

      if (file.status === 'dispatched') {
        setDispatches(items => {
          const record: DispatchRecord = {
            id: dispatchId,
            userText: `附件已分派：${file.name}`,
            reply: `📎 附件「${file.name}」已分派给 ${file.agent ?? '对应智能体'}，结果会继续回流到首页 AI 产出流。`,
            taskId,
            dispatchId,
            createdAt,
            status: 'dispatched',
          };
          return [record, ...items].slice(0, 20);
        });

        // Back-link the dispatchId into the upload file so UploadScreen can navigate to it
        uploadService.updateFileDispatchId(file.id, dispatchId);

        setTasks(items => items.map(item => item.id === taskId ? {
          ...item,
          owner: file.agent ? `${file.agent} / 附件链路` : item.owner,
          state: 'running',
          eta: '已分派',
          next: `当前由 ${file.agent ?? '对应智能体'} 继续处理`,
        } : item));
        return;
      }

      if (file.status === 'done') {
        setDispatches(items => {
          const record: DispatchRecord = {
            id: dispatchId,
            userText: `附件闭环完成：${file.name}`,
            reply: `✅ 附件「${file.name}」已完成处理${file.agent ? `，执行方：${file.agent}` : ''}。`,
            taskId,
            dispatchId,
            createdAt,
            status: 'completed',
          };
          return [record, ...items].slice(0, 20);
        });

        setTasks(items => items.map(item => item.id === taskId ? {
          ...item,
          owner: file.agent ? `${file.agent} / 附件链路` : item.owner,
          state: 'done',
          eta: '已完成',
          next: '附件处理结果已回流到移动端闭环',
        } : item));
        return;
      }

      if (file.status === 'error') {
        setDispatches(items => {
          const record: DispatchRecord = {
            id: dispatchId,
            userText: `附件处理失败：${file.name}`,
            reply: `⚠️ 附件「${file.name}」处理失败：${file.error ?? '未知错误'}。`,
            taskId,
            dispatchId,
            createdAt,
            status: 'failed',
          };
          return [record, ...items].slice(0, 20);
        });

        setTasks(items => {
          const existing = items.some(item => item.id === taskId);
          const blockedTask: Task = {
            id: taskId,
            title: `附件处理：${file.name}`,
            owner: file.agent ? `${file.agent} / 附件链路` : '附件链路',
            state: 'blocked',
            eta: '处理失败',
            next: file.error ?? '请检查上传链路后重试',
            priority: 'P1',
          };
          return existing
            ? items.map(item => item.id === taskId ? blockedTask : item)
            : [blockedTask, ...items].slice(0, 20);
        });
      }
    });

    uploadStatusRef.current = nextSeen;
  }, [uploads]);

  useEffect(() => {
    if (IS_TEST_ENV) {
      return;
    }

    if (!latestDispatch || latestDispatch.status === 'completed' || latestDispatch.status === 'failed') {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const activity = await pollForActivity(latestDispatch.createdAt);
        if (cancelled || !activity.active) {
          return;
        }

        if (activity.status === 'done') {
          finalizeLatestDispatch({
            status: 'completed',
            reply: `✓ ${(activity.agentId ?? 'AI')} ${activity.label ? `[${activity.label}] ` : ''}已完成本轮执行，结果已自动回填。`,
            eta: '已完成',
            next: '结果已同步到任务流、调度链与首页 AI 产出流',
            agentId: activity.agentId,
            label: activity.label,
            sessionKey: activity.sessionKey,
            updatedAt: activity.updatedAt,
          });
          return;
        }

        markLatestDispatchActive(activity.label, activity.agentId, activity.sessionKey, activity.runtimeMs, activity.updatedAt);
      } catch {
        // Ignore transient polling errors; keep local loop alive.
      }
    };

    tick();
    const poll = setInterval(() => {
      tick().catch(() => {});
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [latestDispatch, finalizeLatestDispatch, markLatestDispatchActive]);

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
        gatewaySummary,
        gatewayConfigValid,
        gatewayWarningCount,
        refresh,
        refreshGatewayStatus,
        confirmItem,
        deferItem,
        reopenItem,
        registerDispatch,
        markLatestDispatchActive,
        finalizeLatestDispatch,
        registerKnowledgeCapture,
        registerMemoryCapture,
        recentCaptures,
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
