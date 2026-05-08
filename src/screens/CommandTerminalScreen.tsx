/**
 * CommandTerminalScreen — 远程命令执行终端
 *
 * 通过 Gateway exec 工具在 Mac mini 上执行任意命令，
 * 实时展示输出流。用于远程调试、进程管理、文件操作等。
 */

import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  ScrollView, Text, View, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/constants';
import {gatewayInvoke} from '../data/api';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface OutputLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
  ts: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function execCommand(cmd: string, timeoutMs = 30000): Promise<{stdout: string; stderr: string; exitCode: number}> {
  const result = await gatewayInvoke('exec', 'run', {
    command: cmd,
    workdir: '/Users/zz',
    timeoutMs,
  }) as {stdout?: string; stdoutText?: string; stderr?: string; stderrText?: string; exitCode?: number} | null;
  return {
    stdout: (result?.stdout ?? result?.stdoutText ?? '').trim(),
    stderr: (result?.stderr ?? result?.stderrText ?? '').trim(),
    exitCode: typeof result?.exitCode === 'number' ? result.exitCode : 0,
  };
}

const QUICK_ACTIONS = [
  {label: 'openclaw status', cmd: 'openclaw status --json'},
  {label: 'top -l1', cmd: 'top -l1 | head -15'},
  {label: 'df -h', cmd: 'df -h /'},
  {label: 'ps aux | grep openclaw', cmd: 'ps aux | grep openclaw | grep -v grep'},
  {label: 'ls ~/actions-runner', cmd: 'ls -la ~/actions-runner 2>/dev/null || echo "目录不存在"'},
  {label: 'curl localhost:18789/health', cmd: 'curl -s localhost:18789/health'},
  {label: '上次GitHub CI日志', cmd: 'gh run list --repo explore3363-coder/AIBrainIM --limit 3 --json name,status,conclusion,updatedAt 2>/dev/null | python3 -m json.tool || echo "需配置GitHub CLI"'},
];

// ─── Main Screen ────────────────────────────────────────────────────────────────
let lineCounter = 0;

export function CommandTerminalScreen() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<OutputLine[]>([
    {id: lineCounter++, type: 'system', text: '🔗 已连接 Mac mini 西宫太子', ts: Date.now()},
    {id: lineCounter++, type: 'system', text: '💡 从下方快捷命令选择一个，或输入任意 shell 命令后回车执行', ts: Date.now()},
  ]);
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const addLine = useCallback((type: OutputLine['type'], text: string) => {
    setHistory(prev => [...prev, {id: lineCounter++, type, text, ts: Date.now()}]);
    setTimeout(() => scrollRef.current?.scrollToEnd({animated: false}), 50);
  }, []);

  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    if (running) return;

    addLine('input', `$ ${trimmed}`);
    setCmdHistory(prev => [trimmed, ...prev].slice(0, 20));
    setHistIdx(-1);
    setInput('');
    setRunning(true);

    try {
      const {stdout, stderr, exitCode} = await execCommand(trimmed, 60000);
      if (stdout) addLine('output', stdout);
      if (stderr) addLine('error', stderr);
      if (exitCode !== 0) addLine('system', `Process exited with code ${exitCode}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('aborted') || msg.includes('timeout')) {
        addLine('error', `⏱ 命令超时（60s），可能被长时间运行的进程阻塞`);
      } else {
        addLine('error', `Error: ${msg}`);
      }
    } finally {
      setRunning(false);
    }
  }, [running, addLine]);

  const onSubmit = useCallback(() => {
    if (input.trim()) void runCommand(input);
  }, [input, runCommand]);

  const onQuickAction = useCallback((cmd: string) => {
    void runCommand(cmd);
  }, [runCommand]);

  // Auto-scroll when new output arrives
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 100);
    return () => clearTimeout(t);
  }, [history]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>⌨ 命令终端</Text>
        <Text style={styles.sub}>Mac mini · 远程执行 · exec bridge</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.outputArea}
        contentContainerStyle={styles.outputContent}
      >
        {history.map(line => (
          <View key={line.id}>
            {line.type === 'input' && (
              <Text style={styles.lineInput}>{line.text}</Text>
            )}
            {line.type === 'output' && (
              <Text style={styles.lineOutput}>{line.text}</Text>
            )}
            {line.type === 'error' && (
              <Text style={styles.lineError}>{line.text}</Text>
            )}
            {line.type === 'system' && (
              <Text style={styles.lineSystem}>{line.text}</Text>
            )}
          </View>
        ))}

        {running && (
          <View style={styles.runningIndicator}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={styles.runningText}>执行中…</Text>
          </View>
        )}
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.quickArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
          {QUICK_ACTIONS.map((qa) => (
            <TouchableOpacity
              key={qa.label}
              style={styles.quickBtn}
              onPress={() => void onQuickAction(qa.cmd)}
              disabled={running}
            >
              <Text style={styles.quickBtnText}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputRow}>
          <Text style={styles.prompt}>$</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={onSubmit}
            placeholder="输入命令后回车执行…"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            blurOnSubmit={false}
            editable={!running}
          />
          <TouchableOpacity
            style={[styles.sendBtn, running && styles.sendBtnDisabled]}
            onPress={onSubmit}
            disabled={running || !input.trim()}
          >
            {running
              ? <ActivityIndicator size="small" color={C.bgRoot} />
              : <Text style={styles.sendBtnText}>▶</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bgRoot},
  header: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10},
  title: {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub: {color: C.textMuted, fontSize: 12, marginTop: 4},
  outputArea: {flex: 1, backgroundColor: '#030608'},
  outputContent: {padding: 12, paddingBottom: 20},
  lineInput: {color: C.success, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 20},
  lineOutput: {color: '#e2e8f0', fontSize: 12.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 19},
  lineError: {color: C.error, fontSize: 12.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 19},
  lineSystem: {color: C.textMuted, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 18, fontStyle: 'italic'},
  runningIndicator: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6},
  runningText: {color: C.primary, fontSize: 13},
  quickArea: {borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(8,18,36,0.6)'},
  quickScroll: {paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row'},
  quickBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)',
    marginRight: 6,
  },
  quickBtnText: {color: C.primary, fontSize: 12, fontWeight: '600'},
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: C.bgElevated,
    gap: 8,
  },
  prompt: {color: C.success, fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '900'},
  input: {
    flex: 1, color: C.textTitle, fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {width: 36, height: 36, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center'},
  sendBtnDisabled: {backgroundColor: 'rgba(56,189,248,0.3)'},
  sendBtnText: {color: C.bgRoot, fontSize: 15, fontWeight: '900'},
});
