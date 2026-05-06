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
}

export interface Task {
  id: string;
  title: string;
  owner: string;
  state: TaskState;
  eta: string;
  next: string;
  priority?: 'P0' | 'P1' | 'P2';
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
  status: 'submitted' | 'dispatched' | 'processing' | 'completed' | 'failed';
}

export type RuntimeMode = 'live' | 'fallback';

export interface RuntimeSnapshot {
  agents: Agent[];
  tasks: Task[];
  runtimeMode: RuntimeMode;
  runtimeError?: string;
  lastSyncedAt: number;
  sessionCount: number;
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
