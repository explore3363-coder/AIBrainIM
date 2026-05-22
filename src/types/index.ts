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
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  agentId?: string;
  sessionKey?: string;
  updatedAt?: number;
  sourceType?: 'subagent' | 'cron' | 'chat' | 'upload' | 'knowledge' | 'memory' | 'confirmation' | 'system' | 'fallback';
  traceSummary?: string;
  attachmentCount?: number;
  // Extended fields for complex task flows
  parentTaskId?: string;
  subTasks?: string[];
  dependencies?: string[];
  dispatchId?: string;
  progress?: number; // 0-100
  completedAt?: number;
  error?: string;
  retryable?: boolean;
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
  // Extended fields for complex dispatch flows
  timeline?: DispatchTimelineEntry[];
  subTasks?: Task[];
  involvedAgents?: {agentId: string; status: string}[];
}

export interface DispatchTimelineEntry {
  stage: string;
  timestamp: number;
  detail?: string;
}

export interface AgentRuntime {
  agentId: string;
  sessionKey?: string;
  currentTaskId?: string;
  startTime?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  errorRate?: number; // 0-100
  avgLatencyMs?: number;
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
  type: 'output' | 'dispatch' | 'confirmation' | 'system' | 'upload' | 'knowledge' | 'memory';
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
  resolvedAt?: number;
  followUpTaskId?: string;
  followUpDispatchId?: string;
  reopenedAt?: number;
  reopenCount?: number;
}

export interface ProfileStats {
  totalTasks: number;
  completedTasks: number;
  activeAgents: number;
  memoryEntries: number;
  knowledgeDocs: number;
}

export interface CaptureEntry {
  id: string;
  type: 'knowledge' | 'memory';
  title: string;
  summary: string;
  category: string;
  savedRemotely: boolean;
  timestamp: number;
}

// ─── Chat / AI↔AI Message Types ───────────────────────────────────────────────

export type MessageRole = 'user' | 'agent' | 'system' | 'ai-dispatch';
export type MessageType = 'text' | 'task-decompose' | 'subtask-create' | 'subtask-complete' | 'error' | 'info';

export interface SubTask {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface Message {
  id: string;
  type: MessageType;
  role: MessageRole;
  agentId?: string;
  agentName?: string;
  content: string;
  timestamp: number;
  taskId?: string;
  dispatchId?: string;
  subTasks?: SubTask[];
  status?: 'pending' | 'success' | 'error';
  // Legacy compatibility — old 'in'/'out' messages
  roleLegacy?: 'in' | 'out';
  textLegacy?: string;
}

// ─── Smart Mine / 智慧矿山 ───────────────────────────────────────────────────
export type {ProductionData, Equipment, Alert, Camera, SafetyKPI, OreBodySensor, OreBodyZone, OreBodySensorsData} from './smartmine';
