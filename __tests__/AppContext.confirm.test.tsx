/**
 * AppContext — lightweight smoke tests only.
 * Full integration tests are in api.test.ts and uploadService.test.ts.
 * The AppContext component is complex (timers, nested effects); these tests
 * verify it renders and has the expected initial state shape.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
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
  }) => void,
}) {
  const ctx = useAppContext();
  onCtx({
    confirmations: ctx.confirmations,
    dispatches: ctx.dispatches,
    tasks: ctx.tasks,
    pendingConfirmations: ctx.pendingConfirmations,
  });
  return <Text>ok</Text>;
}

describe('AppProvider', () => {
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
    renderer!.unmount();
  });

  test('initial state has mock confirmations', async () => {
    let ctxSnapshot: {
      confirmations: ConfirmationItem[];
      pendingConfirmations: number;
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
    let ctxSnapshot: {pendingConfirmations: number; confirmations: ConfirmationItem[]} | null = null;

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
    let ctxSnapshot: {dispatches: DispatchRecord[]; tasks: Task[]} | null = null;

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
});
