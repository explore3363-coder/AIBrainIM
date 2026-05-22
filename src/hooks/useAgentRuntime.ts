import {useMemo} from 'react';
import {useAppContext} from '../context/AppContext';
import type {Agent, AgentRuntime} from '../types';

/**
 * Get the runtime stats for a specific agent.
 * Returns null if the agent has no runtime record.
 */
export function useAgentRuntime(agentId: string): AgentRuntime | null {
  const {agentRuntimes} = useAppContext();
  return agentRuntimes[agentId] ?? null;
}

/**
 * Get all agent runtime records keyed by agentId.
 */
export function useAgentRuntimes(): Record<string, AgentRuntime> {
  const {agentRuntimes} = useAppContext();
  return agentRuntimes;
}

/**
 * Get the list of active (non-idle, non-error) agents.
 * Filters out agents that are truly offline or in error state.
 */
export function useActiveAgents(): Agent[] {
  const {agents} = useAppContext();
  return useMemo(
    () => agents.filter(a => a.status === 'online' || a.status === 'working' || a.status === 'watching'),
    [agents],
  );
}
