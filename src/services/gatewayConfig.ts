import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GatewayConfig {
  gatewayUrl: string;
  gatewayToken: string;
  directMode: boolean;
  sessionKey: string;
  channel: string;
  target: string;
  /** Computed: ws:// or wss:// derived from gatewayUrl */
  wsProtocol: 'ws' | 'wss';
}

export interface GatewayConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const STORAGE_KEY = '@AIBrainIM:gatewayConfig';

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  gatewayUrl: 'http://192.168.3.26:18789',
  gatewayToken: '',
  directMode: true, // 直连 OpenClaw sessions_send，不走 Feishu 回退
  sessionKey: 'agent:zhuli:feishu:direct:ou_9782bd16e99998d38b13d05ff5cb648c',
  channel: 'feishu',
  target: '',
  wsProtocol: 'ws',
};

function computeWsProtocol(gatewayUrl: string): 'ws' | 'wss' {
  if (gatewayUrl.startsWith('https://')) return 'wss';
  return 'ws';
}

function normalizeConfig(input?: Partial<GatewayConfig> | null): GatewayConfig {
  const gwUrl = (input?.gatewayUrl ?? DEFAULT_GATEWAY_CONFIG.gatewayUrl).trim();
  return {
    gatewayUrl: gwUrl,
    gatewayToken: (input?.gatewayToken ?? DEFAULT_GATEWAY_CONFIG.gatewayToken).trim(),
    directMode: input?.directMode ?? DEFAULT_GATEWAY_CONFIG.directMode,
    sessionKey: (input?.sessionKey ?? DEFAULT_GATEWAY_CONFIG.sessionKey).trim(),
    channel: (input?.channel ?? DEFAULT_GATEWAY_CONFIG.channel).trim() || 'feishu',
    target: (input?.target ?? DEFAULT_GATEWAY_CONFIG.target).trim(),
    wsProtocol: computeWsProtocol(gwUrl),
  };
}

export function validateGatewayConfig(input?: Partial<GatewayConfig> | null): GatewayConfigValidation {
  const config = normalizeConfig(input);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.gatewayUrl) {
    errors.push('缺少 Gateway URL');
  } else if (!/^https?:\/\//i.test(config.gatewayUrl)) {
    errors.push('Gateway URL 必须以 http:// 或 https:// 开头');
  }

  if (!config.gatewayToken) {
    errors.push('缺少 Gateway Token');
  } else if (config.gatewayToken.length < 16) {
    warnings.push('Gateway Token 看起来过短，请确认不是截断值');
  }

  if (config.directMode) {
    if (!config.sessionKey) {
      errors.push('直连模式缺少目标 Session Key');
    }
  } else {
    if (!config.target) {
      errors.push('回退模式缺少目标账号 / 会话');
    }
  }

  if (/127\.0\.0\.1|localhost/i.test(config.gatewayUrl)) {
    warnings.push('当前 URL 指向本机回环地址，TestFlight 真机环境通常无法直接访问你的开发机');
  }

  if (/^http:\/\//i.test(config.gatewayUrl) && !/127\.0\.0\.1|localhost/i.test(config.gatewayUrl)) {
    warnings.push('当前使用非加密 HTTP 地址；若走公网或外网中转，建议切到 HTTPS');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function summarizeGatewayConfig(input?: Partial<GatewayConfig> | null): string {
  const config = normalizeConfig(input);
  const validation = validateGatewayConfig(config);
  const tokenState = config.gatewayToken ? `Token ${redactToken(config.gatewayToken)}` : 'Token 未配置';
  const routeState = config.directMode
    ? (config.sessionKey ? `直连 ${config.sessionKey}` : '直连 Session 未配置')
    : (config.target ? `回退 ${config.target}` : '回退目标未配置');
  const state = validation.valid ? '可测试' : '待补全';
  return `${state} · ${config.directMode ? 'direct' : 'feishu-fallback'} · ${tokenState} · ${routeState}`;
}

export async function getGatewayConfig(): Promise<GatewayConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GATEWAY_CONFIG;
    return normalizeConfig(JSON.parse(raw) as Partial<GatewayConfig>);
  } catch {
    return DEFAULT_GATEWAY_CONFIG;
  }
}

export async function saveGatewayConfig(config: GatewayConfig): Promise<GatewayConfig> {
  const normalized = normalizeConfig(config);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function resetGatewayConfig(): Promise<GatewayConfig> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  return DEFAULT_GATEWAY_CONFIG;
}

export function redactToken(token: string): string {
  if (!token) return '未配置';
  if (token.length <= 8) return `${token.slice(0, 2)}***${token.slice(-2)}`;
  return `${token.slice(0, 4)}***${token.slice(-4)}`;
}
