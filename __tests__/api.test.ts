/**
 * @format
 */

import {fetchRuntimeSnapshot, buildDispatchRecordUpdate} from '../src/data/api';

jest.mock('@react-native-async-storage/async-storage');

describe('api', () => {
  describe('buildDispatchRecordUpdate', () => {
    it('returns completed status when activity status is done', () => {
      const result = buildDispatchRecordUpdate({
        status: 'done',
        label: 'test task',
        agentId: 'zhuli',
        sessionKey: 'agent:zhuli:feishu:123',
        runtimeMs: 5000,
        updatedAt: Date.now(),
      });
      expect(result.status).toBe('completed');
      expect(result.label).toBe('test task');
      expect(result.agentId).toBe('zhuli');
      expect(result.stageText).toBe('zhuli · test task · 5s');
    });

    it('returns dispatched status when activity status is running', () => {
      const result = buildDispatchRecordUpdate({
        status: 'running',
        agentId: 'kaifa',
        runtimeMs: 0,
        updatedAt: Date.now(),
      });
      expect(result.status).toBe('dispatched');
      expect(result.stageText).toBe('kaifa');
    });

    it('handles missing activity fields gracefully', () => {
      const result = buildDispatchRecordUpdate({});
      expect(result.status).toBe('dispatched');
      expect(result.label).toBeUndefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('fetchRuntimeSnapshot', () => {
    it('returns fallback data when gateway is unreachable', async () => {
      const snapshot = await fetchRuntimeSnapshot();
      // With no real gateway, should return fallback agents + tasks
      expect(snapshot.runtimeMode).toBeTruthy();
      expect(Array.isArray(snapshot.agents)).toBe(true);
      expect(Array.isArray(snapshot.tasks)).toBe(true);
    });
  });
});
