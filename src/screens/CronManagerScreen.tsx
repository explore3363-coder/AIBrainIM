/**
 * CronManagerScreen — 定时任务管理
 *
 * 通过 Gateway exec 调用 openclaw cron list/enable/disable/rm/add，
 * 管理 Mac mini 上的所有定时任务。
 */

import React, {useState, useCallback, useRef} from 'react';
import {
  ScrollView, Text, View, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/constants';
import {gatewayInvoke} from '../data/api';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CronJob {
  id: string;
  name: string;
  schedule: string;
  nextRun: string;
  enabled: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'failed' | 'running';
  lastDuration?: string;
}

type CronStatus = 'idle' | 'loading' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function runCronCommand(args: string[]): Promise<string> {
  const result = await gatewayInvoke('exec', 'run', {
    command: ['openclaw', ...args].join(' '),
    timeoutMs: 15000,
  }) as {stdout?: string; stdoutText?: string} | null;
  return (result?.stdout ?? result?.stdoutText ?? '').trim();
}

function parseCronList(raw: string): CronJob[] {
  // openclaw cron list 输出格式可能是 JSON 或文本
  // 尝试 JSON 解析
  try {
    const lines = raw.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed)) {
          return parsed.map((j: Record<string, unknown>, i: number) => ({
            id: String(j.id ?? `job-${i}`),
            name: String(j.name ?? j.label ?? `任务 ${i + 1}`),
            schedule: String(j.schedule ?? j.cron ?? j.interval ?? '—'),
            nextRun: String(j.next ?? j.nextRun ?? '—'),
            enabled: j.enabled !== false && j.status !== 'disabled',
            lastRun: j.lastRun ? String(j.lastRun) : undefined,
            lastStatus: j.lastStatus ? String(j.lastStatus) as CronJob['lastStatus'] : undefined,
            lastDuration: j.duration ? String(j.duration) : undefined,
          }));
        }
      } catch { /* not JSON */ }
    }
  } catch { /* no output */ }

  // Fallback: parse plain text
  const jobs: CronJob[] = [];
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('='));
  const jobLines = lines.filter(l => l.includes('│') || l.match(/\S+\s+\S+\s+\S+\s+\S+/));
  for (const line of jobLines) {
    const cols = line.split(/\s*[│]\s*/).map(c => c.trim()).filter(Boolean);
    if (cols.length >= 3) {
      jobs.push({
        id: cols[0] ?? `job-${jobs.length}`,
        name: cols[1] ?? '未知任务',
        schedule: cols[2] ?? '—',
        nextRun: cols[3] ?? '—',
        enabled: !line.includes('disabled') && !line.includes('❌'),
      });
    }
  }
  return jobs;
}

// ─── Main Screen ────────────────────────────────────────────────────────────────
export function CronManagerScreen() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [status, setStatus] = useState<CronStatus>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCron, setAddCron] = useState('');
  const [addMessage, setAddMessage] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    setError(null);
    try {
      const raw = await runCronCommand(['cron', 'list', '--json']);
      const parsed = parseCronList(raw);
      setJobs(parsed);
      setStatus('idle');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '获取失败';
      setError(msg);
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { void fetchJobs(false); }, [fetchJobs]);

  const onRefresh = useCallback(() => { void fetchJobs(true); }, [fetchJobs]);

  const toggleJob = useCallback(async (job: CronJob) => {
    setActionLoading(job.id);
    try {
      const cmd = job.enabled ? ['cron', 'disable', job.id] : ['cron', 'enable', job.id];
      await runCronCommand(cmd);
      setJobs(prev => prev.map(j => j.id === job.id ? {...j, enabled: !j.enabled} : j));
    } catch {
      Alert.alert('操作失败', `无法${job.enabled ? '禁用' : '启用'}该任务`);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const deleteJob = useCallback(async (job: CronJob) => {
    Alert.alert('确认删除', `删除定时任务「${job.name}」？`, [
      {text: '取消', style: 'cancel'},
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          setActionLoading(job.id);
          try {
            await runCronCommand(['cron', 'rm', job.id]);
            setJobs(prev => prev.filter(j => j.id !== job.id));
          } catch {
            Alert.alert('删除失败', '无法删除该定时任务');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }, []);

  const runNow = useCallback(async (job: CronJob) => {
    setActionLoading(job.id);
    try {
      await runCronCommand(['cron', 'run', job.id]);
      Alert.alert('已触发', `「${job.name}」已开始执行`);
    } catch {
      Alert.alert('触发失败', '无法立即运行该任务');
    } finally {
      setActionLoading(null);
    }
  }, []);

  const addJob = useCallback(async () => {
    if (!addName.trim() || !addCron.trim()) {
      Alert.alert('缺少必填项', '请填写任务名称和 cron 表达式');
      return;
    }
    setAddLoading(true);
    try {
      await runCronCommand([
        'cron', 'add', addName.trim(),
        '--schedule', addCron.trim(),
        '--message', addMessage.trim() || `手动创建：${addName.trim()}`,
      ]);
      setShowAdd(false);
      setAddName(''); setAddCron(''); setAddMessage('');
      void fetchJobs(true);
    } catch {
      Alert.alert('创建失败', '无法创建定时任务，请检查 cron 表达式是否合法');
    } finally {
      setAddLoading(false);
    }
  }, [addName, addCron, addMessage, fetchJobs]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>⏰ 定时任务</Text>
        <Text style={styles.sub}>Mac mini · openclaw cron</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* Status Bar */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, status === 'idle' && styles.dotGreen, status === 'loading' && styles.dotYellow, status === 'error' && styles.dotRed]} />
          <Text style={styles.statusText}>
            {status === 'idle' ? `${jobs.length} 个定时任务` : status === 'loading' ? '加载中…' : '获取失败'}
          </Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>+ 新建</Text>
          </TouchableOpacity>
        </View>

        {status === 'loading' && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        )}

        {error && !jobs.length && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchJobs(false)}>
              <Text style={styles.retryBtnText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Job List */}
        {jobs.map(job => (
          <View key={job.id} style={styles.jobCard}>
            <View style={styles.jobTop}>
              <View style={styles.jobInfo}>
                <Text style={styles.jobName}>{job.name}</Text>
                <Text style={styles.jobSchedule}>🕐 {job.schedule}</Text>
                <Text style={styles.jobNext}>→ {job.nextRun}</Text>
              </View>
              <View style={[styles.enableBadge, job.enabled ? styles.badgeEnabled : styles.badgeDisabled]}>
                <Text style={[styles.badgeText, job.enabled ? styles.badgeTextEnabled : styles.badgeTextDisabled]}>
                  {job.enabled ? '启用' : '禁用'}
                </Text>
              </View>
            </View>

            {job.lastRun && (
              <View style={styles.jobMeta}>
                <Text style={styles.metaText}>
                  上次：{job.lastRun}
                  {job.lastDuration ? ` · ${job.lastDuration}` : ''}
                  {job.lastStatus ? ` · ${job.lastStatus === 'success' ? '✅' : job.lastStatus === 'failed' ? '❌' : '⏳'}` : ''}
                </Text>
              </View>
            )}

            <View style={styles.jobActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={() => void runNow(job)}
                disabled={actionLoading === job.id}
              >
                <Text style={styles.actionPrimaryText}>▶ 立即运行</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, job.enabled ? styles.actionWarn : styles.actionSuccess]}
                onPress={() => void toggleJob(job)}
                disabled={actionLoading === job.id}
              >
                <Text style={styles.actionWarnText}>{job.enabled ? '⏸ 暂停' : '▶ 启用'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDanger]}
                onPress={() => void deleteJob(job)}
                disabled={actionLoading === job.id}
              >
                <Text style={styles.actionDangerText}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {status === 'idle' && jobs.length === 0 && !error && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⏰</Text>
            <Text style={styles.emptyTitle}>暂无定时任务</Text>
            <Text style={styles.emptyDesc}>点击右上角「新建」创建第一个定时任务</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Job Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.sheetTitle}>新建定时任务</Text>

            <Text style={modalStyles.fieldLabel}>任务名称 *</Text>
            <TextInput style={modalStyles.input} value={addName} onChangeText={setAddName} placeholder="例如：每日钨价播报" placeholderTextColor={C.textMuted} />

            <Text style={modalStyles.fieldLabel}>Cron 表达式 *</Text>
            <TextInput style={modalStyles.input} value={addCron} onChangeText={setAddCron} placeholder="0 8 * * * (每天08:00)" placeholderTextColor={C.textMuted} autoCapitalize="none" />
            <Text style={modalStyles.hint}>格式：分 时 日 月 周{'\n'}例：0 8 * * * = 每天08:00</Text>

            <Text style={modalStyles.fieldLabel}>任务指令</Text>
            <TextInput style={[modalStyles.input, modalStyles.inputMultiline]} value={addMessage} onChangeText={setAddMessage} placeholder="告诉用户今日钨价动态" placeholderTextColor={C.textMuted} multiline numberOfLines={3} />

            <View style={modalStyles.btnRow}>
              <TouchableOpacity style={modalStyles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={modalStyles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modalStyles.confirmBtn} onPress={() => void addJob()} disabled={addLoading}>
                {addLoading
                  ? <ActivityIndicator size="small" color={C.bgRoot} />
                  : <Text style={modalStyles.confirmBtnText}>创建</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bgRoot},
  header: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  title: {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub: {color: C.textMuted, fontSize: 12, marginTop: 4},
  content: {padding: 16, paddingBottom: 100},
  statusRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8},
  statusDot: {width: 8, height: 8, borderRadius: 4},
  dotGreen: {backgroundColor: C.success},
  dotYellow: {backgroundColor: C.warning},
  dotRed: {backgroundColor: C.error},
  statusText: {flex: 1, color: C.textMuted, fontSize: 13},
  addBtn: {paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.primary, borderRadius: 999},
  addBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 13},
  centerState: {alignItems: 'center', paddingVertical: 48},
  errorBox: {padding: 16, borderRadius: 14, backgroundColor: `${C.error}15`, borderWidth: 1, borderColor: `${C.error}40`, marginBottom: 12},
  errorText: {color: C.error, fontSize: 13},
  retryBtn: {marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.error, borderRadius: 999},
  retryBtnText: {color: '#fff', fontWeight: '900', fontSize: 12},
  jobCard: {
    padding: 14, borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
  },
  jobTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  jobInfo: {flex: 1},
  jobName: {color: C.textTitle, fontSize: 15, fontWeight: '900'},
  jobSchedule: {color: C.primary, fontSize: 12, marginTop: 4},
  jobNext: {color: C.textMuted, fontSize: 12, marginTop: 2},
  jobMeta: {marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)'},
  metaText: {color: C.textMuted, fontSize: 12},
  enableBadge: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1},
  badgeEnabled: {borderColor: C.success, backgroundColor: `${C.success}22`},
  badgeDisabled: {borderColor: C.textMuted, backgroundColor: 'rgba(255,255,255,0.06)'},
  badgeText: {fontSize: 11, fontWeight: '900'},
  badgeTextEnabled: {color: C.success},
  badgeTextDisabled: {color: C.textMuted},
  jobActions: {flexDirection: 'row', gap: 8, marginTop: 10},
  actionBtn: {flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1},
  actionPrimary: {backgroundColor: `${C.primary}22`, borderColor: C.primary},
  actionPrimaryText: {color: C.primary, fontWeight: '800', fontSize: 12},
  actionWarn: {backgroundColor: `${C.warning}22`, borderColor: C.warning},
  actionWarnText: {color: C.warning, fontWeight: '800', fontSize: 12},
  actionSuccess: {backgroundColor: `${C.success}22`, borderColor: C.success},
  actionDanger: {flex: 0, paddingHorizontal: 14, backgroundColor: `${C.error}22`, borderColor: `${C.error}60`},
  actionDangerText: {color: C.error, fontWeight: '800', fontSize: 12},
  emptyState: {alignItems: 'center', paddingVertical: 48},
  emptyIcon: {fontSize: 48},
  emptyTitle: {color: C.textTitle, fontSize: 18, fontWeight: '900', marginTop: 12},
  emptyDesc: {color: C.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center'},
});

const modalStyles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: C.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
  },
  sheetTitle: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginBottom: 20, textAlign: 'center'},
  fieldLabel: {color: C.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, marginTop: 12},
  input: {
    backgroundColor: 'rgba(8,18,36,0.8)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 11,
    color: C.textTitle, fontSize: 15,
  },
  inputMultiline: {minHeight: 80, textAlignVertical: 'top', paddingTop: 11},
  hint: {color: C.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16},
  btnRow: {flexDirection: 'row', gap: 12, marginTop: 20},
  cancelBtn: {flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)'},
  cancelBtnText: {color: C.textMuted, fontWeight: '800', fontSize: 15},
  confirmBtn: {flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: C.primary},
  confirmBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 15},
});
