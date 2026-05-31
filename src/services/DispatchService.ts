/**
 * DispatchService — 意图识别 + 关键词路由
 *
 * 根据用户消息关键词，将任务路由到对应的 Agent 会话。
 * 使用 sessionsSendMessage 直接 HTTP 调用 OpenClaw Gateway。
 */

import {sessionsSendMessage} from '../data/api';
import {getGatewayConfig} from './gatewayConfig';

// ─── 路由表 ────────────────────────────────────────────────────────────────

export type AgentId = 'xunlong' | 'tansuo' | 'wuyin' | 'kaifa' | 'zhilian' | 'heijin' | 'zhuli';

interface RouteEntry {
  agentId: AgentId;
  keywords: string[];
  description: string;
}

const ROUTE_TABLE: RouteEntry[] = [
  {
    agentId: 'xunlong',
    keywords: ['钨价', '钨', '矿业', '市场', '价格', '行情', '矿石', '矿山', '矿业政策', '全球矿业', '矿企', 'mining', 'tungsten'],
    description: '矿业研究员 · 全球矿业研究、钨价、政策、全球矿业信源',
  },
  {
    agentId: 'tansuo',
    keywords: ['选矿', '浮选', 'XRT', '回收率', '药剂', '磨矿', '磨浮', '品位', '重选', '磁选', '分离', 'mineral processing', 'flotation'],
    description: '采选矿专家 · XRT、磨浮、回收率、药剂',
  },
  {
    agentId: 'wuyin',
    keywords: ['矿山', '工程', '三维', '数字孪生', '智慧矿山', '矿建', '开采', '掘进', '爆破', '采矿', 'smart mine', '数字矿山'],
    description: '矿山项目工程师 · 智慧矿山、三维数字孪生、工程交付',
  },
  {
    agentId: 'kaifa',
    keywords: ['代码', '编程', 'bug', '重构', 'debug', 'code', 'build', 'test', 'pr', 'git', '程序员'],
    description: 'Codex 开发 Bot · 代码、构建、Bug 修复、PR 审查',
  },
  {
    agentId: 'zhilian',
    keywords: ['知识库', '归档', '记忆', '备份', 'NAS', '文档', '资料', '知识', '入库', '整理'],
    description: '知识库管理员 · 归档、记忆、NAS、资料治理',
  },
  {
    agentId: 'heijin',
    keywords: ['AI', '平台', '产品', 'feature', '功能', 'App', 'iOS', 'Android', 'AIBrainIM', '协作'],
    description: 'AI 项目工程师 · AI协作平台、产品工程',
  },
];

const DEFAULT_AGENT: AgentId = 'heijin';

// ─── 核心函数 ────────────────────────────────────────────────────────────

export function identifyAgent(messageText: string): AgentId {
  const text = messageText.toLowerCase();
  let best: RouteEntry | null = null;
  let bestScore = 0;

  for (const entry of ROUTE_TABLE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (text.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best?.agentId ?? DEFAULT_AGENT;
}

export function getAgentSessionKey(agentId: AgentId): string {
  return `agent:${agentId}`;
}

// ─── 调度状态 ───────────────────────────────────────────────────────────────

export type DispatchStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface DispatchResult {
  sessionKey: string;
  agentId: AgentId;
  description: string;
  sent: boolean;
  reply?: string;
  error?: string;
}

// ─── 发送调度 ───────────────────────────────────────────────────────────────

export async function dispatchToAgent(
  messageText: string,
  onStatusChange?: (status: DispatchStatus) => void,
): Promise<DispatchResult> {
  const agentId = identifyAgent(messageText);
  const sessionKey = getAgentSessionKey(agentId);
  const route = ROUTE_TABLE.find(r => r.agentId === agentId);
  const description = route?.description ?? 'AI 协作平台';

  onStatusChange?.('pending');

  try {
    const config = await getGatewayConfig();

    if (!config.directMode) {
      return {
        sessionKey,
        agentId,
        description,
        sent: false,
        error: 'Gateway 直连模式未开启，请在设置中开启。',
      };
    }

    onStatusChange?.('processing');

    const result = await sessionsSendMessage(
      messageText,
      sessionKey,
      config.gatewayUrl,
      config.gatewayToken,
    );

    if (result.ok) {
      onStatusChange?.('done');
      return {
        sessionKey,
        agentId,
        description,
        sent: true,
        reply: result.reply ?? '已收到回复。',
      };
    } else {
      onStatusChange?.('failed');
      return {
        sessionKey,
        agentId,
        description,
        sent: false,
        error: result.error ?? '发送失败',
      };
    }
  } catch (e) {
    onStatusChange?.('failed');
    return {
      sessionKey,
      agentId,
      description,
      sent: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function getAllRoutes(): Array<{agentId: AgentId; description: string; keywords: string[]}> {
  return ROUTE_TABLE.map(r => ({
    agentId: r.agentId,
    description: r.description,
    keywords: r.keywords,
  }));
}
