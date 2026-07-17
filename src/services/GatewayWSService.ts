/**
 * GatewayWSService — WebSocket 直连 OpenClaw Gateway（设备身份版）
 *
 * 用途：在任何网络下（移动网络/wi-fi），直接连接 OpenClaw Gateway
 * 协议：Gateway WebSocket Protocol (RFC 6455)
 * 端点：wss://node.tail67ac15.ts.net/（通过 Tailscale Funnel 暴露）
 *
 * 握手流程（设备身份版）：
 * 1. WebSocket 升级 (101 Switching Protocols)
 * 2. 接收 connect.challenge (nonce)
 * 3. 用 Ed25519 私钥签名 nonce，证明设备身份
 * 4. 发送 connect req (token + publicKey + nonce 签名)
 * 5a. 已配对设备 → hello-ok → 连接建立
 * 5b. 未配对设备 → NOT_PAIRED（自动触发重新连接完成配对）
 * 6. 订阅 main session 消息
 */

import {getGatewayConfig} from './gatewayConfig';
import * as Keychain from 'react-native-keychain';
// @ts-ignore
import nacl from 'tweetnacl';
// @ts-ignore
import {encodeBase64, decodeBase64} from 'tweetnacl-util';

const GATEWAY_WS_URL = 'wss://node.tail67ac15.ts.net/';

const DEVICE_KEYCHAIN_SERVICE = 'AIBrainIM.DeviceIdentity';
const DEVICE_KEYCHAIN_USERNAME = 'deviceKeyPair';

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

export interface DeviceKeyPair {
  publicKeyBase64: string;
  secretKeyBase64: string;
}

// ─── 设备密钥对管理 ─────────────────────────────────────────────────────────────

/** 从 Keychain 加载设备密钥对（首次自动生成） */
async function loadOrCreateKeyPair(): Promise<DeviceKeyPair> {
  try {
    const creds = await Keychain.getGenericPassword({
      service: DEVICE_KEYCHAIN_SERVICE,
    });
    if (creds && creds.password) {
      const kp: DeviceKeyPair = JSON.parse(creds.password);
      if (kp.publicKeyBase64 && kp.secretKeyBase64) {
        return kp;
      }
    }
  } catch {}

  // 首次：生成 Ed25519 密钥对
  const keyPair = nacl.sign.keyPair();
  const kp: DeviceKeyPair = {
    publicKeyBase64: encodeBase64(keyPair.publicKey),
    secretKeyBase64: encodeBase64(keyPair.secretKey),
  };

  await Keychain.setGenericPassword(DEVICE_KEYCHAIN_USERNAME, JSON.stringify(kp), {
    service: DEVICE_KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return kp;
}

// ─── GatewayWSService ─────────────────────────────────────────────────────────

export class GatewayWSService {
  private ws: WebSocket | null = null;
  private token: string = '';
  private deviceKeyPair: DeviceKeyPair | null = null;
  private pendingRequests = new Map<
    string,
    {resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>}
  >();
  private messageListeners: ((msg: WSMessage) => void)[] = [];
  private challengeNonce: string = '';
  private connected = false;
  private connectResolve: ((r: ConnectResult) => void) | null = null;
  private connecting = false;

  /** 建立 WebSocket 连接（自动处理设备配对） */
  async connect(): Promise<ConnectResult> {
    if (this.connected && this.ws) {
      return {ok: true};
    }
    if (this.connecting) {
      return {ok: false, error: 'already connecting'};
    }

    const config = await getGatewayConfig();
    this.token = config.gatewayToken;
    this.deviceKeyPair = await loadOrCreateKeyPair();
    this.connecting = true;

    return new Promise(resolve => {
      this.connectResolve = resolve;

      try {
        this.ws = new WebSocket(GATEWAY_WS_URL);
        this.ws.onopen = this.handleOpen.bind(this);
        this.ws.onmessage = this.handleMessage.bind(this) as (e: unknown) => void;
        this.ws.onerror = this.handleError.bind(this);
        this.ws.onclose = this.handleClose.bind(this) as (e: unknown) => void;
      } catch (err) {
        this.connecting = false;
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

    // ── connect.challenge：签名 nonce 并发送连接请求 ──────────────────────
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      const nonce = (msg.payload as {nonce?: string})?.nonce ?? '';
      this.challengeNonce = nonce;
      this.sendConnectReq(nonce);
      return;
    }

    // ── hello-ok：连接建立成功 ─────────────────────────────────────────────
    if (msg.type === 'res' && msg.payload && 'type' in msg.payload) {
      const pl = msg.payload as {type?: string; ok?: boolean; error?: {type: string; message: string}};

      if (pl.type === 'hello-ok') {
        this.connected = true;
        this.connecting = false;
        if (this.connectResolve) {
          this.connectResolve({
            ok: true,
            connId: (pl as {connId?: string}).connId,
            protocol: (pl as {protocol?: number}).protocol,
          });
          this.connectResolve = null;
        }
        this.subscribeSession('main').catch(() => {});
        return;
      }

      if (pl.type === 'error' && this.connectResolve) {
        const errMsg = pl.error?.message ?? 'connection error';
        this.connecting = false;
        this.connectResolve({ok: false, error: errMsg});
        this.connectResolve = null;
        return;
      }
    }

    // ── connect 响应：处理配对状态 ─────────────────────────────────────────
    if (msg.type === 'res' && msg.id === 'connect-req') {
      this.pendingRequests.delete('connect-req');

      if (msg.ok) {
        this.connected = true;
        this.connecting = false;
        if (this.connectResolve) {
          this.connectResolve({ok: true});
          this.connectResolve = null;
        }
        return;
      }

      // NOT_PAIRED：设备未配对 → 等待 challenge 重发来完成配对
      const err = msg.error as {code?: string; message?: string} | undefined;
      if (err?.code === 'NOT_PAIRED' || err?.code === 'DEVICE_IDENTITY_REQUIRED') {
        console.log('[GatewayWS] Device not yet paired, retrying to complete pairing...');
        return;
      }

      // 其他错误
      this.connecting = false;
      if (this.connectResolve) {
        this.connectResolve({ok: false, error: err?.message ?? 'connect failed'});
        this.connectResolve = null;
      }
      return;
    }

    // ── 响应请求 ───────────────────────────────────────────────────────────
    if (msg.type === 'res' && msg.id) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        if (msg.ok !== false) {
          pending.resolve(msg.payload ?? msg);
        } else {
          pending.reject(new Error((msg as {error?: {message: string}}).error?.message ?? 'request failed'));
        }
      }
      return;
    }

    // ── 事件广播 ──────────────────────────────────────────────────────────
    if (msg.type === 'event') {
      this.messageListeners.forEach(listener => {
        try {
          listener(msg);
        } catch {}
      });
    }
  }

  private handleError(event: Event) {
    this.connecting = false;
    if (this.connectResolve) {
      this.connectResolve({ok: false, error: 'WebSocket error'});
      this.connectResolve = null;
    }
    console.error('[GatewayWS] error:', event);
  }

  private handleClose(_event: {code: number; reason: string}) {
    this.connected = false;
    this.connecting = false;
    this.ws = null;
  }

  /** 发送 connect 请求（含 Ed25519 签名证明设备身份） */
  private sendConnectReq(nonce: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.deviceKeyPair) return;

    // 用 Ed25519 私钥签名 nonce（证明设备身份）
    const nonceBytes = new Uint8Array(Buffer.from(nonce, 'utf8'));
    const secretKeyBytes = decodeBase64(this.deviceKeyPair.secretKeyBase64);
    const signature = nacl.sign(nonceBytes, secretKeyBytes);
    const signatureBase64 = encodeBase64(signature);

    const reqId = 'connect-req';
    const connectReq = {
      type: 'req',
      id: reqId,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 4,
        client: {
          id: 'openclaw-ios',
          version: '1.0.0',
          platform: 'ios',
          mode: 'node',
          displayName: 'AIBrainIM',
        },
        // 设备身份：publicKey + nonce 签名
        device: {
          publicKey: this.deviceKeyPair.publicKeyBase64,
        },
        // 认证：operator token
        auth: {token: this.token},
        // nonce 签名（gateway 用此验证设备身份）
        nonce,
        signature: signatureBase64,
        locale: 'zh-CN',
        userAgent: 'AIBrainIM/1.0.0',
      },
    };

    this.ws.send(JSON.stringify(connectReq));

    // 超时处理（60s，等待配对流程）
    const timer = setTimeout(() => {
      this.pendingRequests.delete(reqId);
      if (this.connectResolve) {
        this.connectResolve({ok: false, error: 'connect timeout (60s)'});
        this.connectResolve = null;
      }
      this.connecting = false;
      this.ws?.close();
    }, 60000);

    this.pendingRequests.set(reqId, {resolve: () => {}, reject: () => {}, timer});
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
      this.ws!.send(
        JSON.stringify({
          type: 'req',
          id: reqId,
          method,
          params,
        }),
      );
    });
  }

  /** 发送消息到指定会话 */
  async sendMessage(
    sessionKey: string,
    content: string,
  ): Promise<{ok: boolean; reply?: string; error?: string}> {
    try {
      const result = (await this.request('sessions.send', {
        sessionKey,
        message: content,
      })) as Record<string, unknown>;
      return {
        ok: true,
        reply:
          typeof result.reply === 'string'
            ? result.reply
            : JSON.stringify(result.reply ?? result),
      };
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  }

  /** 获取会话列表 */
  async listSessions(): Promise<unknown[]> {
    const result = (await this.request(
      'sessions.list',
      {},
    )) as {sessions?: unknown[]};
    return result.sessions ?? [];
  }

  /** 订阅 session 消息事件 */
  async subscribeSession(key: string): Promise<boolean> {
    try {
      const result = (await this.request(
        'sessions.messages.subscribe',
        {key},
      )) as {subscribed?: boolean};
      return result?.subscribed === true;
    } catch {
      return false;
    }
  }

  /** 断开连接 */
  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.connecting = false;
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

// ─── Singleton ────────────────────────────────────────────────────────────────
export const gatewayWS = new GatewayWSService();
