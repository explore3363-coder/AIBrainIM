/**
 * OpenClawService — Gateway API 连接层
 *
 * 正确接入方式：通过 Gateway /tools/invoke 调用飞书消息工具
 * 消息 → feishu_im_user_message → 飞书 zhuli 机器人 → OpenClaw Agent 调度
 *
 * 为什么不用 /api/sessions/{key}/messages：
 * Gateway 的 sessions_send 不是 HTTP 可调用的工具（需要 WebSocket 协议）
 * 正确路径：gatewayInvoke('feishu_im_user_message', 'send', {...})
 */

import {getGatewayConfig, type GatewayConfig} from './gatewayConfig';

export interface OpenClawMessageResult {
  ok: boolean;
  reply?: string;
  messageId?: string;
  error?: string;
}

export interface GatewayToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

// ─── Gateway HTTP Invoke ────────────────────────────────────────────────────

const INVOKE_TIMEOUT_MS = 20000;

export async function gatewayInvoke(
  tool: string,
  action: string,
  args: Record<string, unknown> = {},
  config?: GatewayConfig,
): Promise<GatewayToolResult> {
  const cfg = config ?? await getGatewayConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INVOKE_TIMEOUT_MS);

  try {
    const res = await fetch(`${cfg.gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.gatewayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({tool, action, args}),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg = errBody?.error?.message || errMsg;
      } catch {}
      return {ok: false, error: errMsg};
    }

    const json = (await res.json()) as {ok: boolean; result?: unknown; error?: {message?: string}};
    if (!json.ok) {
      return {ok: false, error: json.error?.message || 'gateway invoke failed'};
    }
    return {ok: true, result: json.result};
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('abort')) {
      return {ok: false, error: '请求超时'};
    }
    return {ok: false, error: msg};
  }
}

// ─── Send Message to zhuli via Feishu ──────────────────────────────────────

/**
 * 通过飞书机器人发送消息给 zhuli（AI 大脑）
 * 消息会经过 OpenClaw Agent 调度系统处理
 *
 * @param text 用户消息内容
 * @param targetOpenId 目标飞书 open_id（发给谁）
 * @returns 发送结果
 */
export async function sendMessageToAI(
  text: string,
  targetOpenId: string = 'ou_9782bd16e99998d38b13d05ff5cb648c',
): Promise<OpenClawMessageResult> {
  const result = await gatewayInvoke(
    'feishu_im_user_message',
    'send',
    {
      action: 'send',
      receive_id_type: 'open_id',
      receive_id: targetOpenId,
      msg_type: 'text',
      content: JSON.stringify({text}),
    },
  );

  if (!result.ok) {
    return {ok: false, error: result.error};
  }

  // 飞书发消息成功，但 AI 回复需要等待异步处理
  // App 端通过 Gateway 会话轮询来获取后续回复
  return {
    ok: true,
    reply: '消息已送达 AI 大脑，等待处理中...',
  };
}

/**
 * 直接发送纯文本消息（不带 Agent 路由前缀）
 * 用于通用对话
 */
export async function sendChatMessage(
  text: string,
  targetOpenId: string = 'ou_9782bd16e99998d38b13d05ff5cb648c',
): Promise<OpenClawMessageResult> {
  const result = await gatewayInvoke(
    'feishu_im_user_message',
    'send',
    {
      action: 'send',
      receive_id_type: 'open_id',
      receive_id: targetOpenId,
      msg_type: 'text',
      content: JSON.stringify({text}),
    },
  );

  if (!result.ok) {
    return {ok: false, error: result.error};
  }

  return {
    ok: true,
    reply: '消息已发送',
  };
}

// ─── Query zhuli Session Recent Messages ────────────────────────────────────

/**
 * 获取 zhuli 最近的对话消息（用于在 App 内展示 AI 回复）
 * 轮询方式：发消息后每隔 2s 查询一次，共查 3-5 次
 */
export async function pollRecentMessages(
  openId: string = 'ou_9782bd16e99998d38b13d05ff5cb648c',
  sinceTimestamp: number,
  maxAttempts: number = 5,
  intervalMs: number = 2000,
): Promise<Array<{role: 'user' | 'ai'; text: string; timestamp: number}>> {
  const messages: Array<{role: 'user' | 'ai'; text: string; timestamp: number}> = [];

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(() => resolve(undefined), intervalMs));

    const result = await gatewayInvoke(
      'feishu_im_user_get_messages',
      'get',
      {
        open_id: openId,
        page_size: 10,
      },
    );

    if (!result.ok || !result.result) continue;

    try {
      const resultData = result.result as {messages?: Array<{
        sender?: {sender_id?: {open_id?: string}};
        create_time?: number;
        body?: string;
        msg_type?: string;
      }>};

      const msgs = resultData?.messages ?? [];
      for (const m of msgs) {
        const ts = (m.create_time ?? 0) * 1000;
        if (ts <= sinceTimestamp) continue;
        if (m.msg_type !== 'text') continue;

        let text = '';
        try {
          const body = typeof m.body === 'string' ? JSON.parse(m.body) : m.body;
          text = body?.text ?? '';
        } catch {
          text = String(m.body ?? '');
        }
        if (!text) continue;

        const isUser = (m.sender?.sender_id?.open_id ?? '') === openId;
        messages.push({
          role: isUser ? 'user' : 'ai',
          text,
          timestamp: ts,
        });
      }
    } catch {
      // continue polling
    }
  }

  return messages;
}

// ─── Gateway Health Check ───────────────────────────────────────────────────

export interface GatewayHealth {
  reachable: boolean;
  latencyMs: number;
  error?: string;
}

export async function checkGatewayHealth(): Promise<GatewayHealth> {
  const start = Date.now();
  const result = await gatewayInvoke('sessions_list', 'list', {});
  const latencyMs = Date.now() - start;

  return {
    reachable: result.ok,
    latencyMs,
    error: result.error,
  };
}
