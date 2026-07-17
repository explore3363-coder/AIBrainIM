/**
 * @format
 * Tests for api.ts dispatch/mapping layer — real closed loop verification.
 * Only tests exported functions.
 */

import {
  buildDispatchRecordUpdate,
  sendMessage,
  fetchRuntimeSnapshot,
  pollForActivity,
} from '../src/data/api';

jest.mock('@react-native-async-storage/async-storage');

describe('api dispatch layer', () => {
  describe('buildDispatchRecordUpdate', () => {
    it('maps done status to completed', () => {
      const result = buildDispatchRecordUpdate({
        status: 'done',
        label: '附件分析',
        agentId: 'heijin',
        sessionKey: 'agent:heijin:feishu:direct:123',
        runtimeMs: 8000,
        updatedAt: Date.now(),
      });
      expect(result.status).toBe('completed');
      expect(result.stageText).toBe('heijin · 附件分析 · 8s');
      expect(result.agentId).toBe('heijin');
    });

    it('maps running status to dispatched', () => {
      const result = buildDispatchRecordUpdate({
        status: 'running',
        label: '知识写入',
        agentId: 'zhilian',
        runtimeMs: 3000,
        updatedAt: Date.now(),
      });
      expect(result.status).toBe('dispatched');
      expect(result.stageText).toBe('zhilian · 知识写入 · 3s');
    });

    it('handles no label gracefully — shows agent only', () => {
      const result = buildDispatchRecordUpdate({
        status: 'running',
        agentId: 'kaifa',
        runtimeMs: 0,
        updatedAt: Date.now(),
      });
      expect(result.status).toBe('dispatched');
      expect(result.stageText).toBe('kaifa');
    });

    it('handles empty activity object gracefully', () => {
      const result = buildDispatchRecordUpdate({});
      expect(result.status).toBe('dispatched');
      expect(result.updatedAt).toBeDefined();
    });

    it('uses provided updatedAt', () => {
      const ts = Date.now() - 5000;
      const result = buildDispatchRecordUpdate({status: 'done', updatedAt: ts});
      expect(result.updatedAt).toBe(ts);
    });

    it('sets sessionKey when provided', () => {
      const result = buildDispatchRecordUpdate({
        status: 'running',
        agentId: 'zhuli',
        sessionKey: 'agent:zhuli:feishu:direct:ou_123',
      });
      expect(result.sessionKey).toBe('agent:zhuli:feishu:direct:ou_123');
    });
  });

  describe('sendMessage — fallback path', () => {
    it('returns a result with reply, sent, taskId, dispatchId', async () => {
      const result = await sendMessage('测试消息');
      expect(typeof result.reply).toBe('string');
      expect(typeof result.sent).toBe('boolean');
      expect(typeof result.taskId).toBe('string');
      expect(typeof result.dispatchId).toBe('string');
    });

    it('returns taskId and dispatchId that are unique per call', async () => {
      const [r1, r2] = await Promise.all([sendMessage('msg1'), sendMessage('msg2')]);
      expect(r1.taskId).not.toBe(r2.taskId);
      expect(r1.dispatchId).not.toBe(r2.dispatchId);
    });

    it('reply is non-empty string', async () => {
      const result = await sendMessage('ping');
      expect(result.reply.length).toBeGreaterThan(0);
    });

    it('reply is either success (✓/已/收到) or error (⚠/失败) style', async () => {
      const result = await sendMessage('test');
      const isOk = result.reply.includes('✓') || result.reply.includes('已') || result.reply.includes('收到') || result.reply.includes('送达');
      const isWarn = result.reply.includes('⚠') || result.reply.includes('失败');
      expect(isOk || isWarn).toBe(true);
    });
  });

  describe('fetchRuntimeSnapshot — fallback mode', () => {
    it('returns a valid snapshot object', async () => {
      const snapshot = await fetchRuntimeSnapshot();
      expect(snapshot).toBeDefined();
      expect(typeof snapshot.runtimeMode).toBe('string');
      expect(['live', 'fallback']).toContain(snapshot.runtimeMode);
    });

    it('returns arrays for agents, tasks, dispatches', async () => {
      const snapshot = await fetchRuntimeSnapshot();
      expect(Array.isArray(snapshot.agents)).toBe(true);
      expect(Array.isArray(snapshot.tasks)).toBe(true);
      expect(Array.isArray(snapshot.dispatches)).toBe(true);
    });

    it('agents have required fields', async () => {
      const snapshot = await fetchRuntimeSnapshot();
      const agent = snapshot.agents[0];
      expect(typeof agent.id).toBe('string');
      expect(typeof agent.name).toBe('string');
      expect(typeof agent.status).toBe('string');
      expect(typeof agent.accent).toBe('string');
    });

    it('tasks have required fields', async () => {
      const snapshot = await fetchRuntimeSnapshot();
      const task = snapshot.tasks[0];
      expect(typeof task.id).toBe('string');
      expect(typeof task.title).toBe('string');
      expect(typeof task.state).toBe('string');
    });

    it('has sessionCount and lastSyncedAt', async () => {
      const snapshot = await fetchRuntimeSnapshot();
      expect(typeof snapshot.sessionCount).toBe('number');
      expect(typeof snapshot.lastSyncedAt).toBe('number');
    });
  });

  describe('pollForActivity', () => {
    it('returns inactive when no recent activity', async () => {
      // Activity poll with a stale timestamp should return inactive
      const stale = Date.now() - 60 * 60 * 1000;
      const result = await pollForActivity(stale);
      expect(result.active).toBe(false);
    });

    it('returns shape with active boolean field', async () => {
      const result = await pollForActivity(Date.now());
      expect(typeof result.active).toBe('boolean');
    });
  });
});
