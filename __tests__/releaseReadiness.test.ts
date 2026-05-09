import {computeReleaseReadiness, prioritizeReleaseChecklist} from '../src/utils/releaseReadiness';

describe('releaseReadiness', () => {
  it('marks release as not ready when runtime is fallback and Apple prerequisites are missing', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'fallback',
      pendingConfirmations: 2,
      tasks: [
        {
          id: 'task-1',
          title: '等待人工确认',
          owner: '助理',
          state: 'blocked',
          eta: '待确认',
          next: '等待拍板',
          priority: 'P1',
          sourceType: 'confirmation',
        },
      ],
      dispatches: [],
      activeUploads: 0,
      applePrerequisitesReady: false,
    });

    expect(result.readiness).toBe('未就绪');
    expect(result.blockers.some(item => item.includes('LIVE 闭环'))).toBe(true);
    expect(result.blockers.some(item => item.includes('Apple Developer / App Store Connect / GitHub Variables & Secrets'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('LIVE 网关闭环验证'))?.done).toBe(false);
    expect(result.checklist.find(item => item.text.includes('Apple Developer / App Store Connect / API Key / GitHub CI 变量'))?.done).toBe(false);
  });

  it('marks release as ready only when runtime and Apple prerequisites are both ready', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [
        {
          id: 'task-1',
          title: '闭环验证完成',
          owner: '黑金',
          state: 'done',
          eta: '0m',
          next: '触发 TestFlight',
          priority: 'P0',
          sourceType: 'chat',
        },
      ],
      dispatches: [
        {
          id: 'dispatch-1',
          userText: '触发 TestFlight',
          reply: 'Apple 侧配置已齐。',
          status: 'completed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'chat',
        },
      ],
      activeUploads: 0,
      applePrerequisitesReady: true,
    });

    expect(result.readiness).toBe('可提测');
    expect(result.blockers).toHaveLength(0);
    expect(result.nextActions[0]).toContain('可触发 v0.1.0 TestFlight 构建');
    expect(result.appleMaterials.every(item => item.done)).toBe(true);
  });

  it('prioritizes pending checklist items ahead of completed ones', () => {
    const prioritized = prioritizeReleaseChecklist([
      {done: true, text: '已完成 A'},
      {done: false, text: '待完成 B'},
      {done: true, text: '已完成 C'},
      {done: false, text: '待完成 D'},
    ]);

    expect(prioritized.map(item => item.text)).toEqual([
      '待完成 B',
      '待完成 D',
      '已完成 A',
      '已完成 C',
    ]);
  });
});
