// ─── Shared TypeScript Types ─────────────────────────────────────────────────

export type AgentStatus = 'online' | 'working' | 'idle' | 'watching';
export type TaskState    = 'running' | 'todo' | 'done' | 'blocked';
export type CommandStage = 'receive' | 'dispatch' | 'feedback' | 'synthesis' | 'deliver';
export type BrainStoreType = 'memory' | 'knowledge' | 'project' | 'file' | 'upload';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  focus: string;
  accent: string;
  current: string;
  sessionKey?: string;
  runtimeMs?: number;
  lastActiveAt?: number;
  sourceMode?: 'live' | 'fallback';
}

export interface Task {
  id: string;
  title: string;
  owner: string;
  state: TaskState;
  eta: string;
  next: string;
  priority?: 'P0' | 'P1' | 'P2';
  agentId?: string;
  sessionKey?: string;
  updatedAt?: number;
  sourceType?: 'subagent' | 'cron' | 'chat' | 'upload' | 'knowledge' | 'memory' | 'confirmation' | 'system' | 'fallback';
  traceSummary?: string;
}

export interface BrainStore {
  id: BrainStoreType;
  title: string;
  value: string;
  status: 'active' | 'pending' | 'standby';
  detail: string;
  accent: string;
  // Navigation entry
  screen?: string;
}

export interface CommandTrace {
  stage: CommandStage;
  title: string;
  actor: string;
  detail: string;
}

export interface DispatchRecord {
  id: string;
  userText: string;
  reply: string;
  taskId?: string;
  dispatchId?: string;
  sessionKey?: string;
  createdAt: number;
  updatedAt?: number;
  status: 'submitted' | 'dispatched' | 'processing' | 'completed' | 'failed';
  source?: 'chat' | 'upload' | 'knowledge' | 'memory' | 'confirmation' | 'system' | 'cron' | 'subagent' | 'fallback';
  agentId?: string;
  label?: string;
  stageText?: string;
  error?: string;
}

export type RuntimeMode = 'live' | 'fallback';

export interface RuntimeSnapshot {
  agents: Agent[];
  tasks: Task[];
  dispatches: DispatchRecord[];
  runtimeMode: RuntimeMode;
  runtimeError?: string;
  lastSyncedAt: number;
  sessionCount: number;
}

export interface GatewaySessionSummary {
  key?: string;
  label?: string;
  status?: string;
  runtimeMs?: number;
  startedAt?: number;
  updatedAt?: number;
}

export interface GatewayMessageResult {
  messageId?: string;
  chatId?: string;
  threadId?: string;
  sessionKey?: string;
  runId?: string;
  status?: string;
  reply?: string;
  error?: string;
}

export interface AIFeedItem {
  id: string;
  agent: string;
  agentAccent: string;
  text: string;
  timestamp: string;
  type: 'output' | 'dispatch' | 'confirmation' | 'system';
}

export interface DispatchStatus {
  stage: CommandStage;
  progress: number; // 0-100
  active: boolean;
}

export interface ConfirmationItem {
  id: string;
  title: string;
  description: string;
  agent: string;
  urgency: 'high' | 'normal' | 'low';
  timestamp: string;
  status?: 'pending' | 'confirmed' | 'deferred';
  resolutionNote?: string;
}

export interface ProfileStats {
  totalTasks: number;
  completedTasks: number;
  activeAgents: number;
  memoryEntries: number;
  knowledgeDocs: number;
}
