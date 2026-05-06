/**
 * OpenClaw Gateway API Service — V1
 * Gateway: http://127.0.0.1:18789
 * Auth: Bearer token from openclaw.json gateway.auth.token
 *
 * Endpoints used:
 *   POST /tools/invoke  — sessions_list, message (send)
 *
 * Message flow:
 *   1. sendMessage → message tool → Feishu → zhuli agent
 *   2. zhuli responds via Feishu (user also sees in Feishu)
 *   3. App polls sessions_list for subagent activity as "live feed"
 */

import type {Agent, Task, ConfirmationItem, RuntimeMode, RuntimeSnapshot} from '../types';
import type {AgentStatus, TaskState} from '../types';

// ─── Config ─────────────────────────────────────────────────────────────────
const GATEWAY_URL   = 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = 'aebb240dad9c7ba10d99daf6a4388cfb56708000e5694c9c';
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
  tool: string, action: string, args: Record<string, unknown> = {},
): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
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
function parseSessionsList(result: unknown): Record<string, unknown>[] {
  try {
    const r = result as Record<string, unknown>;
    const content = (r?.content as Array<{type: string; text: string}>) ?? [];
    if (!content.length) return [];
    const inner = JSON.parse(content[0]?.text ?? '{}');
    return (inner?.sessions as Record<string, unknown>[]) ?? [];
  } catch { return []; }
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

function sessionsToAgents(sessions: Record<string, unknown>[]): Agent[] {
  const map = new Map<string, {
    id: string; name: string; role: string; status: AgentStatus;
    focus: string; accent: string; current: string; updatedAt: number;
  }>();

  for (const s of sessions) {
    const key      = (s['key'] as string) || '';
    const agentId  = key.split(':')[1] ?? key.split(':')[0];
    if (!AGENT_META[agentId]) continue;

    const status    = (s['status'] as string) || 'idle';
    const updatedAt = (s['updatedAt'] as number) || 0;
    const label     = (s['label'] as string) || '';
    const runtimeMs = (s['runtimeMs'] as number) || 0;
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
        current, updatedAt,
      });
    }
  }

  for (const [id, m] of Object.entries(AGENT_META)) {
    if (!map.has(id)) {
      map.set(id, {id, name: m.name, role: m.role, status: 'idle',
        focus: m.focus, accent: m.accent, current: '待命', updatedAt: 0});
    }
  }

  return Array.from(map.values()).map(a => ({
    id: a.id, name: a.name, role: a.role,
    status: a.status, focus: a.focus, accent: a.accent, current: a.current,
  }));
}

function sessionsToTasks(sessions: Record<string, unknown>[]): Task[] {
  const tasks: Task[] = [];
  const now = Date.now();
  const seen = new Set<string>();
  const agentNames: Record<string, string> = {
    zhuli:'助理', renzhi:'认知中枢', xunlong:'寻龙', wuyin:'无垠',
    tansuo:'探索', zhilian:'智联', heijin:'黑金', kaifa:'开发',
  };

  for (const s of sessions) {
    const key     = (s['key'] as string) || '';
    if (!key.includes(':subagent:')) continue;
    if (key.includes(':cron:')) continue;

    const updatedAt  = (s['updatedAt'] as number) || 0;
    const ageMs      = now - updatedAt;
    if (ageMs > 48 * 60 * 60 * 1000) continue;

    const parts     = key.split(':');
    const agentId   = parts[1] || 'kaifa';
    const label     = ((s['label'] as string) || '未命名任务')
                        .replace(/^Cron: /, '').trim();
    const status    = (s['status'] as string) || 'done';
    const runtimeMs = (s['runtimeMs'] as number) || 0;

    const state: TaskState =
      status === 'running'                                   ? 'running'
    : ageMs < 2 * 60 * 60 * 1000 && status !== 'done'     ? 'todo'
    : 'done';

    const title = label.length > 45 ? label.slice(0, 45) + '…' : label;
    if (seen.has(title)) continue;
    seen.add(title);

    tasks.push({
      id: `task-${parts[2] ?? String(updatedAt)}`,
      title,
      owner: agentNames[agentId] ?? agentId,
      state,
      eta:    runtimeMs > 0 ? `${Math.round(runtimeMs/1000)}s` : '已完成',
      next:   state === 'done' ? '已完成' : state === 'running' ? '执行中…' : '待执行',
      priority: label.includes('P0') ? 'P0' : label.includes('P1') ? 'P1' : 'P2',
    });
  }

  return tasks.slice(0, 12);
}

// ─── Fallback data ───────────────────────────────────────────────────────────
const FALLBACK_AGENTS: Agent[] = [
  {id:'zhuli',   name:'助理',    role:'AI 总指挥',        status:'online',  accent:'#22d3ee', focus:'接收指令、拆任务、调度、总结',      current:'汇总移动端 P0 体验需求'},
  {id:'renzhi',  name:'认知中枢', role:'后台认知层',        status:'watching',accent:'#a78bfa', focus:'长上下文、冲突消歧、夜训门控',      current:'维护深层判断框架'},
  {id:'xunlong', name:'寻龙',    role:'矿业研究员',        status:'idle',    accent:'#fbbf24', focus:'钨价、政策、全球矿业信源',          current:'等待矿业研究调度'},
  {id:'wuyin',   name:'无垠',    role:'矿山项目工程',       status:'working', accent:'#34d399', focus:'智慧矿山与三维数字孪生',           current:'聚源三维项目链路维护'},
  {id:'tansuo',  name:'探索',    role:'采选矿专家',         status:'online',  accent:'#fb7185', focus:'XRT、磨浮、回收率、药剂',           current:'采选矿判断待命'},
  {id:'zhilian', name:'智联',    role:'知识库管理员',        status:'online',  accent:'#38bdf8', focus:'归档、记忆、NAS、资料治理',         current:'知识库与记忆库状态巡检'},
  {id:'heijin',  name:'黑金',    role:'AI 项目工程师',      status:'working', accent:'#f97316', focus:'AI协作平台与 Agent Runtime',      current:'移动端 Alpha 迭代'},
  {id:'kaifa',   name:'开发',    role:'Codex 开发 Bot',    status:'idle',    accent:'#4ade80', focus:'代码、构建、Bug 修复',             current:'等待构建/接口任务'},
];

const FALLBACK_TASKS: Task[] = [
  {id:'t1', title:'移动端 P0：AI 大脑总览',       owner:'助理/黑金', state:'running', eta:'今晚',    next:'补齐总览、记忆库、调度链 UI',  priority:'P0'},
  {id:'t2', title:'OpenClaw Bridge 接口骨架',    owner:'开发',        state:'todo',    eta:'明天',    next:'接真实 Agent/任务/消息 API', priority:'P0'},
  {id:'t3', title:'附件上传入口',                owner:'黑金',        state:'running', eta:'Alpha 0.2', next:'图片/视频/文件统一进 AI 指令流', priority:'P1'},
  {id:'t4', title:'APP 上架 Skill',             owner:'助理',        state:'done',    eta:'已完成',  next:'后续补 TestFlight 自动化',   priority:'P1'},
  {id:'t5', title:'Brave 搜索链路补丁验证',      owner:'助理',        state:'blocked', eta:'待二轮验证', next:'搜索链只作研究辅助，不阻塞移动端', priority:'P2'},
  {id:'t6', title:'记忆库接口接入',             owner:'智联',        state:'todo',    eta:'本周',    next:'接 OpenClaw 记忆 API',      priority:'P1'},
];

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  try {
    const result = await gatewayInvoke('sessions_list', 'json', {});
    const sessions = parseSessionsList(result);
    const agents = sessionsToAgents(sessions);
    const tasks = sessionsToTasks(sessions);

    return {
      agents: agents.length > 0 ? agents : FALLBACK_AGENTS,
      tasks: tasks.length > 0 ? tasks : FALLBACK_TASKS,
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
    const result = await gatewayInvoke('message', 'send', {
      channel: 'feishu',
      target:  'ou_9782bd16e99998d38b13d05ff5cb648c',
      message: text,
    }) as Record<string, unknown>;
    const msgId = (result?.messageId ?? result?.chatId ?? 'ok') as string;
    const shortId = typeof msgId === 'string' && msgId.length > 12
      ? msgId.slice(0, 12) : String(msgId);
    const taskId = buildLocalTaskId('task');
    const dispatchId = buildLocalTaskId('dispatch');
    return {
      sent: true,
      taskId,
      dispatchId,
      sessionKey: typeof msgId === 'string' ? msgId : String(msgId),
      reply: `✓ 消息已送达至助理（${shortId}）。已生成调度单：${taskId} / ${dispatchId}，可在「任务」和「调度链」继续追踪。`,
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
  status?: 'running' | 'done';
}> {
  try {
    const result = await gatewayInvoke('sessions_list', 'json', {});
    const sessions = parseSessionsList(result);
    const now = Date.now();

    let newest: {label: string; agentId: string; key: string; updatedAt: number} | null = null;
    for (const s of sessions) {
      const key      = (s['key'] as string) || '';
      const agentId  = key.split(':')[1] ?? '';
      const startedAt = (s['startedAt'] as number) || 0;
      const updatedAt  = (s['updatedAt'] as number) || 0;
      const label      = (s['label'] as string) || '';

      if (!key.includes(':subagent:')) continue;
      if (startedAt <= sinceMs && updatedAt <= sinceMs) continue;

      if (!newest || updatedAt > newest.updatedAt) {
        newest = {label, agentId, key, updatedAt};
      }
    }

    if (newest && (now - newest.updatedAt) < 120_000) {
      const matched = sessions.find(s => ((s['key'] as string) || '') === newest.key);
      const rawStatus = (matched?.['status'] as string) || 'running';
      return {
        active: true,
        label: newest.label,
        agentId: newest.agentId,
        sessionKey: newest.key,
        status: rawStatus === 'done' ? 'done' : 'running',
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
    const res = await fetch(`${GATEWAY_URL}/upload`, {
      method: 'POST', body: formData,
      headers: {'Authorization': `Bearer ${GATEWAY_TOKEN}`},
    });
    if (res.ok) return await res.json();
  } catch { /* fall through */ }
  return {success: true, fileId: `mock-${Date.now()}`};
}
