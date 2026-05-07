import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';

import {C} from '../data/mockData';
import {gatewayInvoke, listGatewaySessions} from '../data/api';
import {useAppContext} from '../context/AppContext';
import {
  DEFAULT_GATEWAY_CONFIG,
  getGatewayConfig,
  redactToken,
  resetGatewayConfig,
  saveGatewayConfig,
  summarizeGatewayConfig,
  validateGatewayConfig,
  type GatewayConfig,
} from '../services/gatewayConfig';

const EXAMPLE_MESSAGE = 'AIBrainIM 直连会话测试';

type RootStackParamList = {
  Tabs: undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  ProjectLibrary: undefined;
  DispatchChain: undefined;
  Confirmations: undefined;
  Upload: undefined;
  GatewaySettings: undefined;
};

export function GatewaySettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {registerDispatch, refreshGatewayStatus, refresh} = useAppContext();
  const [config, setConfig] = useState<GatewayConfig>(DEFAULT_GATEWAY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [discoveringSessions, setDiscoveringSessions] = useState(false);
  const [statusText, setStatusText] = useState('尚未测试');
  const [availableSessions, setAvailableSessions] = useState<Array<{key: string; label: string; status: string}>>([]);

  const validation = validateGatewayConfig(config);
  const sessionOptions = useMemo(
    () => availableSessions.filter(item => item.key && item.key.includes('agent:')),
    [availableSessions],
  );

  useEffect(() => {
    getGatewayConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  const patch = useCallback((key: keyof GatewayConfig, value: string | boolean) => {
    setConfig(current => ({...current, [key]: value}));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await saveGatewayConfig(config);
      setConfig(saved);
      await refreshGatewayStatus();
      setStatusText('配置已保存');
      Alert.alert('已保存', 'Gateway 配置已持久化，「我的」页与运行态摘要会立即使用这组最新配置。');
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [config, refreshGatewayStatus]);

  const handleReset = useCallback(() => {
    Alert.alert('恢复默认配置', '确定恢复默认 Gateway 地址、Token 与直连 Session 吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '恢复默认',
        style: 'destructive',
        onPress: async () => {
          const restored = await resetGatewayConfig();
          setConfig(restored);
          await refreshGatewayStatus();
          setStatusText('已恢复默认配置');
        },
      },
    ]);
  }, [refreshGatewayStatus]);

  const handleDiscoverSessions = useCallback(async () => {
    setDiscoveringSessions(true);
    setStatusText('正在发现可直连会话…');
    try {
      await saveGatewayConfig(config);
      const sessions = await listGatewaySessions(config);
      const normalized = sessions
        .map(item => ({
          key: item.key ?? '',
          label: item.label ?? '未命名会话',
          status: item.status ?? 'unknown',
        }))
        .filter(item => item.key);
      setAvailableSessions(normalized);

      const directCandidates = normalized.filter(item => item.key.includes('agent:'));
      if (directCandidates.length > 0) {
        const preferred = directCandidates.find(item => item.key.includes('agent:zhuli:')) ?? directCandidates[0];
        setConfig(current => ({...current, sessionKey: preferred.key, directMode: true}));
        setStatusText(`已发现 ${directCandidates.length} 个可直连会话，默认选中 ${preferred.label}`);
      } else {
        setStatusText('已连通 Gateway，但当前没有发现可直连 agent 会话');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText(`发现失败 · ${message}`);
      Alert.alert('发现失败', message);
    } finally {
      setDiscoveringSessions(false);
    }
  }, [config]);

  const handleSelectSession = useCallback((sessionKey: string) => {
    setConfig(current => ({...current, sessionKey, directMode: true}));
    const selected = sessionOptions.find(item => item.key === sessionKey);
    setStatusText(`已选择直连会话：${selected?.label ?? sessionKey}`);
  }, [sessionOptions]);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setStatusText('测试中…');
    try {
      await saveGatewayConfig(config);
      await refreshGatewayStatus();
      const result = await gatewayInvoke('sessions_list', 'json', {}, config);
      const payload = result as {sessions?: unknown[]; content?: Array<{text?: string}>};
      const count = Array.isArray(payload?.sessions)
        ? payload.sessions.length
        : Array.isArray(payload?.content)
          ? payload.content.length
          : 0;
      const reply = `✓ Gateway 连通性测试通过：sessions_list 已返回 ${count} 条结果。`;
      await refresh();
      setStatusText(`连通成功 · sessions_list 已返回（${count} 条）`);
      registerDispatch({
        userText: `系统检查：Gateway 连通性测试（${config.gatewayUrl}）`,
        reply,
        sent: true,
        source: 'system',
      });
      Alert.alert('连通成功', 'Gateway 已可访问。测试记录已写入调度链，下一步建议发一条真实消息验证完整回流。', [
        {text: '查看调度链', onPress: () => navigation.navigate('DispatchChain')},
        {text: '继续'},
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText(`测试失败 · ${message}`);
      registerDispatch({
        userText: `系统检查：Gateway 连通性测试（${config.gatewayUrl}）`,
        reply: `⚠️ Gateway 连通性测试失败：${message}`,
        sent: false,
        source: 'system',
      });
      Alert.alert('测试失败', message, [
        {text: '查看调度链', onPress: () => navigation.navigate('DispatchChain')},
        {text: '知道了'},
      ]);
    } finally {
      setTesting(false);
    }
  }, [config, navigation, registerDispatch, refresh, refreshGatewayStatus]);

  const handleTestMessage = useCallback(async () => {
    setTesting(true);
    setStatusText(config.directMode ? '直连测试中…' : '回退消息发送中…');
    try {
      await saveGatewayConfig(config);
      await refreshGatewayStatus();
      const result = config.directMode
        ? await gatewayInvoke('sessions_send', 'json', {
            sessionKey: config.sessionKey,
            message: EXAMPLE_MESSAGE,
            timeoutSeconds: 20,
          }, config)
        : await gatewayInvoke('message', 'send', {
            channel: config.channel,
            target: config.target,
            message: EXAMPLE_MESSAGE,
          }, config);

      const payload = result as {reply?: string; runId?: string; sessionKey?: string; status?: string; messageId?: string};
      const createdAt = Date.now();
      const taskId = `gateway-msg-${createdAt.toString(36)}`;
      const dispatchId = payload.runId ?? `gateway-msg-dp-${createdAt.toString(36)}`;
      await refresh();
      setStatusText(config.directMode ? '直连会话测试成功' : '回退消息已送达');
      registerDispatch({
        userText: `系统测试消息：${EXAMPLE_MESSAGE}`,
        reply: config.directMode
          ? (payload.reply ?? '✓ 直连会话已返回回复。')
          : '✓ 测试消息已发出，当前仍走 Feishu 回退链路。',
        taskId,
        dispatchId,
        sessionKey: payload.sessionKey ?? config.sessionKey,
        sent: true,
        source: 'system',
      });
      Alert.alert(config.directMode ? '直连成功' : '消息已送达', config.directMode ? 'sessions_send 已返回真实回复，App 可以直接对话 OpenClaw。' : '测试消息已发出，当前仍通过 Feishu 回退。', [
        {text: '查看调度链', onPress: () => navigation.navigate('DispatchChain')},
        {text: '继续'},
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText(`测试失败 · ${message}`);
      registerDispatch({
        userText: `系统测试消息：${EXAMPLE_MESSAGE}`,
        reply: `⚠️ 测试消息发送失败：${message}`,
        sent: false,
        source: 'system',
      });
      Alert.alert('发送失败', message, [
        {text: '查看调度链', onPress: () => navigation.navigate('DispatchChain')},
        {text: '知道了'},
      ]);
    } finally {
      setTesting(false);
    }
  }, [config, navigation, registerDispatch, refresh, refreshGatewayStatus]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>Gateway 连接配置</Text>
          <Text style={styles.sub}>先服务聊天直连。默认走 OpenClaw session 直连，Feishu 只作为回退链路保留。</Text>
          <Text style={styles.status}>当前状态：{loading ? '加载中…' : statusText}</Text>
          <Text style={styles.summary}>{loading ? '正在读取配置…' : summarizeGatewayConfig(config)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Gateway URL</Text>
          <TextInput
            value={config.gatewayUrl}
            onChangeText={value => patch('gatewayUrl', value)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://127.0.0.1:18789"
            placeholderTextColor={C.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Gateway Token</Text>
          <TextInput
            value={config.gatewayToken}
            onChangeText={value => patch('gatewayToken', value)}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="Bearer Token"
            placeholderTextColor={C.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>连接模式</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, config.directMode && styles.modeChipActive]}
              activeOpacity={0.85}
              onPress={() => patch('directMode', true)}>
              <Text style={[styles.modeChipText, config.directMode && styles.modeChipTextActive]}>直连 OpenClaw</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, !config.directMode && styles.modeChipActive]}
              activeOpacity={0.85}
              onPress={() => patch('directMode', false)}>
              <Text style={[styles.modeChipText, !config.directMode && styles.modeChipTextActive]}>Feishu 回退</Text>
            </TouchableOpacity>
          </View>

          {config.directMode ? (
            <>
              <View style={styles.sessionHeaderRow}>
                <Text style={styles.label}>目标 Session Key</Text>
                <TouchableOpacity
                  style={[styles.discoverBtn, discoveringSessions && styles.disabledBtn]}
                  activeOpacity={0.8}
                  onPress={handleDiscoverSessions}
                  disabled={discoveringSessions}
                >
                  <Text style={styles.discoverBtnText}>{discoveringSessions ? '发现中…' : '发现会话'}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={config.sessionKey}
                onChangeText={value => patch('sessionKey', value)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="agent:zhuli:feishu:direct:..."
                placeholderTextColor={C.textMuted}
                style={styles.input}
              />
              <Text style={styles.hint}>优先在 App 内发现并选择可直连会话，避免 TestFlight 真机还要手抄 sessionKey。</Text>
              {sessionOptions.length > 0 ? (
                <View style={styles.sessionList}>
                  {sessionOptions.slice(0, 8).map(item => {
                    const selected = item.key === config.sessionKey;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.sessionChip, selected && styles.sessionChipActive]}
                        activeOpacity={0.85}
                        onPress={() => handleSelectSession(item.key)}
                      >
                        <Text style={[styles.sessionChipTitle, selected && styles.sessionChipTitleActive]} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={[styles.sessionChipMeta, selected && styles.sessionChipMetaActive]} numberOfLines={1}>
                          {item.status} · {item.key}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.label}>Feishu 目标账号 / 会话</Text>
              <TextInput
                value={config.target}
                onChangeText={value => patch('target', value)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ou_xxx / chat_id"
                placeholderTextColor={C.textMuted}
                style={styles.input}
              />
              <Text style={styles.hint}>只有在直连失败或临时回退时，才继续走这条 Feishu 中转链路。</Text>
            </>
          )}

          <View style={styles.metaBox}>
            <Text style={styles.metaTitle}>配置预检</Text>
            <Text style={styles.metaLine}>Token 状态：{redactToken(config.gatewayToken)}</Text>
            <Text style={styles.metaLine}>URL：{config.gatewayUrl || '未配置'}</Text>
            <Text style={styles.metaLine}>{config.directMode ? `Session：${config.sessionKey || '未配置'}` : `目标：${config.target || '未配置'}`}</Text>
            {validation.errors.length > 0 ? validation.errors.map((item, index) => (
              <Text key={`error-${index}`} style={styles.errorText}>• {item}</Text>
            )) : <Text style={styles.successText}>• 配置字段已齐，可直接测试</Text>}
            {validation.warnings.map((item, index) => (
              <Text key={`warn-${index}`} style={styles.warnText}>• {item}</Text>
            ))}
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? '保存中…' : '保存配置'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={handleReset}>
            <Text style={styles.secondaryBtnText}>恢复默认</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsCol}>
          <TouchableOpacity style={[styles.ghostBtn, testing && styles.disabledBtn]} activeOpacity={0.8} onPress={handleDiscoverSessions} disabled={testing || discoveringSessions}>
            <Text style={styles.ghostBtnText}>{discoveringSessions ? '发现中…' : '先发现可直连会话'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ghostBtn, (!validation.valid || testing) && styles.disabledBtn]} activeOpacity={0.8} onPress={handleTestConnection} disabled={testing || !validation.valid}>
            <Text style={styles.ghostBtnText}>{testing ? '测试中…' : '测试 Gateway 连通性'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ghostBtn, (!validation.valid || testing) && styles.disabledBtn]} activeOpacity={0.8} onPress={handleTestMessage} disabled={testing || !validation.valid}>
            <Text style={styles.ghostBtnText}>{testing ? '发送中…' : (config.directMode ? '测试直连会话' : '测试 Feishu 回退')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bgRoot},
  content: {padding: 16, paddingBottom: 80, gap: 14},
  hero: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(10,22,42,0.88)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  title: {color: C.textTitle, fontSize: 24, fontWeight: '900'},
  sub: {color: C.textBody, fontSize: 13, lineHeight: 20, marginTop: 8},
  status: {color: C.primary, fontSize: 12, marginTop: 10, fontWeight: '700'},
  summary: {color: C.textMuted, fontSize: 11, marginTop: 6, lineHeight: 17},
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  label: {color: C.textTitle, fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 6},
  input: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.textTitle,
    backgroundColor: 'rgba(5,13,26,0.9)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    fontSize: 13,
  },
  hint: {color: C.textMuted, fontSize: 11, lineHeight: 17, marginTop: 12},
  modeRow: {flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 4},
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  discoverBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: C.accent,
  },
  discoverBtnText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  sessionList: {
    marginTop: 10,
    gap: 8,
  },
  sessionChip: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(8,15,30,0.65)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  sessionChipActive: {
    borderColor: C.primary,
    backgroundColor: 'rgba(56,100,200,0.16)',
  },
  sessionChipTitle: {
    color: C.textTitle,
    fontSize: 12,
    fontWeight: '800',
  },
  sessionChipTitleActive: {
    color: C.primary,
  },
  sessionChipMeta: {
    color: C.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },
  sessionChipMetaActive: {
    color: C.textBody,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    backgroundColor: 'rgba(5,13,26,0.9)',
    alignItems: 'center',
  },
  modeChipActive: {
    borderColor: C.primary,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  modeChipText: {color: C.textBody, fontSize: 12, fontWeight: '700'},
  modeChipTextActive: {color: C.primary},
  metaBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(8,15,30,0.65)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 4,
  },
  metaTitle: {color: C.textTitle, fontSize: 12, fontWeight: '800', marginBottom: 2},
  metaLine: {color: C.textBody, fontSize: 11, lineHeight: 16},
  errorText: {color: '#f87171', fontSize: 11, lineHeight: 16},
  warnText: {color: '#fbbf24', fontSize: 11, lineHeight: 16},
  successText: {color: '#34d399', fontSize: 11, lineHeight: 16},
  actionsRow: {flexDirection: 'row', gap: 10},
  actionsCol: {gap: 10},
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  primaryBtnText: {color: C.bgRoot, fontSize: 13, fontWeight: '900'},
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
    alignItems: 'center',
  },
  secondaryBtnText: {color: '#f97316', fontSize: 13, fontWeight: '800'},
  ghostBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderActive,
    backgroundColor: 'rgba(56,100,200,0.1)',
    alignItems: 'center',
  },
  ghostBtnText: {color: C.primary, fontSize: 13, fontWeight: '800'},
  disabledBtn: {opacity: 0.45},
});
