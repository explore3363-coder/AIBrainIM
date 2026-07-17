/**
 * ReleaseStatusCard — AI协作平台上线准备状态卡片
 * 显示提测收口进度、阻塞项清单、首个 Build 动作状态
 * 从 ProfileScreen 的"🚀 上线准备"区块提取为共享组件
 */
import React, {useCallback, useMemo} from 'react';
import {Text, View, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {C, LAYOUT} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import {
  computeReleaseReadiness,
  prioritizeReleaseChecklist,
} from '../utils/releaseReadiness';
import {
  summarizeUploadReleaseEvidence,
  mergeUploadReleaseEvidence,
  buildLatestLiveUploadTraceLine,
  hasMeaningfulLatestLiveUploadTrace,
} from '../utils/uploadReleaseEvidence';
import {
  buildReleaseClosureCopy,
  buildReleaseTriggerGateCopy,
  getReleaseActionLabel,
} from '../utils/releaseActionLabel';

const styles = StyleSheet.create({
  card: {
    marginHorizontal: LAYOUT.pageMargin,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderActive,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(96,96,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {fontSize: 22},
  headerText: {flex: 1},
  title: {color: C.textTitle, fontSize: 16, fontWeight: '800'},
  versionTag: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  versionText: {color: C.textMuted, fontSize: 12},
  versionSep: {width: 1, height: 10, backgroundColor: C.borderSubtle},
  buildText: {color: C.textMuted, fontSize: 12},
  progressText: {color: C.textMuted, fontSize: 12, marginTop: 4},
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {fontSize: 13, fontWeight: '800'},
  desc: {
    color: C.textBody,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  snapshotRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 8,
  },
  snapshotCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingVertical: 10,
    alignItems: 'center',
  },
  snapshotValue: {color: C.textTitle, fontSize: 20, fontWeight: '900'},
  snapshotLabel: {color: C.textMuted, fontSize: 11, marginTop: 3},
  checklist: {paddingHorizontal: 14, marginBottom: 12},
  checkItem: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6},
  checkIcon: {fontSize: 13, width: 16},
  checkText: {color: C.textBody, fontSize: 13, flex: 1, lineHeight: 18},
  checkTextPending: {color: C.textMuted},
  focusBox: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  focusTitle: {color: C.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6},
  focusText: {color: C.textBody, fontSize: 12, lineHeight: 18},
  buildGateOk: {color: '#34d399', fontSize: 12, lineHeight: 18, fontWeight: '800'},
  buildGateWarn: {color: '#fbbf24', fontSize: 12, lineHeight: 18, fontWeight: '800'},
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  btnPrimaryText: {color: '#fff', fontWeight: '900', fontSize: 14},
});

export function ReleaseStatusCard() {
  const {
    uploads,
    runtimeMode,
    pendingConfirmations,
    tasks,
    dispatches,
    agents,
    gatewayConfigValid,
    gatewayWarningCount,
    preflightReportGeneratedAt,
    applePrerequisitesReady,
    firstTestFlightBuildUploaded,
    appStoreAssetsReady,
    appStoreAssetsValidatedAt,
    appleReleaseSummary,
    appleReleaseSource,
    appleReleaseValidatedAt,
    preflightOverallStatus,
    preflightBlockingCount,
    preflightFailedChecks,
    preflightNextActions,
    appleMissingInputs,
    triggerTagName,
    triggerGateReady,
    triggerGateFailures,
    releaseActiveUploads,
    releaseCompletedUploads,
    releaseLiveCompletedUploads,
    releaseSimulatedCompletedUploads,
    releaseLiveDispatchedOnlyUploads,
    releaseLatestLiveUploadCompletedAt,
    releaseLatestLiveUpload,
    releaseUploadEvidenceSummary,
    appleValidationDetail,
    assetsValidationDetail,
    preflightValidationDetail,
  } = useAppContext();

  const safeUploads = useMemo(() => (Array.isArray(uploads) ? uploads : []), [uploads]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const safeDispatches = useMemo(() => (Array.isArray(dispatches) ? dispatches : []), [dispatches]);
  const safeAgents = useMemo(() => (Array.isArray(agents) ? agents : []), [agents]);
  const safeAppleMissingInputs = useMemo(
    () => (Array.isArray(appleMissingInputs) ? appleMissingInputs : []),
    [appleMissingInputs],
  );

  const uploadEvidence = useMemo(() => mergeUploadReleaseEvidence(
    summarizeUploadReleaseEvidence(safeUploads),
    {
      activeUploads: releaseActiveUploads,
      completedUploads: releaseCompletedUploads,
      liveCompletedUploads: releaseLiveCompletedUploads,
      simulatedCompletedUploads: releaseSimulatedCompletedUploads,
      liveDispatchedOnlyUploads: releaseLiveDispatchedOnlyUploads,
      latestLiveUploadCompletedAt: releaseLatestLiveUploadCompletedAt,
      latestLiveUpload: releaseLatestLiveUpload,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [releaseActiveUploads, releaseCompletedUploads, releaseLiveCompletedUploads,
      releaseLatestLiveUploadCompletedAt, releaseLiveDispatchedOnlyUploads,
      releaseSimulatedCompletedUploads, releaseLatestLiveUpload, safeUploads]);

  const latestLiveUploadCompletedAt = uploadEvidence.latestLiveUploadCompletedAt;
  const latestLiveUploadTraceLine = useMemo(
    () => buildLatestLiveUploadTraceLine(uploadEvidence),
    [uploadEvidence],
  );
  const hasMeaningfulLatestLiveTrace = useMemo(
    () => hasMeaningfulLatestLiveUploadTrace(uploadEvidence),
    [uploadEvidence],
  );

  const releaseSignals = useMemo(() => computeReleaseReadiness({
    runtimeMode,
    pendingConfirmations,
    tasks: safeTasks,
    dispatches: safeDispatches,
    activeUploads: uploadEvidence.activeUploads,
    completedUploads: uploadEvidence.completedUploads,
    liveCompletedUploads: uploadEvidence.liveCompletedUploads,
    liveDispatchedOnlyUploads: uploadEvidence.liveDispatchedOnlyUploads,
    latestLiveUploadCompletedAt,
    latestLiveUpload: uploadEvidence.latestLiveUpload,
    applePrerequisitesReady,
    firstTestFlightBuildUploaded,
    appStoreAssetsReady,
    appStoreAssetsValidatedAt,
    appleValidatedAt: appleReleaseValidatedAt,
    gatewayConfigValid,
    gatewayWarningCount,
    appleMissingInputs: safeAppleMissingInputs,
    preflightOverallStatus,
    preflightBlockingCount,
    preflightFailedChecks,
    preflightReportGeneratedAt,
    triggerTagName,
    triggerGateReady,
    triggerGateFailures,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [runtimeMode, pendingConfirmations, safeTasks, safeDispatches, uploadEvidence,
      applePrerequisitesReady, firstTestFlightBuildUploaded, appStoreAssetsReady,
      appStoreAssetsValidatedAt, appleReleaseValidatedAt, gatewayConfigValid,
      gatewayWarningCount, safeAppleMissingInputs, preflightOverallStatus,
      preflightBlockingCount, preflightFailedChecks, preflightReportGeneratedAt,
      triggerTagName, triggerGateReady, triggerGateFailures]);

  const readinessChecklist = useMemo(
    () => prioritizeReleaseChecklist(releaseSignals.checklist),
    [releaseSignals.checklist],
  );

  const releaseClosureCopy = useMemo(() => buildReleaseClosureCopy({
    target: releaseSignals.primaryNextTarget,
    fallbackLabel: releaseSignals.primaryNextLabel,
    primaryNextAction: releaseSignals.primaryNextAction,
    primaryGap: releaseSignals.buildGatePrimaryGap ?? releaseSignals.triggerGatePrimaryGap,
    primaryGapDetail: releaseSignals.buildGatePrimaryGapDetail ?? releaseSignals.triggerGatePrimaryGapDetail,
    command: releaseSignals.testFlightTriggerCommand,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [releaseSignals]);

  const releaseTriggerGateCopy = useMemo(() => buildReleaseTriggerGateCopy({
    summary: releaseSignals.triggerGateSummary,
    primaryGap: releaseSignals.triggerGatePrimaryGap,
    primaryGapDetail: releaseSignals.triggerGatePrimaryGapDetail,
    detail: releaseSignals.triggerGateDetail,
    pendingCount: releaseSignals.triggerGatePendingCount,
    totalCount: releaseSignals.triggerGateChecklist.length,
    responsibilitySummary: releaseSignals.triggerGateResponsibilitySummary,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [releaseSignals]);

  const runningTasks = safeTasks.filter(t => t.state === 'running').length;
  const doneTasks = safeTasks.filter(t => t.state === 'done').length;
  const dispatchInFlight = safeDispatches.filter(d => d.status !== 'completed' && d.status !== 'failed').length;

  const handleShowAppStoreGuide = useCallback(() => {
    Alert.alert(
      '📋 App Store 上线清单',
      [
        `当前判定：${releaseSignals.readiness} · ${releaseSignals.doneCount}/${releaseSignals.totalCount}`,
        releaseSignals.readinessDesc,
        '',
        '运行态收口：',
        ...(releaseSignals.blockers.length
          ? releaseSignals.blockers.map((item, index) => `${index + 1}. ${item}`)
          : ['1. 运行态主闭环已收口，可转入 Apple 物料准备']),
        '',
        'Apple 链路：',
        '1. Apple Developer 账号（$99/年）',
        '2. App Store Connect → 创建 App（Bundle ID: com.openclaw.aibrainim）',
        '3. 上传已生成的 App Icon 与三尺寸截图',
        '4. 创建 App Store Connect API Key',
        '5. 配置 GitHub Variables / Secrets',
        '6. 填写隐私信息、年龄分级、支持链接',
        '7. 运行: npm run preflight:testflight',
        '8. 通过后运行: npm run trigger:testflight',
        '9. GitHub Actions 自动构建并上传 TestFlight',
        '10. App Store Connect → TestFlight → 添加测试人员',
      ].join('\n'),
      [{text: '知道了'}],
    );
  }, [releaseSignals]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🚀</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>AI协作平台</Text>
          <View style={styles.versionTag}>
            <Text style={styles.versionText}>v0.1.0 · build 1</Text>
            <View style={styles.versionSep} />
            <Text style={styles.buildText}>AIBrainIM / Alpha</Text>
          </View>
          <Text style={styles.progressText}>提测收口进度 {releaseSignals.doneCount}/{releaseSignals.totalCount}</Text>
        </View>
        <View style={[styles.badge, {
          backgroundColor: releaseSignals.readinessAccent + '22',
          borderColor: releaseSignals.readinessAccent + '55',
        }]}>
          <Text style={[styles.badgeText, {color: releaseSignals.readinessAccent}]}>
            {releaseSignals.readiness}
          </Text>
        </View>
      </View>

      <Text style={styles.desc}>{releaseSignals.readinessDesc}</Text>

      <View style={styles.snapshotRow}>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotValue}>{runningTasks}</Text>
          <Text style={styles.snapshotLabel}>执行中任务</Text>
        </View>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotValue}>{doneTasks}</Text>
          <Text style={styles.snapshotLabel}>已收口任务</Text>
        </View>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotValue}>{dispatchInFlight}</Text>
          <Text style={styles.snapshotLabel}>推进中调度</Text>
        </View>
      </View>

      <View style={styles.checklist}>
        {readinessChecklist.slice(0, 5).map((item, i) => (
          <View key={i} style={styles.checkItem}>
            <Text style={[styles.checkIcon, {color: item.done ? '#34d399' : C.textMuted}]}>
              {item.done ? '✅' : '⬜'}
            </Text>
            <Text style={[styles.checkText, !item.done && styles.checkTextPending]}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.focusBox}>
        <Text style={styles.focusTitle}>首个 Build 动作状态</Text>
        <Text style={styles.focusText}>• {releaseSignals.launchStepLabel}</Text>
        <Text style={styles.focusText}>• {releaseSignals.launchStepDetail}</Text>
        <Text style={releaseSignals.buildReadyToTrigger ? styles.buildGateOk : styles.buildGateWarn}>
          • 触发计划：{releaseSignals.testFlightTriggerPlanLabel}
        </Text>
        <Text style={releaseSignals.triggerGateReady ? styles.buildGateOk : styles.buildGateWarn}>
          • {releaseTriggerGateCopy.summaryLine}
        </Text>
        <Text style={releaseSignals.triggerGateReady ? styles.focusText : styles.checkTextPending}>
          • {releaseTriggerGateCopy.primaryGapLine}
        </Text>
        {releaseSignals.triggerGateChecklist.slice(0, 3).map(item => (
          <Text
            key={`gate-${item.id}`}
            style={item.ready ? styles.buildGateOk : styles.buildGateWarn}>
            • {item.label}：{item.value}。{item.detail}
          </Text>
        ))}
        <Text style={releaseSignals.triggerGateReady ? styles.focusText : styles.checkTextPending}>
          • {releaseTriggerGateCopy.pendingCountLine}
        </Text>
        <Text style={releaseSignals.triggerGateReady ? styles.buildGateOk : styles.buildGateWarn}>
          • 首个 Build 三件套：{releaseSignals.buildGateSummary}
        </Text>
        <Text style={releaseSignals.buildGateReady ? styles.focusText : styles.checkTextPending}>
          • 当前主卡点：{releaseSignals.buildGatePrimaryGap ?? '三件套已闭合'}
        </Text>
        <Text style={styles.focusText}>
          • 建议命令：{releaseSignals.testFlightTriggerCommand}
        </Text>
        <Text style={releaseSignals.buildGateReady ? styles.buildGateOk : styles.buildGateWarn}>
          • {releaseClosureCopy.summaryLine}
        </Text>
        <Text style={releaseSignals.buildGateReady ? styles.focusText : styles.checkTextPending}>
          • {releaseClosureCopy.commandLine}
        </Text>
        <Text style={styles.focusText}>
          • 当前主动作：{getReleaseActionLabel(releaseSignals.primaryNextTarget, releaseSignals.primaryNextLabel, 'decorated')}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleShowAppStoreGuide} activeOpacity={0.8}>
          <Text style={styles.btnPrimaryText}>📋 App Store 准备清单</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
