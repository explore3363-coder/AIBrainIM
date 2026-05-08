/**
 * SystemStatusScreen — Mac mini 实时状态
 *
 * 通过 Gateway exec 工具在 Mac mini 本地执行系统命令，
 * 展示 CPU / 内存 / 磁盘 / 服务状态。
 *
 * 数据流向：
 *   用户打开页面 → refresh() → gatewayInvoke(exec) → Mac mini 本地命令 → 解析 → UI
 */

import React, {useState, useCallback, useRef} from 'react';
import {
  ScrollView, Text, View, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/constants';
import {gatewayInvoke} from '../data/api';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SystemStatus {
  hostname: string;
  model: string;
  osVersion: string;
  uptime: string;
  cpuBrand: string;
  cpuCores: number;
  loadAvg: string[];
  memoryTotal: number;  // GB
  memoryUsed: number;    // GB
  memoryPct: number;     // 0-100
  diskTotal: number;    // GB
  diskUsed: number;     // GB
  diskFree: number;     // GB
  diskPct: number;      // 0-100
  openclawPID: number | null;
  openclawVersion: string;
  openclawStatus: 'running' | 'stopped' | 'unknown';
  lastUpdated: number;
  rawOutput?: string;
}

interface ProcessEntry {
  name: string;
  pid: number;
  cpuPct: number;
  memMB: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
async function runSysCommand(cmd: string): Promise<string> {
  const result = await gatewayInvoke('exec', 'run', {
    command: cmd,
    timeoutMs: 10000,
  }) as {stdout?: string; stdoutText?: string} | null;
  return (result?.stdout ?? result?.stdoutText ?? '').trim();
}

function parseUptime(uptimeStr: string): string {
  // macOS uptime: "up 3 days, 14:22"
  return uptimeStr.replace('up ', '').trim();
}

function MemoryBar({pct}: {pct: number}) {
  const color = pct > 85 ? C.error : pct > 65 ? C.warning : C.success;
  return (
    <View style={memStyles.barTrack}>
      <View style={[memStyles.barFill, {width: `${Math.min(pct, 100)}%`, backgroundColor: color}]} />
    </View>
  );
}

const memStyles = StyleSheet.create({
  barTrack: {height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 4},
  barFill: {height: '100%', borderRadius: 3},
});

function MetricCard({label, value, unit, accent}: {
  label: string; value: string | number; unit?: string; accent?: string;
}) {
  return (
    <View style={cardStyles.metricCard}>
      <Text style={cardStyles.metricLabel}>{label}</Text>
      <Text style={[cardStyles.metricValue, accent ? {color: accent} : null]}>
        {value}{unit ? <Text style={cardStyles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(8,18,36,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minWidth: 80,
  },
  metricLabel: {color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5},
  metricValue: {color: C.textTitle, fontSize: 16, fontWeight: '900', marginTop: 4},
  metricUnit: {fontSize: 11, fontWeight: '400'},
});

// ─── Main Screen ────────────────────────────────────────────────────────────────
export function SystemStatusScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<{CronManager: undefined; Terminal: undefined}>>();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [processes, setProcesses] = useState<ProcessEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUpdatedRef = useRef<number>(0);

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [sysout, procout] = await Promise.all([
        runSysCommand(
          `hostname && sw_vers -productVersion && uptime && ` +
          `sysctl -n machdep.cpu.brand_string && sysctl -n hw.ncpu && ` +
          `echo "MEM:$(vm_stat | grep "Pages active" | awk '{gsub(/[A-Za-z: ]/,""); print}')" && ` +
          `echo "WIRED:$(vm_stat | grep "Pages wired" | awk '{gsub(/[A-Za-z: ]/,""); print}')" && ` +
          `echo "COMP:$(vm_stat | grep "Pages compressed" | awk '{gsub(/[A-Za-z: ]/,""); print}')" && ` +
          `sysctl -n hw.memsize && ` +
          `df -g / | tail -1 | awk '{print $2","$3","$4","$5}' && ` +
          `echo "OCPID:$(pgrep -f openclaw | head -1)" && ` +
          `openclaw --version 2>/dev/null | head -1 | awk '{print $2}' || echo "nostatus"`
        ),
        runSysCommand('ps aux --sort=-%cpu | head -9 | tail -8 | awk \'{print $11","$2","$3","$4}\''),
      ]);

      const lines = sysout.split('\n').map(l => l.trim()).filter(Boolean);
      let idx = 0;
      const get = () => lines[idx++] ?? '';

      const hostname = get();
      const osVersion = get();
      const uptime = parseUptime(get());
      const cpuBrand = get();
      const cpuCores = parseInt(get(), 10) || 8;
      const loadAvg = uptime; // reuse
      const memPagesActive = parseInt(get().replace('MEM:',''), 10) || 0;
      const memPagesWired = parseInt(get().replace('WIRED:',''), 10) || 0;
      const memPagesComp = parseInt(get().replace('COMP:',''), 10) || 0;
      const memTotalBytes = parseInt(get(), 10) || 0;
      const memTotal = Math.round(memTotalBytes / 1024 / 1024 / 1024 * 10) / 10;
      const memUsed = Math.round((memPagesActive + memPagesWired + memPagesComp) * 4096 / 1024 / 1024 / 1024 * 10) / 10;
      const memPct = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;
      const diskLine = get().replace(',', ' ').split(/\s+/);
      const diskTotal = parseInt(diskLine[0] ?? '0', 10) || 0;
      const diskUsed = parseInt(diskLine[1] ?? '0', 10) || 0;
      const diskFree = parseInt(diskLine[2] ?? '0', 10) || 0;
      const diskPct = parseInt((diskLine[3] ?? '0').replace('%',''), 10) || 0;
      const ocPID = get().replace('OCPID:','') || '';
      const ocVer = get() || 'unknown';

      const parsedProcs: ProcessEntry[] = procout.split('\n').filter(Boolean).map(line => {
        const [name, pid, cpu, mem] = line.split(',');
        return {name: (name ?? '').split('/').pop() ?? name ?? '', pid: parseInt(pid ?? '0', 10), cpuPct: parseFloat(cpu ?? '0'), memMB: Math.round(parseFloat(mem ?? '0'))};
      }).filter(p => p.pid > 0);

      setProcesses(parsedProcs);
      setStatus({
        hostname, model: '', osVersion, uptime, cpuBrand, cpuCores,
        loadAvg: [loadAvg], memoryTotal: memTotal, memoryUsed: memUsed, memoryPct: memPct,
        diskTotal, diskUsed, diskFree: diskFree, diskPct: diskPct,
        openclawPID: ocPID ? parseInt(ocPID, 10) : null,
        openclawVersion: ocVer, openclawStatus: ocPID ? 'running' : 'stopped',
        lastUpdated: Date.now(),
        rawOutput: sysout,
      });
      lastUpdatedRef.current = Date.now();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '获取失败';
      setError(msg.includes('fetch') ? 'Gateway 未连接或 Mac mini 不在同一网络' : msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { void fetchStatus(false); }, [fetchStatus]);

  const onRefresh = useCallback(() => { void fetchStatus(true); }, [fetchStatus]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🖥 系统状态</Text>
        <Text style={styles.sub}>Mac mini · 西宫太子 · 实时监控</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── Quick Nav ── */}
        <View style={styles.quickNavRow}>
          <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigation.navigate('CronManager')}>
            <Text style={styles.quickNavIcon}>⏰</Text>
            <Text style={styles.quickNavLabel}>定时任务</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigation.navigate('Terminal')}>
            <Text style={styles.quickNavIcon}>⌨</Text>
            <Text style={styles.quickNavLabel}>命令终端</Text>
          </TouchableOpacity>
        </View>

        {/* ── OpenClaw Service ── */}
        {status && (
          <View style={styles.serviceRow}>
            <View style={styles.serviceLeft}>
              <Text style={styles.serviceName}>🦞 OpenClaw</Text>
              <Text style={styles.serviceVersion}>v{status.openclawVersion}</Text>
            </View>
            <View style={[styles.serviceBadge, status.openclawStatus === 'running' ? styles.badgeGreen : styles.badgeRed]}>
              <Text style={styles.serviceBadgeText}>
                {status.openclawStatus === 'running' ? `● PID ${status.openclawPID}` : '○ 已停止'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Loading / Error ── */}
        {loading && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>正在获取 Mac mini 状态…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>⚠️ 连接失败</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchStatus(false)}>
              <Text style={styles.retryBtnText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Status Cards ── */}
        {status && !loading && (
          <>
            {/* Host Info */}
            <View style={styles.sectionLabel}>主机信息</View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>主机名</Text>
              <Text style={styles.infoVal}>{status.hostname}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>macOS</Text>
              <Text style={styles.infoVal}>macOS {status.osVersion}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>运行时间</Text>
              <Text style={styles.infoVal}>{status.uptime}</Text>
            </View>

            {/* CPU */}
            <View style={styles.sectionLabel}>处理器</View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>型号</Text>
              <Text style={styles.infoVal} numberOfLines={2}>{status.cpuBrand}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>核心数</Text>
              <Text style={styles.infoVal}>{status.cpuCores} 核</Text>
            </View>

            {/* Memory */}
            <View style={styles.sectionLabel}>内存</View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>已用 / 总计</Text>
              <Text style={styles.infoVal}>{status.memoryUsed} / {status.memoryTotal} GB</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>使用率</Text>
              <Text style={[styles.infoVal, {color: status.memoryPct > 85 ? C.error : status.memoryPct > 65 ? C.warning : C.success}]}>
                {status.memoryPct}%
              </Text>
            </View>
            <View style={{paddingHorizontal: 4, marginBottom: 8}}>
              <MemoryBar pct={status.memoryPct} />
            </View>

            {/* Disk */}
            <View style={styles.sectionLabel}>磁盘</View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>已用 / 总计</Text>
              <Text style={styles.infoVal}>{status.diskUsed} / {status.diskTotal} GB</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>可用</Text>
              <Text style={[styles.infoVal, {color: C.success}]}>{status.diskFree} GB</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>使用率</Text>
              <Text style={[styles.infoVal, {color: status.diskPct > 90 ? C.error : status.diskPct > 75 ? C.warning : C.textTitle}]}>
                {status.diskPct}%
              </Text>
            </View>
            <View style={{paddingHorizontal: 4, marginBottom: 8}}>
              <MemoryBar pct={status.diskPct} />
            </View>

            {/* Top Processes */}
            {processes.length > 0 && (
              <>
                <View style={styles.sectionLabel}>Top 进程（CPU）</View>
                {processes.slice(0, 6).map((p) => (
                  <View key={p.pid} style={styles.processRow}>
                    <Text style={styles.processName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.processMeta}>PID {p.pid}</Text>
                    <Text style={styles.processCpu}>{p.cpuPct.toFixed(1)}%</Text>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.lastUpdated}>
              最后更新：{new Date(status.lastUpdated).toLocaleTimeString('zh-CN')}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bgRoot},
  header: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title: {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub: {color: C.textMuted, fontSize: 12, marginTop: 4},
  content: {padding: 16, paddingBottom: 100},
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 18, backgroundColor: 'rgba(8,18,36,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  serviceLeft: {flex: 1},
  serviceName: {color: C.textTitle, fontSize: 17, fontWeight: '900'},
  serviceVersion: {color: C.textMuted, fontSize: 12, marginTop: 2},
  serviceBadge: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999},
  badgeGreen: {backgroundColor: `${C.success}22`, borderWidth: 1, borderColor: C.success},
  badgeRed: {backgroundColor: `${C.error}22`, borderWidth: 1, borderColor: C.error},
  serviceBadgeText: {fontSize: 12, fontWeight: '800', color: C.textTitle},
  centerState: {alignItems: 'center', paddingVertical: 48, gap: 12},
  loadingText: {color: C.textMuted, fontSize: 14},
  errorBox: {
    padding: 16, borderRadius: 16,
    backgroundColor: `${C.error}15`, borderWidth: 1, borderColor: `${C.error}40`,
    marginBottom: 12,
  },
  errorTitle: {color: C.error, fontWeight: '900', fontSize: 15, marginBottom: 6},
  errorMsg: {color: C.textBody, fontSize: 13, lineHeight: 20},
  retryBtn: {
    marginTop: 10, alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.primary, borderRadius: 999,
  },
  retryBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 13},
  sectionLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2,
    marginTop: 12, marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(8,18,36,0.5)', borderRadius: 10, marginBottom: 2,
  },
  infoKey: {color: C.textMuted, fontSize: 13},
  infoVal: {color: C.textTitle, fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 12},
  processRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: 'rgba(8,18,36,0.4)', borderRadius: 8, marginBottom: 2,
  },
  processName: {flex: 1, color: C.textBody, fontSize: 13, fontWeight: '600'},
  processMeta: {color: C.textMuted, fontSize: 11, marginRight: 12},
  processCpu: {color: C.warning, fontSize: 13, fontWeight: '800', minWidth: 50, textAlign: 'right'},
  quickNavRow: {flexDirection: 'row', gap: 10, marginBottom: 14},
  quickNavBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', gap: 6,
  },
  quickNavIcon: {fontSize: 24},
  quickNavLabel: {color: C.textMuted, fontSize: 12, fontWeight: '700'},
  lastUpdated: {color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 16},
});
