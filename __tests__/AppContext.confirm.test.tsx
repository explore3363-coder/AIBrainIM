/**
 * AppContext — lightweight smoke tests only.
 * Full integration tests are in api.test.ts and uploadService.test.ts.
 * The AppContext component is complex (timers, nested effects); these tests
 * verify it renders and has the expected initial state shape.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppProvider, useAppContext} from '../src/context/AppContext';
import type {ConfirmationItem, DispatchRecord, Task} from '../src/types';

interface CapturedContextSnapshot {
  confirmations: ConfirmationItem[];
  dispatches: DispatchRecord[];
  tasks: Task[];
  pendingConfirmations: number;
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
}

const appStateListeners: Array<(state: string) => void> = [];

jest.mock('../src/services/gatewayConfig', () => ({
  getGatewayConfig: jest.fn(async () => ({})),
  validateGatewayConfig: jest.fn(() => ({valid: false, warnings: ['missing']})),
  summarizeGatewayConfig: jest.fn(() => 'Gateway 未配置'),
}));

jest.mock('../src/services/releaseChannel', () => ({
  getAppleReleaseStatus: jest.fn(() => ({
    applePrerequisitesReady: false,
    firstTestFlightBuildUploaded: false,
    appStoreAssetsReady: false,
    summary: 'Apple Developer / App Store Connect / GitHub CI 变量仍待补齐',
    source: 'default',
    latestLiveUpload: undefined,
    preflightFailedChecks: [],
    missingAppleInputs: [],
  })),
}));

jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
  if (event === 'change') {
    appStateListeners.push(handler as (state: string) => void);
  }
  return {remove: jest.fn()} as any;
});

function CaptureCtx({
  onCtx,
}: {
  onCtx: (ctx: CapturedContextSnapshot) => void,
}) {
  const ctx = useAppContext();
  onCtx({
    confirmations: ctx.confirmations,
    dispatches: ctx.dispatches,
    tasks: ctx.tasks,
    pendingConfirmations: ctx.pendingConfirmations,
    confirmItem: ctx.confirmItem,
    deferItem: ctx.deferItem,
    reopenItem: ctx.reopenItem,
    registerDispatch: ctx.registerDispatch,
    registerKnowledgeCapture: ctx.registerKnowledgeCapture,
    registerMemoryCapture: ctx.registerMemoryCapture,
  });
  return <Text>ok</Text>;
}

function hasRestoredPersistedState(snapshot: CapturedContextSnapshot | null): boolean {
  if (!snapshot) {
    return false;
  }

  const restoredConfirmation = snapshot.confirmations.find((item: ConfirmationItem) => item.id === 'c1');
  return snapshot.tasks.some((task: Task) => task.id === 'persisted-task')
    && snapshot.dispatches.some((dispatch: DispatchRecord) => dispatch.id === 'persisted-dispatch')
    && restoredConfirmation?.status === 'confirmed';
}

describe('AppProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    appStateListeners.length = 0;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async () => null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async () => undefined);
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async () => undefined);
  });

  test('renders without crashing', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AppProvider>
          <Text>hello</Text>
        </AppProvider>,
      );
      await Promise.resolve();
    });
    expect(renderer).toBeTruthy();
    await ReactTestRenderer.act(async () => {
      renderer!.unmount();
      await Promise.resolve();
    });
  });

  test('initial state has mock confirmations', async () => {
    let ctxSnapshot: {
      confirmations: ConfirmationItem[];
      pendingConfirmations: number;
      confirmItem: (id: string) => void;
      deferItem: (id: string) => void;
      dispatches: DispatchRecord[];
      tasks: Task[];
    } | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx
            onCtx={(ctx) => {
              ctxSnapshot = ctx;
            }}
          />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    expect(ctxSnapshot).not.toBeNull();
    expect(ctxSnapshot!.confirmations.length).toBeGreaterThan(0);
    expect(ctxSnapshot!.pendingConfirmations).toBeGreaterThan(0);
  });

  test('pendingConfirmations reflects only unresolved items', async () => {
    let ctxSnapshot: {
      pendingConfirmations: number;
      confirmations: ConfirmationItem[];
      confirmItem: (id: string) => void;
      deferItem: (id: string) => void;
      dispatches: DispatchRecord[];
      tasks: Task[];
    } | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    const pending = ctxSnapshot!.confirmations.filter(
      (c) => c.status !== 'confirmed' && c.status !== 'deferred',
    );
    expect(ctxSnapshot!.pendingConfirmations).toBe(pending.length);
  });

  test('dispatches and tasks start empty or with mock data', async () => {
    let ctxSnapshot: {
      dispatches: DispatchRecord[];
      tasks: Task[];
      confirmations: ConfirmationItem[];
      pendingConfirmations: number;
      confirmItem: (id: string) => void;
      deferItem: (id: string) => void;
    } | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    expect(ctxSnapshot).not.toBeNull();
    // Both start with mock data (dispatches=[] since FALLBACK, tasks=tasksMock)
    expect(Array.isArray(ctxSnapshot!.dispatches)).toBe(true);
    expect(Array.isArray(ctxSnapshot!.tasks)).toBe(true);
  });

  test('hydrates persisted task, dispatch, confirmation and capture state from local storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => (
      key === '@AIBrainIM:appContext'
        ? JSON.stringify({
      tasks: [
        {
          id: 'persisted-task',
          title: '持久化任务',
          owner: '测试链路',
          state: 'running',
          eta: '执行中',
          next: '等待回流',
          priority: 'P1',
          sourceType: 'chat',
        },
      ],
      confirmations: [
        {
          id: 'c1',
          title: '确认一条策略',
          description: '本地已确认',
          agent: '助理',
          urgency: 'high',
          timestamp: '刚刚',
          status: 'confirmed',
          resolutionNote: '已从本地恢复',
        },
      ],
      dispatches: [
        {
          id: 'persisted-dispatch',
          userText: '持久化调度',
          reply: '本地调度已恢复',
          taskId: 'persisted-task',
          createdAt: 123,
          updatedAt: 124,
          status: 'completed',
          source: 'chat',
        },
      ],
      recentCaptures: [
        {
          id: 'capture-1',
          type: 'memory',
          title: '一条记忆',
          summary: '从本地恢复',
          category: 'fact',
          savedRemotely: false,
          timestamp: 125,
        },
      ],
        })
        : null
    ));

    let ctxSnapshot: CapturedContextSnapshot | null = null;

    let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (hasRestoredPersistedState(ctxSnapshot)) {
        break;
      }

      await ReactTestRenderer.act(async () => {
        await Promise.resolve();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      });
    }

    expect(renderer).not.toBeNull();
    expect(ctxSnapshot).not.toBeNull();
    expect(ctxSnapshot!.tasks.some(task => task.id === 'persisted-task')).toBe(true);
    expect(ctxSnapshot!.dispatches.some(dispatch => dispatch.id === 'persisted-dispatch')).toBe(true);

    const restoredConfirmation = ctxSnapshot!.confirmations.find(item => item.id === 'c1');
    expect(restoredConfirmation?.status).toBe('confirmed');
    expect(restoredConfirmation?.resolutionNote).toBe('已从本地恢复');
    expect(ctxSnapshot!.pendingConfirmations).toBe(
      ctxSnapshot!.confirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length,
    );
  });

  test('confirmItem updates confirmation, task and dispatch together', async () => {
    let ctxSnapshot: {
      confirmations: ConfirmationItem[];
      dispatches: DispatchRecord[];
      tasks: Task[];
      pendingConfirmations: number;
      confirmItem: (id: string) => void;
      deferItem: (id: string) => void;
    } | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    const target = ctxSnapshot!.confirmations.find(item => (item.status ?? 'pending') === 'pending');
    expect(target).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      ctxSnapshot!.confirmItem(target!.id);
      await Promise.resolve();
    });

    const updatedConfirmation = ctxSnapshot!.confirmations.find(item => item.id === target!.id);
    expect(updatedConfirmation?.status).toBe('confirmed');
    expect(updatedConfirmation?.resolutionNote).toContain('已确认');
    expect(updatedConfirmation?.followUpTaskId).toBe(`confirm-${target!.id}`);
    expect(updatedConfirmation?.followUpDispatchId).toBeTruthy();
    expect(typeof updatedConfirmation?.resolvedAt).toBe('number');

    const linkedTask = ctxSnapshot!.tasks.find(task => task.id === `confirm-${target!.id}`);
    expect(linkedTask).toBeTruthy();
    expect(linkedTask?.state).toBe('running');
    expect(linkedTask?.sourceType).toBe('confirmation');

    const linkedDispatch = ctxSnapshot!.dispatches.find(dispatch => dispatch.taskId === `confirm-${target!.id}`);
    expect(linkedDispatch).toBeTruthy();
    expect(linkedDispatch?.status).toBe('processing');
    expect(linkedDispatch?.source).toBe('confirmation');
  });

  test('deferItem preserves a blocked confirmation task and dispatch', async () => {
    let ctxSnapshot: {
      confirmations: ConfirmationItem[];
      dispatches: DispatchRecord[];
      tasks: Task[];
      pendingConfirmations: number;
      confirmItem: (id: string) => void;
      deferItem: (id: string) => void;
    } | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    const target = ctxSnapshot!.confirmations.find(item => (item.status ?? 'pending') === 'pending');
    expect(target).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      ctxSnapshot!.deferItem(target!.id);
      await Promise.resolve();
    });

    const updatedConfirmation = ctxSnapshot!.confirmations.find(item => item.id === target!.id);
    expect(updatedConfirmation?.status).toBe('deferred');
    expect(updatedConfirmation?.resolutionNote).toContain('已延后');
    expect(updatedConfirmation?.followUpTaskId).toBe(`confirm-${target!.id}`);
    expect(updatedConfirmation?.followUpDispatchId).toBeTruthy();
    expect(typeof updatedConfirmation?.resolvedAt).toBe('number');

    const linkedTask = ctxSnapshot!.tasks.find(task => task.id === `confirm-${target!.id}`);
    expect(linkedTask).toBeTruthy();
    expect(linkedTask?.state).toBe('blocked');
    expect(linkedTask?.sourceType).toBe('confirmation');

    const linkedDispatch = ctxSnapshot!.dispatches.find(dispatch => dispatch.taskId === `confirm-${target!.id}`);
    expect(linkedDispatch).toBeTruthy();
    expect(linkedDispatch?.status).toBe('submitted');
    expect(linkedDispatch?.source).toBe('confirmation');
  });

  test('reopenItem moves a deferred confirmation back to pending with a fresh dispatch', async () => {
    let ctxSnapshot: CapturedContextSnapshot | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    const target = ctxSnapshot!.confirmations.find(item => (item.status ?? 'pending') === 'pending');
    expect(target).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      ctxSnapshot!.deferItem(target!.id);
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      ctxSnapshot!.reopenItem(target!.id);
      await Promise.resolve();
    });

    const reopened = ctxSnapshot!.confirmations.find(item => item.id === target!.id);
    expect(reopened?.status).toBe('pending');
    expect(reopened?.resolutionNote).toContain('已重新打开确认');
    expect(typeof reopened?.reopenedAt).toBe('number');
    expect(reopened?.reopenCount).toBe(1);
    expect(reopened?.followUpDispatchId).toBeTruthy();

    const linkedTask = ctxSnapshot!.tasks.find(task => task.id === `confirm-${target!.id}`);
    expect(linkedTask?.state).toBe('blocked');
    expect(linkedTask?.next).toContain('请重新确认');

    const linkedDispatch = ctxSnapshot!.dispatches.find(dispatch => dispatch.userText === `重新打开确认：${target!.title}`);
    expect(linkedDispatch).toBeTruthy();
    expect(linkedDispatch?.status).toBe('submitted');
    expect(linkedDispatch?.source).toBe('confirmation');
  });

  test('registerDispatch turns reply confirmation signals into confirmation and blocked task', async () => {
    let ctxSnapshot: {
      confirmations: ConfirmationItem[];
      dispatches: DispatchRecord[];
      tasks: Task[];
      pendingConfirmations: number;
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
      }) => void;
    } | null = null;

    function DispatchCaptureCtx() {
      const ctx = useAppContext();
      ctxSnapshot = {
        confirmations: ctx.confirmations,
        dispatches: ctx.dispatches,
        tasks: ctx.tasks,
        pendingConfirmations: ctx.pendingConfirmations,
        confirmItem: ctx.confirmItem,
        deferItem: ctx.deferItem,
        reopenItem: ctx.reopenItem,
        registerDispatch: ctx.registerDispatch,
      };
      return <Text>ok</Text>;
    }

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <DispatchCaptureCtx />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      ctxSnapshot!.registerDispatch({
        userText: '帮我推进 TestFlight 准备',
        reply: '已拆解。\n需确认：是否立即触发 TestFlight 预检链路\n- 请确认是否使用当前构建号',
        taskId: 'chat-task-1',
        dispatchId: 'chat-dispatch-1',
        sessionKey: 'session-1',
        sent: true,
        source: 'chat',
      });
      await Promise.resolve();
    });

    const generated = ctxSnapshot!.confirmations.find(item => item.title === '是否立即触发 TestFlight 预检链路');
    expect(generated).toBeTruthy();
    expect(generated?.status).toBe('pending');
    expect(generated?.followUpDispatchId).toBe('chat-dispatch-1');
    expect(generated?.followUpTaskId).toBe(`${generated!.id}-task`);

    const linkedTask = ctxSnapshot!.tasks.find(task => task.id === generated!.followUpTaskId);
    expect(linkedTask).toBeTruthy();
    expect(linkedTask?.state).toBe('blocked');
    expect(linkedTask?.sourceType).toBe('confirmation');
    expect(linkedTask?.next).toContain('请先确认');

    const linkedDispatch = ctxSnapshot!.dispatches.find(dispatch => dispatch.dispatchId === 'chat-dispatch-1');
    expect(linkedDispatch).toBeTruthy();
    expect(linkedDispatch?.taskId).toBe('chat-task-1');
    expect(ctxSnapshot!.pendingConfirmations).toBe(
      ctxSnapshot!.confirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred').length,
    );
  });

  test('registerDispatch auto-generates confirmation items and blocked follow-up tasks from reply text', async () => {
    let ctxSnapshot: CapturedContextSnapshot | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    const baselinePending = ctxSnapshot!.pendingConfirmations;

    await ReactTestRenderer.act(async () => {
      ctxSnapshot!.registerDispatch({
        userText: '请分析附件并推进',
        reply: '已完成初步分析。需确认：是否按 P1 方案推进上线。\n请确认：是否立即通知黑金开始执行。',
        taskId: 'dispatch-task-1',
        dispatchId: 'dispatch-1',
        sessionKey: 'session:zhuli:test',
        sent: true,
        source: 'chat',
      });
      await Promise.resolve();
    });

    const autoConfirmation = ctxSnapshot!.confirmations.find(item => item.id === 'dispatch-1-confirm-1');
    expect(autoConfirmation).toBeTruthy();
    expect(autoConfirmation?.title).toContain('是否按 P1 方案推进上线');
    expect(autoConfirmation?.status).toBe('pending');
    expect(autoConfirmation?.followUpDispatchId).toBe('dispatch-1');
    expect(autoConfirmation?.followUpTaskId).toBe('dispatch-1-confirm-1-task');

    const autoTask = ctxSnapshot!.tasks.find(task => task.id === 'dispatch-1-confirm-1-task');
    expect(autoTask).toBeTruthy();
    expect(autoTask?.state).toBe('blocked');
    expect(autoTask?.sourceType).toBe('confirmation');
    expect(autoTask?.next).toContain('请先确认');

    expect(ctxSnapshot!.pendingConfirmations).toBeGreaterThan(baselinePending);
  });

  test('registerKnowledgeCapture and registerMemoryCapture create traceable task and dispatch records', async () => {
    let ctxSnapshot: CapturedContextSnapshot | null = null;

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={(ctx) => { ctxSnapshot = ctx; }} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      ctxSnapshot!.registerKnowledgeCapture({
        title: '钨矿选矿规则',
        summary: 'XRT 预选进入知识沉淀',
        category: 'rule',
        source: '知识库测试',
        savedRemotely: true,
      });
      ctxSnapshot!.registerMemoryCapture({
        content: '用户要求首页重点展示 AI 产出流、调度状态、需确认项',
        category: 'decision',
        savedRemotely: false,
        mode: 'created',
      });
      await Promise.resolve();
    });

    const knowledgeDispatch = ctxSnapshot!.dispatches.find(item => item.source === 'knowledge' && item.userText.includes('钨矿选矿规则'));
    expect(knowledgeDispatch).toBeTruthy();
    expect(knowledgeDispatch?.status).toBe('completed');
    expect(knowledgeDispatch?.label).toBe('知识已收录');
    expect(knowledgeDispatch?.sessionKey).toBe(knowledgeDispatch?.dispatchId);

    const knowledgeTask = ctxSnapshot!.tasks.find(item => item.id === knowledgeDispatch?.taskId);
    expect(knowledgeTask).toBeTruthy();
    expect(knowledgeTask?.sourceType).toBe('knowledge');
    expect(knowledgeTask?.state).toBe('done');
    expect(knowledgeTask?.traceSummary).toContain('知识库测试');

    const memoryDispatch = ctxSnapshot!.dispatches.find(item => item.source === 'memory' && item.userText.includes('记忆写入'));
    expect(memoryDispatch).toBeTruthy();
    expect(memoryDispatch?.status).toBe('processing');
    expect(memoryDispatch?.label).toBe('记忆写入待补写');
    expect(memoryDispatch?.stageText).toContain('等待远程补写');

    const memoryTask = ctxSnapshot!.tasks.find(item => item.id === memoryDispatch?.taskId);
    expect(memoryTask).toBeTruthy();
    expect(memoryTask?.sourceType).toBe('memory');
    expect(memoryTask?.state).toBe('running');
    expect(memoryTask?.traceSummary).toContain('等待远程补写');
  });

  test('refreshes gateway and release status when app becomes active again', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AppProvider>
          <CaptureCtx onCtx={() => {}} />
        </AppProvider>,
      );
      await Promise.resolve();
    });

    const {getAppleReleaseStatus} = require('../src/services/releaseChannel');
    const baselineCalls = getAppleReleaseStatus.mock.calls.length;
    expect(appStateListeners.length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      appStateListeners.forEach(listener => listener('background'));
      await Promise.resolve();
    });
    expect(getAppleReleaseStatus.mock.calls.length).toBe(baselineCalls);

    await ReactTestRenderer.act(async () => {
      appStateListeners.forEach(listener => listener('active'));
      await Promise.resolve();
    });
    expect(getAppleReleaseStatus.mock.calls.length).toBeGreaterThan(baselineCalls);


    await ReactTestRenderer.act(async () => {
      renderer!.unmount();
      await Promise.resolve();
    });
  });
});
