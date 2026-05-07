/**
 * AppContext — lightweight smoke tests only.
 * Full integration tests are in api.test.ts and uploadService.test.ts.
 * The AppContext component is complex (timers, nested effects); these tests
 * verify it renders and has the expected initial state shape.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppProvider, useAppContext} from '../src/context/AppContext';
import type {ConfirmationItem, DispatchRecord, Task} from '../src/types';

function CaptureCtx({
  onCtx,
}: {
  onCtx: (ctx: {
    confirmations: ConfirmationItem[];
    dispatches: DispatchRecord[];
    tasks: Task[];
    pendingConfirmations: number;
    confirmItem: (id: string) => void;
    deferItem: (id: string) => void;
  }) => void,
}) {
  const ctx = useAppContext();
  onCtx({
    confirmations: ctx.confirmations,
    dispatches: ctx.dispatches,
    tasks: ctx.tasks,
    pendingConfirmations: ctx.pendingConfirmations,
    confirmItem: ctx.confirmItem,
    deferItem: ctx.deferItem,
  });
  return <Text>ok</Text>;
}

describe('AppProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
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
    await AsyncStorage.setItem('@AIBrainIM:appContext', JSON.stringify({
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
    }));

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
      await Promise.resolve();
    });

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

    const linkedTask = ctxSnapshot!.tasks.find(task => task.id === `confirm-${target!.id}`);
    expect(linkedTask).toBeTruthy();
    expect(linkedTask?.state).toBe('blocked');
    expect(linkedTask?.sourceType).toBe('confirmation');

    const linkedDispatch = ctxSnapshot!.dispatches.find(dispatch => dispatch.taskId === `confirm-${target!.id}`);
    expect(linkedDispatch).toBeTruthy();
    expect(linkedDispatch?.status).toBe('submitted');
    expect(linkedDispatch?.source).toBe('confirmation');
  });
});
