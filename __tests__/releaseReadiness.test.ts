import {computeReleaseReadiness} from '../src/utils/releaseReadiness';
import type {DispatchRecord, Task} from '../src/types';

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: '默认任务',
    owner: '助理',
    state: 'done',
    eta: '已完成',
    next: '无',
    sourceType: 'chat',
    ...overrides,
  };
}

function buildDispatch(overrides: Partial<DispatchRecord> = {}): DispatchRecord {
  return {
    id: 'dispatch-1',
    userText: '继续推进 P1',
    reply: '已完成收口',
    createdAt: Date.now(),
    status: 'completed',
    ...overrides,
  };
}

describe('computeReleaseReadiness', () => {
  it('keeps Apple prerequisites as a blocker until they are explicitly ready', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [buildTask({state: 'done'})],
      dispatches: [buildDispatch({status: 'completed'})],
      activeUploads: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.join(' ')).toContain('Apple Developer');
    expect(result.checklist.find(item => item.text.includes('Apple Developer / App Store Connect / API Key'))?.done).toBe(false);
  });

  it('returns 可提测 only when runtime and Apple prerequisites are both ready', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [buildTask({state: 'done'})],
      dispatches: [buildDispatch({status: 'completed'})],
      activeUploads: 0,
      applePrerequisitesReady: true,
    });

    expect(result.readiness).toBe('可提测');
    expect(result.blockers).toHaveLength(0);
    expect(result.nextActions[0]).toContain('TestFlight');
    expect(result.checklist.find(item => item.text.includes('LIVE 网关闭环验证'))?.done).toBe(true);
    expect(result.checklist.find(item => item.text.includes('需确认项清零'))?.done).toBe(true);
    expect(result.checklist.find(item => item.text.includes('阻塞任务收口'))?.done).toBe(true);
    expect(result.checklist.find(item => item.text.includes('Apple Developer / App Store Connect / API Key'))?.done).toBe(true);
  });

  it('returns 待收口 when only a small number of blockers remain', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'fallback',
      pendingConfirmations: 1,
      tasks: [buildTask({state: 'done'})],
      dispatches: [buildDispatch({status: 'completed'})],
      activeUploads: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers).toHaveLength(3);
    expect(result.blockers.join(' ')).toContain('LIVE 闭环');
    expect(result.blockers.join(' ')).toContain('需确认项');
    expect(result.blockers.join(' ')).toContain('Apple Developer');
  });

  it('returns 未就绪 when blockers stack up', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'fallback',
      pendingConfirmations: 2,
      tasks: [
        buildTask({id: 'task-blocked', state: 'blocked'}),
        buildTask({id: 'task-running', state: 'running'}),
      ],
      dispatches: [buildDispatch({status: 'processing'})],
      activeUploads: 2,
    });

    expect(result.readiness).toBe('未就绪');
    expect(result.blockers).toHaveLength(4);
    expect(result.nextActions.join(' ')).toContain('上传管理页');
    expect(result.nextActions.join(' ')).toContain('调度链');
    expect(result.nextActions.join(' ')).toContain('validate:testflight');
    expect(result.checklist.find(item => item.text.includes('LIVE 网关闭环验证'))?.done).toBe(false);
    expect(result.checklist.find(item => item.text.includes('需确认项清零'))?.done).toBe(false);
    expect(result.checklist.find(item => item.text.includes('阻塞任务收口'))?.done).toBe(false);
  });
});
