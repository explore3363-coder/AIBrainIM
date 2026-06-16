/**
 * GatewayWSService — WebSocket 直连 OpenClaw Gateway
 * 
 * 用途：在任何网络下（移动网络/wi-fi），直接连接 OpenClaw Gateway
 * 协议：Gateway WebSocket Protocol (RFC 6455)
 * 端点：wss://node.tail67ac15.ts.net/（通过 Tailscale Funnel 暴露）
 * 
 * 握手流程：
 * 1. WebSocket 升级 (101 Switching Protocols)
 * 2. 接收 connect.challenge (nonce)
 * 3. 发送 connect req (token 认证)
 * 4. 接收 hello-ok → 连接建立
 * 5. 发送消息 / 接收回复
 */

import {getGatewayConfig} from './gatewayConfig';

const GATEWAY_WS_URL = 'wss://node.tail67ac15.ts.net/';

export interface WSMessage {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  payload?: Record<string, unknown>;
  event?: string;
  error?: {type: string; message: string};
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
  connId?: string;
  protocol?: number;
}

export class GatewayWSService {
  private ws: WebSocket | null = null;
  private token: string = '';
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private messageListeners: ((msg: WSMessage) => void)[] = [];
  private challengeNonce: string = '';
  private connected = false;
  private connectResolve: ((r: ConnectResult) => void) | null = null;

  /** 建立 WebSocket 连接并完成握手 */
  async connect(): Promise<ConnectResult> {
    if (this.connected && this.ws) {
      return {ok: true};
    }

    const config = await getGatewayConfig();
    this.token = config.gatewayToken;

    return new Promise((resolve) => {
      this.connectResolve = resolve;

      try {
        this.ws = new WebSocket(GATEWAY_WS_URL);
        this.ws.onopen = this.handleOpen.bind(this);
        this.ws.onmessage = this.handleMessage.bind(this) as (e: unknown) => void;
        this.ws.onerror = this.handleError.bind(this);
        this.ws.onclose = this.handleClose.bind(this) as (e: unknown) => void;
      } catch (err) {
        resolve({ok: false, error: String(err)});
      }
    });
  }

  private handleOpen() {
    // 等待 connect.challenge 事件
  }

  private handleMessage(event: {data: string}) {
    let msg: WSMessage;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    // 处理 connect.challenge
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      const nonce = (msg.payload as {nonce?: string})?.nonce ?? '';
      this.challengeNonce = nonce;
      this.sendConnectReq(nonce);
      return;
    }

    // 处理 hello-ok 或错误响应
    if (msg.type === 'res' && msg.payload && 'type' in msg.payload) {
      const pl = msg.payload as {type?: string; ok?: boolean; error?: {type:string;message:string}};
      if (pl.type === 'hello-ok') {
        this.connected = true;
        if (this.connectResolve) {
          this.connectResolve({
            ok: true,
            connId: (pl as {connId?:string}).connId,
            protocol: (pl as {protocol?:number}).protocol,
          });
          this.connectResolve = null;
        }
        return;
      }
      if (pl.type === 'error' && this.connectResolve) {
        this.connectResolve({ok: false, error: pl.error?.message ?? 'connection error'});
        this.connectResolve = null;
        return;
      }
    }

    // 响应请求
    if (msg.type === 'res' && msg.id) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        if (msg.ok !== false) {
          pending.resolve(msg.payload ?? msg);
        } else {
          pending.reject(new Error((msg as {error?:{message:string}}).error?.message ?? 'request failed'));
        }
      }
      return;
    }

    // 事件（不是请求响应，广播给监听器）
    if (msg.type === 'event') {
      this.messageListeners.forEach(listener => {
        try { listener(msg); } catch {}
      });
    }
  }

  private handleError(event: Event) {
    const errMsg = 'WebSocket error';
    if (this.connectResolve) {
      this.connectResolve({ok: false, error: errMsg});
      this.connectResolve = null;
    }
    console.error('[GatewayWS] error:', event);
  }

  private handleClose(event: {code: number; reason: string}) {
    this.connected = false;
    this.ws = null;
  }

  /** 发送 connect 请求（带 token 认证） */
  private sendConnectReq(nonce: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const reqId = makeReqId();
    const connectReq = {
      type: 'req',
      id: reqId,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 4,
        client: {
          id: 'AIBrainIM',
          version: '1.0.0',
          platform: 'ios',
          mode: 'client',
        },
        role: 'client',
        scopes: ['sessions.read', 'sessions.write', 'tools.invoke'],
        auth: {token: this.token},
        locale: 'zh-CN',
        userAgent: 'AIBrainIM/1.0.0',
      },
    };

    this.ws.send(JSON.stringify(connectReq));

    // 超时处理
    const timer = setTimeout(() => {
      if (this.connectResolve) {
        this.connectResolve({ok: false, error: 'connect timeout'});
        this.connectResolve = null;
      }
      this.ws?.close();
    }, 10000);

    this.pendingRequests.set(reqId, {
      resolve: () => {},
      reject: () => {},
      timer,
    });
  }

  /** 发送请求并等待响应 */
  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('not connected');
    }

    const reqId = makeReqId();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`timeout for ${method}`));
      }, 30000);

      this.pendingRequests.set(reqId, {resolve, reject, timer});
      this.ws!.send(JSON.stringify({
        type: 'req',
        id: reqId,
        method,
        params,
      }));
    });
  }

  /** 发送消息到指定会话（核心功能） */
  async sendMessage(sessionKey: string, content: string): Promise<{ok: boolean; reply?: string; error?: string}> {
    try {
      const result = await this.request('sessions.send', {
        sessionKey,
        message: content,
      }) as Record<string, unknown>;
      return {
        ok: true,
        reply: typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply ?? result),
      };
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  }

  /** 获取会话列表 */
  async listSessions(): Promise<unknown[]> {
    const result = await this.request('sessions.list', {}) as {sessions?: unknown[]};
    return result.sessions ?? [];
  }

  /** 断开连接 */
  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.pendingRequests.forEach(p => clearTimeout(p.timer));
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  onMessage(listener: (msg: WSMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }
}

function makeReqId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Singleton ───────────────────────────────────────────────────────────────
export const gatewayWS = new GatewayWSService();
