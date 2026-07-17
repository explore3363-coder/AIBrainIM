/**
 * AgentPlatformService — AI协作平台 Agent 状态接入层
 * 
 * 数据源：
 *   1. 平台服务器 /api/agent/*  → Agent 运行时状态、队列深度、心跳
 *   2. OpenClaw Gateway         → 会话在线状态（通过 AppContext 已接入）
 *   3. 本地 AGENT_META           → Agent 元信息（名称/角色/色调）
 * 
 * 融合策略：
 *   - 优先使用 Gateway 会话数据（实时在线状态）
 *   - 使用平台 API 补充 queueDepth、lastHeartbeat、dispatchId 等运行时指标
 *   - 平台 API 不可用时优雅降级到纯 Gateway / Mock 数据
 */

import type {Agent, AgentStatus} from '../types';

// ─── Platform Server ───────────────────────────────────────────────────────────
const PLATFORM_URL = 'http://localhost:3000';
const AGENT_API = `${PLATFORM_URL}/api/agent`;
const TIMEOUT_MS = 5000;

// ─── Agent 元信息（与 api.ts 保持同步）─────────────────────────────────────────
const AGENT_META: Record<string, {name: string; role: string; focus: string; accent: string}> = {
  zhuli:   {name:'助理',     role:'AI 总指挥',       focus:'接收指令、拆任务、调度、总结',        accent:'#22d3ee'},
  renzhi:  {name:'认知中枢',  role:'后台认知层',       focus:'长上下文、冲突消歧、夜训门控',        accent:'#a78bfa'},
  xunlong: {name:'寻龙',     role:'矿业研究员',       focus:'钨价、政策、全球矿业信源',             accent:'#fbbf24'},
  wuyin:   {name:'无垠',     role:'矿山项目工程',      focus:'智慧矿山与三维数字孪生',              accent:'#34d399'},
  tansuo:  {name:'探索',     role:'采选矿专家',        focus:'XRT、磨浮、回收率、药剂',             accent:'#fb7185'},
  zhilian: {name:'智联',     role:'知识库管理员',       focus:'归档、记忆、NAS、资料治理',           accent:'#38bdf8'},
  heijin:  {name:'黑金',     role:'AI 项目工程师',      focus:'AI协作平台与 Agent Runtime',          accent:'#f97316'},
  kaifa:   {name:'开发',     role:'Codex 开发 Bot',    focus:'代码、构建、Bug 修复',                accent:'#4ade80'},
  // 平台服务器遗留 Agent（兼容旧路由）
  gongcheng:{name:'工程',    role:'系统工程师',        focus:'系统编程、代码编写、Bug修复',         accent:'#60a5fa'},
  dizhi:   {name:'地质',     role:'地质建模',          focus:'地质建模、储量计算、钻孔数据分析',     accent:'#a3e635'},
  xuankuang:{name:'选矿',   role:'选矿工艺',          focus:'选矿工艺设计、流程优化',               accent:'#f472b6'},
  anquan:  {name:'安全',     role:'EHS 安全',          focus:'EHS评估、风险分析',                   accent:'#facc15'},
  zhengce: {name:'政策',    role:'政策研究',           focus:'矿业政策解读、合规审查',               accent:'#22d3ee'},
  shichang:{name:'市场',    role:'市场分析',           focus:'钨价预测、市场分析',                   accent:'#c084fc'},
};

// ─── Mock Fallback ─────────────────────────────────────────────────────────────
const FALLBACK_PLATFORM_AGENTS: Agent[] = Object.entries(AGENT_META).map(([id, meta]) => ({
  id,
  name: meta.name,
  role: meta.role,
  status: 'idle',
  focus: meta.focus,
  accent: meta.accent,
  current: '待命',
}));

// ─── API Types ─────────────────────────────────────────────────────────────────
interface PlatformAgent {
  id: string;
  name: string;
  description: string;
  online: boolean;
  status: string;
  lastHeartbeat: number | null;
  currentDispatchId: string | null;
  queueDepth: number;
}

interface PlatformRuntime {
  agentId: string;
  dispatchesCompleted: number;
  avgResponseMs: number;
  uptime: number;
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
async function platformFetch<T>(path: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${AGENT_API}${path}`, {signal: controller.signal as AbortSignal});
    clearTimeout(timer);
    if (!res.ok) return null;
    return await (res.json() as Promise<T>);
  } catch {
    return null;
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
function platformStatusToAgentStatus(s: string): AgentStatus {
  if (s === 'working') return 'working';
  if (s === 'online')   return 'online';
  if (s === 'watching') return 'watching';
  return 'idle';
}

function enrichWithPlatform(
  agent: Agent,
  platform: PlatformAgent,
  runtime?: PlatformRuntime,
): Agent {
  return {
    ...agent,
    // 平台在线状态优先（因为有心跳确认）
    status: platform.online
      ? (platformStatusToAgentStatus(platform.status) || agent.status)
      : 'idle',
    // 平台心跳时间更精确
    lastActiveAt: platform.lastHeartbeat ?? agent.lastActiveAt,
    // 平台有真实的 dispatch 信息
    current: platform.currentDispatchId
      ? `dispatch:${platform.currentDispatchId}`
      : agent.current,
    platformDispatchId: platform.currentDispatchId ?? agent.platformDispatchId,
    // 来自平台运行时数据
    runtimeMs: runtime?.uptime,
    // 队列深度
    queueDepth: platform.queueDepth ?? agent.queueDepth,
  };
}

// ─── Service ───────────────────────────────────────────────────────────────────
export const AgentPlatformService = {
  /**
   * 获取所有 Agent 列表（融合平台运行时数据 + 本地 AGENT_META）
   * - 平台 API 可用 → 补充 queueDepth / lastHeartbeat / dispatchId
   * - 平台 API 不可用 → 仅返回本地 AGENT_META（Gateway 会话数据由 AppContext 提供）
   */
  async getAllAgents(): Promise<Agent[]> {
    const [list, runtimeList] = await Promise.all([
      platformFetch<{agents: PlatformAgent[]} & unknown>('/list'),
      platformFetch<{runtimes: PlatformRuntime[]} & unknown>('/runtimes'),
    ]);

    // 构建平台 runtime 查找表
    const runtimeMap = new Map<string, PlatformRuntime>();
    if (runtimeList && 'runtimes' in runtimeList) {
      for (const rt of (runtimeList as {runtimes: PlatformRuntime[]}).runtimes) {
        runtimeMap.set(rt.agentId, rt);
      }
    }

    // 如果平台 API 完全不可用，返回本地元信息
    if (!list || !('agents' in list)) {
      return FALLBACK_PLATFORM_AGENTS;
    }

    const platformAgents = (list as {agents: PlatformAgent[]}).agents;

    // 映射平台 Agent → App Agent（补充平台元信息）
    return platformAgents.map(pa => {
      const meta = AGENT_META[pa.id];
      const base: Agent = meta
        ? {id: pa.id, name: meta.name, role: meta.role, status: 'idle', focus: meta.focus, accent: meta.accent, current: '待命'}
        : {id: pa.id, name: pa.name, role: pa.description, status: 'idle', focus: '', accent: '#94a3b8', current: '待命'};
      const runtime = runtimeMap.get(pa.id);
      return enrichWithPlatform(base, pa, runtime);
    });
  },

  /**
   * 获取指定 Agent 的平台运行时状态
   */
  async getAgentStatus(agentId: string): Promise<PlatformAgent | null> {
    const data = await platformFetch<PlatformAgent & unknown>(`/${agentId}/status`);
    return data && 'id' in data ? (data as PlatformAgent) : null;
  },

  /**
   * 获取指定 Agent 的运行时统计
   */
  async getAgentRuntime(agentId: string): Promise<PlatformRuntime | null> {
    const data = await platformFetch<PlatformRuntime & unknown>(`/${agentId}/runtimes`);
    return data && 'agentId' in data ? (data as PlatformRuntime) : null;
  },

  /**
   * 平台服务器健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController(); const t = setTimeout(() => controller.abort(), TIMEOUT_MS); const res = await fetch(`${PLATFORM_URL}/api/health`, {signal: controller.signal as AbortSignal}); clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  },
};
