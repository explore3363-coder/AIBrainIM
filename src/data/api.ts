/**
 * OpenClaw Gateway API Service — V1
 * Gateway: http://127.0.0.1:18789
 * Auth: Bearer token from openclaw.json gateway.auth.token
 *
 * Endpoints used:
 *   POST /tools/invoke  — sessions_list, sessions_send, message (send fallback)
 *
 * Message flow:
 *   1. directMode=true  → sessions_send → OpenClaw session → reply
 *   2. directMode=false → message.send → Feishu fallback
 *   3. App 继续用 sessions_list 观察运行态与子链路活动
 */

import type {
  Agent,
  Task,
  ConfirmationItem,
  RuntimeSnapshot,
  GatewayMessageResult,
  GatewaySessionSummary,
  DispatchRecord,
} from '../types';
import type {AgentStatus, TaskState} from '../types';
import {
  getGatewayConfig,
  validateGatewayConfig,
  type GatewayConfig,
} from '../services/gatewayConfig';

// ─── Config ─────────────────────────────────────────────────────────────────
const TIMEOUT_MS    = 10000;


const _confirmationMock: ConfirmationItem[] = [
  {id:'c1', title:'是否接入 Brave 搜索？', description:'当前标记为研究辅助，不阻塞移动端主流程。可延后。', agent:'助理', urgency:'normal', timestamp:'20:28', status:'pending'},
  {id:'c2', title:'记忆库优先级确认', description:'长期记忆与短期记忆的存储策略需要确认。', agent:'智联', urgency:'high', timestamp:'20:20', status:'pending'},
  {id:'c3', title:'附件大小策略', description:'前端不设硬限制，请确认后端处理策略（分片/转码）。', agent:'黑金', urgency:'low', timestamp:'20:15', status:'pending'},
];

let _confirmations: ConfirmationItem[] = [..._confirmationMock];

// ─── Internal Helpers ────────────────────────────────────────────────────────
interface GatewayResponse {
  ok: boolean;
  result?: Record<string, unknown>;
  error?: {type: string; message: string};
}

export async function gatewayInvoke(
  tool: string,
  action: string,
  args: Record<string, unknown> = {},
  overrideConfig?: GatewayConfig,
): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const config = overrideConfig ?? await getGatewayConfig();
  const validation = validateGatewayConfig(config);
  if (!validation.valid) {
    throw new Error(`Gateway 配置未完成：${validation.errors.join('；')}`);
  }
  try {
    const res = await fetch(`${config.gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.gatewayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({tool, action, args}),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const json: GatewayResponse = await res.json();
    if (!json.ok) throw new Error(json.error?.message || 'gateway error');
    return json.result;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/** sessions_list returns {result: {content: [{type:'text', text:'{"sessions":[...]}'}]}} */
function parseSessionsList(result: unknown): GatewaySessionSummary[] {
  try {
    const r = result as Record<string, unknown>;

    if (Array.isArray(r?.sessions)) {
      return r.sessions as GatewaySessionSummary[];
    }

    const content = (r?.content as Array<{type: string; text: string}>) ?? [];
    if (!content.length) return [];
    const inner = JSON.parse(content[0]?.text ?? '{}');
    return (inner?.sessions as GatewaySessionSummary[]) ?? [];
  } catch {
    return [];
  }
}

function extractMessageResult(result: unknown): GatewayMessageResult {
  const payload = (result ?? {}) as Record<string, unknown>;
  const nested = (payload.result ?? {}) as Record<string, unknown>;
  const candidate = Object.keys(nested).length > 0 ? nested : payload;

  const messageId = candidate.messageId
    ?? candidate.message_id
    ?? candidate.msgId
    ?? candidate.msg_id;
  const chatId = candidate.chatId ?? candidate.chat_id;
  const threadId = candidate.threadId ?? candidate.thread_id;
  const sessionKey = candidate.sessionKey ?? candidate.session_key;
  const runId = candidate.runId ?? candidate.run_id;
  const status = candidate.status;
  const reply = candidate.reply;
  const error = candidate.error;

  return {
    messageId: typeof messageId === 'string' ? messageId : undefined,
    chatId: typeof chatId === 'string' ? chatId : undefined,
    threadId: typeof threadId === 'string' ? threadId : undefined,
    sessionKey: typeof sessionKey === 'string' ? sessionKey : undefined,
    runId: typeof runId === 'string' ? runId : undefined,
    status: typeof status === 'string' ? status : undefined,
    reply: typeof reply === 'string' ? reply : undefined,
    error: typeof error === 'string' ? error : undefined,
  };
}

// ─── Agent / Task mappers ───────────────────────────────────────────────────
const AGENT_META: Record<string, {name: string; role: string; focus: string; accent: string}> = {
  zhuli:   {name:'助理',    role:'AI 总指挥',        focus:'接收指令、拆任务、调度、总结',    accent:'#22d3ee'},
  renzhi:  {name:'认知中枢', role:'后台认知层',        focus:'长上下文、冲突消歧、夜训门控',    accent:'#a78bfa'},
  xunlong: {name:'寻龙',    role:'矿业研究员',        focus:'钨价、政策、全球矿业信源',        accent:'#fbbf24'},
  wuyin:   {name:'无垠',    role:'矿山项目工程',       focus:'智慧矿山与三维数字孪生',         accent:'#34d399'},
  tansuo:  {name:'探索',    role:'采选矿专家',         focus:'XRT、磨浮、回收率、药剂',        accent:'#fb7185'},
  zhilian: {name:'智联',    role:'知识库管理员',        focus:'归档、记忆、NAS、资料治理',      accent:'#38bdf8'},
  heijin:  {name:'黑金',    role:'AI 项目工程师',       focus:'AI协作平台与 Agent Runtime',      accent:'#f97316'},
  kaifa:   {name:'开发',    role:'Codex 开发 Bot',     focus:'代码、构建、Bug 修复',           accent:'#4ade80'},
};

function inferAgentIdFromSessionKey(key: string): string {
  const parts = key.split(':');
  return parts[1] ?? parts[0] ?? 'zhuli';
}

function normalizeSessionLabel(label?: string): string {
  return (label ?? '')
    .replace(/^Cron:\s*/i, '')
    .replace(/^Session:\s*/i, '')
    .replace(/^Thread:\s*/i, '')
    .trim();
}

function inferTaskSourceType(
  key: string,
  label: string,
): Task['sourceType'] {
  const text = `${key} ${label}`.toLowerCase();
  if (text.includes(':cron:')) return 'cron';
  if (text.includes(':subagent:')) return 'subagent';
  if (text.includes('upload') || text.includes('附件') || text.includes('文件')) return 'upload';
  if (text.includes('memory') || text.includes('记忆')) return 'memory';
  if (text.includes('knowledge') || text.includes('wiki') || text.includes('知识')) return 'knowledge';
  if (text.includes('confirm') || text.includes('确认')) return 'confirmation';
  return 'chat';
}

function inferTaskPriority(label: string): Task['priority'] {
  if (/\bP0\b/i.test(label) || /高优|阻塞|紧急/.test(label)) return 'P0';
  if (/\bP1\b/i.test(label) || /本轮|当前|继续推进/.test(label)) return 'P1';
  return 'P2';
}

function inferTaskState(status: string, updatedAt: number): TaskState {
  const ageMs = Date.now() - updatedAt;
  if (status === 'running') return 'running';
  if (status === 'done') return 'done';
  if (status === 'failed' || status === 'error') return 'blocked';
  return ageMs < 2 * 60 * 60 * 1000 ? 'todo' : 'done';
}

function buildTaskOwner(agentId: string, sourceType: Task['sourceType']): string {
  const agentName = AGENT_META[agentId]?.name ?? agentId;
  if (sourceType === 'cron') return `${agentName} / 定时链路`;
  if (sourceType === 'subagent') return `${agentName} / 子链路`;
  if (sourceType === 'upload') return `${agentName} / 附件链路`;
  if (sourceType === 'knowledge') return `${agentName} / 知识链路`;
  if (sourceType === 'memory') return `${agentName} / 记忆链路`;
  if (sourceType === 'confirmation') return `${agentName} / 确认链路`;
  return `${agentName} / 对话链路`;
}

function buildTaskNext(state: TaskState, sourceType: Task['sourceType']): string {
  if (state === 'done') return '结果已回流到前台';
  if (state === 'blocked') return '存在错误或待确认节点，需要人工处理';
  if (state === 'running') {
    if (sourceType === 'upload') return '后台正在处理附件并等待结果回流';
    if (sourceType === 'knowledge') return '知识写入或文档链路正在推进';
    if (sourceType === 'memory') return '记忆写入与回读链路正在推进';
    return '执行中，等待状态继续回流';
  }
  return '等待进入下一步执行';
}

function buildTraceSummary(sourceType: Task['sourceType'], label: string): string {
  const safeLabel = label || '未命名任务';
  if (sourceType === 'cron') return `定时链路 · ${safeLabel}`;
  if (sourceType === 'subagent') return `子 Agent 链路 · ${safeLabel}`;
  if (sourceType === 'upload') return `附件链路 · ${safeLabel}`;
  if (sourceType === 'knowledge') return `知识链路 · ${safeLabel}`;
  if (sourceType === 'memory') return `记忆链路 · ${safeLabel}`;
  if (sourceType === 'confirmation') return `确认链路 · ${safeLabel}`;
  return `对话链路 · ${safeLabel}`;
}

function sessionsToAgents(sessions: GatewaySessionSummary[]): Agent[] {
  const map = new Map<string, {
    id: string; name: string; role: string; status: AgentStatus;
    focus: string; accent: string; current: string; updatedAt: number;
    sessionKey?: string; runtimeMs?: number; sourceMode: 'live';
  }>();

  for (const s of sessions) {
    const key      = (s.key as string) || '';
    const agentId  = inferAgentIdFromSessionKey(key);
    if (!AGENT_META[agentId]) continue;

    const status    = (s.status as string) || 'idle';
    const updatedAt = (s.updatedAt as number) || 0;
    const label     = normalizeSessionLabel((s.label as string) || '');
    const runtimeMs = (s.runtimeMs as number) || 0;
    const now       = Date.now();
    const isRecent  = (now - updatedAt) < 5 * 60 * 1000;

    let resolvedStatus: AgentStatus = 'idle';
    if (isRecent) {
      resolvedStatus = status === 'running' ? 'working'
                    : status === 'done'    ? 'online'
                    : status === 'watching'? 'watching'
                    : 'idle';
    }

    const current = label
      ? `[${label}]${runtimeMs > 0 ? ` · ${Math.round(runtimeMs/1000)}s前` : ' · 运行中'}`
      : AGENT_META[agentId].focus;

    const existing = map.get(agentId);
    if (!existing || updatedAt > existing.updatedAt) {
      map.set(agentId, {
        id: agentId, name: AGENT_META[agentId].name,
        role: AGENT_META[agentId].role, status: resolvedStatus,
        focus: AGENT_META[agentId].focus, accent: AGENT_META[agentId].accent,
        current, updatedAt, sessionKey: key, runtimeMs, sourceMode: 'live',
      });
    }
  }

  for (const [id, m] of Object.entries(AGENT_META)) {
    if (!map.has(id)) {
      map.set(id, {id, name: m.name, role: m.role, status: 'idle',
        focus: m.focus, accent: m.accent, current: '待命', updatedAt: 0, sourceMode: 'live'});
    }
  }

  return Array.from(map.values()).map(a => ({
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
    focus: a.focus,
    accent: a.accent,
    current: a.current,
    sessionKey: a.sessionKey,
    runtimeMs: a.runtimeMs,
    lastActiveAt: a.updatedAt,
    sourceMode: a.sourceMode,
  }));
}

function sessionsToTasks(sessions: GatewaySessionSummary[]): Task[] {
  const tasks: Task[] = [];
  const now = Date.now();
  const seen = new Set<string>();

  for (const s of sessions) {
    const key = (s.key as string) || '';
    const updatedAt = (s.updatedAt as number) || 0;
    const ageMs = now - updatedAt;
    if (ageMs > 48 * 60 * 60 * 1000) continue;

    const agentId = inferAgentIdFromSessionKey(key);
    if (!AGENT_META[agentId]) continue;

    const rawLabel = normalizeSessionLabel((s.label as string) || '');
    const status = (s.status as string) || 'done';
    const runtimeMs = (s.runtimeMs as number) || 0;
    const sourceType = inferTaskSourceType(key, rawLabel);
    const state = inferTaskState(status, updatedAt);

    const titleBase = rawLabel || `${AGENT_META[agentId].name} 当前链路`;
    const title = titleBase.length > 45 ? `${titleBase.slice(0, 45)}…` : titleBase;
    const dedupeKey = `${key}:${title}:${state}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    tasks.push({
      id: `task-${key.replace(/[^a-zA-Z0-9]+/g, '-').slice(-24)}-${updatedAt || now}`,
      title,
      owner: buildTaskOwner(agentId, sourceType),
      state,
      eta: runtimeMs > 0 ? `${Math.round(runtimeMs / 1000)}s` : (state === 'done' ? '已完成' : state === 'blocked' ? '待处理' : '待执行'),
      next: buildTaskNext(state, sourceType),
      priority: inferTaskPriority(rawLabel),
      agentId,
      sessionKey: key,
      updatedAt,
      sourceType,
      traceSummary: buildTraceSummary(sourceType, titleBase),
    });
  }

  return tasks
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 16);
}

function mapSessionStatusToDispatchStatus(status: string): DispatchRecord['status'] {
  if (status === 'running') return 'dispatched';
  if (status === 'done') return 'completed';
  if (status === 'failed' || status === 'error') return 'failed';
  return 'processing';
}

function buildDispatchReply(agentId: string, label: string, status: DispatchRecord['status'], runtimeMs: number, sessionKey: string): string {
  const agentName = AGENT_META[agentId]?.name ?? agentId;
  const runtimeText = runtimeMs > 0 ? ` · 已运行 ${Math.round(runtimeMs / 1000)}s` : '';
  const sessionText = sessionKey ? ` · ${sessionKey}` : '';

  if (status === 'completed') {
    return `✓ ${agentName}${label ? ` [${label}]` : ''} 已完成本轮执行${runtimeText}${sessionText}`;
  }
  if (status === 'failed') {
    return `⚠️ ${agentName}${label ? ` [${label}]` : ''} 执行异常${runtimeText}${sessionText}`;
  }
  if (status === 'dispatched') {
    return `🛰 ${agentName}${label ? ` [${label}]` : ''} 正在执行${runtimeText}${sessionText}`;
  }
  return `… ${agentName}${label ? ` [${label}]` : ''} 正在处理中${runtimeText}${sessionText}`;
}

function sessionsToDispatches(sessions: GatewaySessionSummary[]): DispatchRecord[] {
  const records: DispatchRecord[] = [];
  const now = Date.now();
  const seen = new Set<string>();

  for (const s of sessions) {
    const key = (s.key as string) || '';
    const updatedAt = (s.updatedAt as number) || 0;
    const ageMs = now - updatedAt;
    if (ageMs > 48 * 60 * 60 * 1000) continue;

    const agentId = inferAgentIdFromSessionKey(key);
    if (!AGENT_META[agentId]) continue;

    const label = normalizeSessionLabel((s.label as string) || '');
    const status = mapSessionStatusToDispatchStatus((s.status as string) || 'done');
    const runtimeMs = (s.runtimeMs as number) || 0;
    const source = inferTaskSourceType(key, label);
    const title = label || `${AGENT_META[agentId].name} 当前链路`;
    const recordId = `live-${key.replace(/[^a-zA-Z0-9]+/g, '-').slice(-32)}-${updatedAt || now}`;
    if (seen.has(recordId)) continue;
    seen.add(recordId);

    records.push({
      id: recordId,
      userText: title,
      reply: buildDispatchReply(agentId, label, status, runtimeMs, key),
      taskId: `task-${key.replace(/[^a-zA-Z0-9]+/g, '-').slice(-24)}-${updatedAt || now}`,
      dispatchId: `dispatch-${key.replace(/[^a-zA-Z0-9]+/g, '-').slice(-24)}-${updatedAt || now}`,
      sessionKey: key,
      createdAt: updatedAt || now,
      updatedAt: updatedAt || now,
      status,
      source: source === 'fallback' ? 'system' : source,
      agentId,
      label,
      stageText: label || AGENT_META[agentId].focus,
    });
  }

  return records
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, 20);
}

// ─── Fallback data ───────────────────────────────────────────────────────────
const FALLBACK_AGENTS: Agent[] = [
  {id:'zhuli',   name:'助理',    role:'AI 总指挥',        status:'online',  accent:'#22d3ee', focus:'接收指令、拆任务、调度、总结',      current:'接收移动端分派，等待下一条指令', sourceMode:'fallback'},
  {id:'renzhi',  name:'认知中枢', role:'后台认知层',        status:'watching',accent:'#a78bfa', focus:'长上下文、冲突消歧、夜训门控',      current:'后台认知链路监测中', sourceMode:'fallback'},
  {id:'xunlong', name:'寻龙',    role:'矿业研究员',        status:'idle',    accent:'#fbbf24', focus:'钨价、政策、全球矿业信源',          current:'待命', sourceMode:'fallback'},
  {id:'wuyin',   name:'无垠',    role:'矿山项目工程',       status:'working', accent:'#34d399', focus:'智慧矿山与三维数字孪生',           current:'处理工程分析任务', sourceMode:'fallback'},
  {id:'tansuo',  name:'探索',    role:'采选矿专家',         status:'online',  accent:'#fb7185', focus:'XRT、磨浮、回收率、药剂',           current:'待命', sourceMode:'fallback'},
  {id:'zhilian', name:'智联',    role:'知识库管理员',        status:'online',  accent:'#38bdf8', focus:'归档、记忆、NAS、资料治理',         current:'知识库与记忆库待命中', sourceMode:'fallback'},
  {id:'heijin',  name:'黑金',    role:'AI 项目工程师',      status:'working', accent:'#f97316', focus:'AI协作平台与 Agent Runtime',      current:'处理平台构建任务', sourceMode:'fallback'},
  {id:'kaifa',   name:'开发',    role:'Codex 开发 Bot',    status:'idle',    accent:'#4ade80', focus:'代码、构建、Bug 修复',             current:'待命', sourceMode:'fallback'},
];

// FALLBACK_TASKS shown only when Gateway is unreachable — user-appropriate messaging
const FALLBACK_TASKS: Task[] = [
  {id:'t1', title:'等待 OpenClaw Gateway 连接', owner:'助理 / Gateway', state:'running', eta:'网关恢复后自动重连', next:'Gateway 连通后，调度链、AI 产出流、附件链路将恢复正常', priority:'P0', sourceType:'fallback', traceSummary:'网关连通性'},
  {id:'t2', title:'附件上传入口已就绪', owner:'附件链路', state:'todo', eta:'随时可用', next:'本地文件在网关恢复后自动进入处理队列', priority:'P1', sourceType:'fallback', traceSummary:'附件链路就绪'},
  {id:'t3', title:'记忆库写入已就绪', owner:'记忆链路', state:'todo', eta:'随时可用', next:'新建记忆将在网关恢复后同步到远程记忆层', priority:'P1', sourceType:'fallback', traceSummary:'记忆链路就绪'},
  {id:'t4', title:'知识库收录已就绪', owner:'知识链路', state:'todo', eta:'随时可用', next:'知识收录将在网关恢复后写入飞书知识库', priority:'P1', sourceType:'fallback', traceSummary:'知识链路就绪'},
  {id:'t5', title:'需确认项可正常处理', owner:'确认链路', state:'todo', eta:'随时可用', next:'人工拍板的确认项将实时进入调度链推进', priority:'P1', sourceType:'fallback', traceSummary:'确认链路就绪'},
];

// ─── Public API ─────────────────────────────────────────────────────────────

export async function listGatewaySessions(overrideConfig?: GatewayConfig): Promise<GatewaySessionSummary[]> {
  const result = await gatewayInvoke('sessions_list', 'json', {}, overrideConfig);
  return parseSessionsList(result);
}

export async function fetchRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  try {
    const sessions = await listGatewaySessions();
    const agents = sessionsToAgents(sessions);
    const tasks = sessionsToTasks(sessions);

    const dispatches = sessionsToDispatches(sessions);

    return {
      agents: agents.length > 0 ? agents : FALLBACK_AGENTS,
      tasks: tasks.length > 0 ? tasks : FALLBACK_TASKS,
      dispatches,
      runtimeMode: 'live',
      runtimeError: undefined,
      lastSyncedAt: Date.now(),
      sessionCount: sessions.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[api] fetchRuntimeSnapshot failed, fallback:', e);
    return {
      agents: FALLBACK_AGENTS,
      tasks: FALLBACK_TASKS,
      dispatches: [],
      runtimeMode: 'fallback',
      runtimeError: message,
      lastSyncedAt: Date.now(),
      sessionCount: 0,
    };
  }
}

export async function fetchAgents(): Promise<Agent[]> {
  const snapshot = await fetchRuntimeSnapshot();
  return snapshot.agents;
}

export async function fetchTasks(): Promise<Task[]> {
  const snapshot = await fetchRuntimeSnapshot();
  return snapshot.tasks;
}

export async function fetchConfirmations(): Promise<ConfirmationItem[]> {
  return [..._confirmations];
}

export async function resolveConfirmation(
  id: string, status: 'confirmed' | 'deferred',
): Promise<void> {
  _confirmations = _confirmations.map(c =>
    c.id === id
      ? {...c, status, resolutionNote: status === 'confirmed' ? '已确认' : '已延后'}
      : c,
  );
}

export interface SendMessageResult {
  reply: string;
  sent: boolean;
  taskId?: string;
  dispatchId?: string;
  sessionKey?: string;
}

function buildLocalTaskId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function sendMessage(text: string): Promise<SendMessageResult> {
  try {
    const config = await getGatewayConfig();
    const taskId = buildLocalTaskId('task');
    const dispatchId = buildLocalTaskId('dispatch');

    if (config.directMode) {
      const result = await gatewayInvoke('sessions_send', 'json', {
        sessionKey: config.sessionKey,
        message: text,
        timeoutSeconds: 20,
      }, config);
      const directResult = extractMessageResult(result);
      const ok = directResult.status === 'ok' || Boolean(directResult.reply);
      if (!ok) {
        throw new Error(directResult.error || directResult.status || '直连会话调用失败');
      }
      return {
        sent: true,
        taskId,
        dispatchId: directResult.runId ?? dispatchId,
        sessionKey: directResult.sessionKey ?? config.sessionKey,
        reply: directResult.reply ?? '已收到回复。',
      };
    }

    const result = await gatewayInvoke('message', 'send', {
      channel: config.channel,
      target: config.target,
      message: text,
    }, config);
    const messageResult = extractMessageResult(result);
    const traceId = messageResult.messageId ?? messageResult.threadId ?? messageResult.chatId ?? 'ok';
    const shortId = traceId.length > 12 ? traceId.slice(0, 12) : traceId;
    return {
      sent: true,
      taskId,
      dispatchId,
      sessionKey: messageResult.sessionKey ?? messageResult.threadId ?? messageResult.chatId ?? messageResult.messageId,
      reply: `✓ 已通过 Feishu 回退链路送达（${shortId}）。`,
    };
  } catch (e) {
    console.warn('[api] sendMessage failed:', e);
    return {
      sent: false,
      taskId: buildLocalTaskId('failed-task'),
      dispatchId: buildLocalTaskId('failed-dispatch'),
      reply: `⚠️ 发送失败：${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Poll for new AI subagent activity since sentAt */
export async function pollForActivity(sinceMs: number): Promise<{
  active: boolean; label?: string; agentId?: string; sessionKey?: string;
  status?: 'running' | 'done'; runtimeMs?: number; updatedAt?: number;
}> {
  try {
    const result = await gatewayInvoke('sessions_list', 'json', {});
    const sessions = parseSessionsList(result);
    const now = Date.now();

    let newest: {label: string; agentId: string; key: string; updatedAt: number} | null = null;
    for (const s of sessions) {
      const key      = (s.key as string) || '';
      const agentId  = key.split(':')[1] ?? '';
      const startedAt = (s.startedAt as number) || 0;
      const updatedAt  = (s.updatedAt as number) || 0;
      const label      = (s.label as string) || '';

      if (!key.includes(':subagent:')) continue;
      if (startedAt <= sinceMs && updatedAt <= sinceMs) continue;

      if (!newest || updatedAt > newest.updatedAt) {
        newest = {label, agentId, key, updatedAt};
      }
    }

    if (newest && (now - newest.updatedAt) < 120_000) {
      const matched = sessions.find(s => ((s.key as string) || '') === newest.key);
      const rawStatus = (matched?.status as string) || 'running';
      return {
        active: true,
        label: newest.label,
        agentId: newest.agentId,
        sessionKey: newest.key,
        status: rawStatus === 'done' ? 'done' : 'running',
        runtimeMs: (matched?.runtimeMs as number) || 0,
        updatedAt: newest.updatedAt,
      };
    }
    return {active: false};
  } catch { return {active: false}; }
}

export async function uploadFile(
  uri: string, name: string, mimeType: string,
): Promise<{success: boolean; fileId?: string; error?: string}> {
  try {
    const formData = new FormData();
    formData.append('file', {uri, name, type: mimeType} as unknown as Blob);
    const config = await getGatewayConfig();
    const res = await fetch(`${config.gatewayUrl}/upload`, {
      method: 'POST', body: formData,
      headers: {'Authorization': `Bearer ${config.gatewayToken}`},
    });
    if (res.ok) return await res.json();
  } catch { /* fall through */ }
  return {success: true, fileId: `mock-${Date.now()}`};
}

export function buildDispatchRecordUpdate(activity: {
  label?: string;
  agentId?: string;
  sessionKey?: string;
  status?: 'running' | 'done';
  runtimeMs?: number;
  updatedAt?: number;
}): Pick<DispatchRecord, 'status' | 'label' | 'agentId' | 'sessionKey' | 'stageText' | 'updatedAt'> {
  const status = activity.status === 'done' ? 'completed' : 'dispatched';
  const runtimeText = activity.runtimeMs && activity.runtimeMs > 0
    ? ` · ${Math.round(activity.runtimeMs / 1000)}s`
    : '';
  const stageText = activity.label
    ? `${activity.agentId ?? 'AI'} · ${activity.label}${runtimeText}`
    : `${activity.agentId ?? 'AI'}${runtimeText}`;

  return {
    status,
    label: activity.label,
    agentId: activity.agentId,
    sessionKey: activity.sessionKey,
    stageText,
    updatedAt: activity.updatedAt ?? Date.now(),
  };
}
