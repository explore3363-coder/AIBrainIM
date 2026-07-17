import React, {useCallback, useMemo} from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/constants';
import {MetricCard} from '../components/MetricCard';
import {useAppContext} from '../context/AppContext';
import {
  computeReleaseReadiness,
  prioritizeReleaseChecklist,
  summarizeReleaseBlockers,
  type ReleaseActionTarget,
} from '../utils/releaseReadiness';
import {
  summarizeUploadReleaseEvidence,
  buildUploadEvidenceLine,
  mergeUploadReleaseEvidence,
  buildLatestLiveUploadTraceLine,
  hasMeaningfulLatestLiveUploadTrace,
} from '../utils/uploadReleaseEvidence';
import {buildReleaseClosureCopy, buildReleaseTriggerGateCopy, getReleaseActionLabel} from '../utils/releaseActionLabel';

type RootStackParamList = {
  Tabs: {screen?: 'Dashboard' | 'Agent' | 'Chat' | 'Tasks' | 'Profile'} | undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  ProjectLibrary: undefined;
  DispatchChain: {focusDispatchId?: string; focusTaskId?: string; focusSessionKey?: string} | undefined;
  Confirmations: {focusConfirmationId?: string; focusTaskId?: string; focusDispatchId?: string} | undefined;
  Upload: {focusFileId?: string; focusDispatchId?: string} | undefined;
  GatewaySettings: undefined;
};

interface MenuItemProps {
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  badge?: string;
}

function MenuItem({emoji, title, subtitle, accent, onPress, badge}: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.menuIcon, {backgroundColor: accent + '22', borderColor: accent + '44'}]}>
        <Text style={styles.menuEmoji}>{emoji}</Text>
      </View>
      <View style={styles.menuText}>
        <View style={styles.menuTitleRow}>
          <Text style={styles.menuTitle}>{title}</Text>
          {badge && <View style={[styles.menuBadge, {backgroundColor: accent}]}><Text style={styles.menuBadgeText}>{badge}</Text></View>}
        </View>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

function openReleaseTarget(
  target: ReleaseActionTarget,
  navigation: NativeStackNavigationProp<RootStackParamList>,
) {
  switch (target) {
    case 'gateway':
      navigation.navigate('GatewaySettings');
      return;
    case 'confirmations':
      navigation.navigate('Confirmations');
      return;
    case 'upload':
      navigation.navigate('Upload');
      return;
    case 'profile':
    default:
      navigation.navigate('Tabs', {screen: 'Profile'});
  }
}

function getUploadFocusTarget(uploads: any[], latestLiveUpload?: {id?: string; dispatchId?: string}) {
  const safeUploads = Array.isArray(uploads) ? uploads : [];
  const score = (upload: any) => {
    const executionModeScore = upload?.executionMode === 'live'
      ? 100
      : upload?.executionMode === 'simulated'
        ? 60
        : 40;
    const statusScore = upload?.status === 'done'
      ? 1000
      : upload?.status === 'dispatched'
        ? 900
        : upload?.status === 'processing'
          ? 800
          : upload?.status === 'uploading'
            ? 700
            : upload?.status === 'queued'
              ? 600
              : 0;
    const timeScore = typeof upload?.completedAt === 'number' && Number.isFinite(upload.completedAt)
      ? upload.completedAt
      : typeof upload?.updatedAt === 'number' && Number.isFinite(upload.updatedAt)
        ? upload.updatedAt
        : 0;
    return statusScore + executionModeScore + timeScore / 1_000_000_000_000;
  };

  const bestUpload = [...safeUploads]
    .filter(item => item?.id)
    .sort((a, b) => score(b) - score(a))[0];

  if (bestUpload?.id) {
    return {focusFileId: bestUpload.id, focusDispatchId: bestUpload.dispatchId};
  }

  if (latestLiveUpload?.id || latestLiveUpload?.dispatchId) {
    return {
      focusFileId: latestLiveUpload.id,
      focusDispatchId: latestLiveUpload.dispatchId,
    };
  }

  return undefined;
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    uploads,
    runtimeMode,
    runtimeError,
    lastSyncedAt,
    sessionCount,
    pendingConfirmations,
    tasks,
    dispatches,
    agents,
    gatewaySummary,
    gatewayConfigValid,
    gatewayWarningCount,
    preflightReportGeneratedAt,
    applePrerequisitesReady,
    firstTestFlightBuildUploaded,
    appStoreAssetsReady,
    appleReleaseSummary,
    appleReleaseSource,
    appleReleaseValidatedAt,
    appStoreAssetsValidatedAt,
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
    refreshing,
    refresh,
  } = useAppContext();

  const safeUploads = useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const safeAgents = useMemo(() => Array.isArray(agents) ? agents : [], [agents]);
  const safeAppleMissingInputs = useMemo(
    () => Array.isArray(appleMissingInputs) ? appleMissingInputs : [],
    [appleMissingInputs],
  );
  const safePreflightNextActions = useMemo(
    () => Array.isArray(preflightNextActions) ? preflightNextActions : [],
    [preflightNextActions],
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
  ), [
    releaseActiveUploads,
    releaseCompletedUploads,
    releaseLiveCompletedUploads,
    releaseLatestLiveUploadCompletedAt,
    releaseLiveDispatchedOnlyUploads,
    releaseSimulatedCompletedUploads,
    releaseLatestLiveUpload,
    safeUploads,
  ]);
  const activeUploads = uploadEvidence.activeUploads;
  const completedUploads = uploadEvidence.completedUploads;
  const liveCompletedUploads = uploadEvidence.liveCompletedUploads;
  const latestLiveUploadCompletedAt = uploadEvidence.latestLiveUploadCompletedAt;
  const uploadEvidenceLine = useMemo(() => buildUploadEvidenceLine(uploadEvidence), [uploadEvidence]);
  const latestLiveUploadTraceLine = useMemo(() => buildLatestLiveUploadTraceLine(uploadEvidence), [uploadEvidence]);
  const hasMeaningfulLatestLiveTrace = useMemo(() => hasMeaningfulLatestLiveUploadTrace(uploadEvidence), [uploadEvidence]);
  const uploadFocusTarget = useMemo(
    () => getUploadFocusTarget(safeUploads, uploadEvidence.latestLiveUpload),
    [safeUploads, uploadEvidence.latestLiveUpload],
  );

  const dispatchInFlight = safeDispatches.filter(item => item.status !== 'completed' && item.status !== 'failed').length;
  const memorySignals = Math.min(99, safeDispatches.length + pendingConfirmations + Math.min(safeTasks.length, 6));
  const knowledgeSignals = Math.min(99, safeAgents.length + Math.min(safeTasks.length, 8) + Math.min(safeUploads.length, 6));

  // Stats from live context — no hardcoded profileStatsMock
  const stats = useMemo(() => {
    const doneTasks = safeTasks.filter(task => task.state === 'done').length;
    const activeAgents = safeAgents.filter(a => a.status === 'online' || a.status === 'working').length;
    return {
      totalTasks: safeTasks.length,
      completedTasks: doneTasks,
      activeAgents,
      memoryEntries: memorySignals,
      knowledgeDocs: knowledgeSignals,
    };
  }, [safeTasks, safeAgents, memorySignals, knowledgeSignals]);
  const runtimeSummary = runtimeMode === 'live'
    ? `已连接 OpenClaw Gateway · ${sessionCount} 个会话 · 最近同步 ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) : '刚刚'}`
    : `当前处于本地演示运行态${runtimeError ? ` · ${runtimeError}` : ''}`;

  const runningTasks = safeTasks.filter(task => task.state === 'running').length;
  const doneTasks = safeTasks.filter(task => task.state === 'done').length;

  const releaseSignals = useMemo(() => computeReleaseReadiness({
    runtimeMode,
    pendingConfirmations,
    tasks: safeTasks,
    dispatches: safeDispatches,
    activeUploads,
    completedUploads,
    liveCompletedUploads,
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
  }), [
    activeUploads,
    applePrerequisitesReady,
    firstTestFlightBuildUploaded,
    appStoreAssetsReady,
    appStoreAssetsValidatedAt,
    appleReleaseValidatedAt,
    completedUploads,
    latestLiveUploadCompletedAt,
    liveCompletedUploads,
    uploadEvidence.latestLiveUpload,
    uploadEvidence.liveDispatchedOnlyUploads,
    safeAppleMissingInputs,
    gatewayConfigValid,
    gatewayWarningCount,
    pendingConfirmations,
    preflightBlockingCount,
    preflightFailedChecks,
    preflightReportGeneratedAt,
    triggerTagName,
    triggerGateReady,
    triggerGateFailures,
    preflightOverallStatus,
    runtimeMode,
    safeDispatches,
    safeTasks,
  ]);

  const appleReleaseMeta = useMemo(() => {
    const sourceLabel = appleReleaseSource === 'global-override'
      ? '运行态覆盖'
      : appleReleaseSource === 'generated'
        ? '仓库预检产物'
        : appleReleaseSource === 'env'
          ? '环境注入'
          : '默认未配置';

    const formatValidatedAt = (timestamp?: number) => (
      timestamp
        ? new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null
    );

    const appleValidatedLabel = formatValidatedAt(appleReleaseValidatedAt);
    const assetsValidatedLabel = formatValidatedAt(appStoreAssetsValidatedAt);
    const preflightValidatedLabel = formatValidatedAt(preflightReportGeneratedAt);
    const preflightStatusLabel = preflightOverallStatus
      ? `总预检 ${preflightOverallStatus}`
      : '总预检未记录';
    const preflightBlockingLabel = typeof preflightBlockingCount === 'number' && preflightBlockingCount > 0
      ? `阻塞 ${preflightBlockingCount}`
      : null;

    const parts = [`校验来源：${sourceLabel}`, preflightStatusLabel];
    if (preflightBlockingLabel) {
      parts.push(preflightBlockingLabel);
    }
    if (preflightValidatedLabel) {
      parts.push(`总预检 ${preflightValidatedLabel}`);
    }
    parts.push(`Apple ${appleValidatedLabel ?? '未记录'}`);
    parts.push(`素材 ${assetsValidatedLabel ?? '未记录'}`);
    return parts.join(' · ');
  }, [appleReleaseSource, appleReleaseValidatedAt, appStoreAssetsValidatedAt, preflightBlockingCount, preflightOverallStatus, preflightReportGeneratedAt]);
  const appleMissingInputLabel = useMemo(
    () => safeAppleMissingInputs.length > 0
      ? safeAppleMissingInputs.join('、')
      : '未从预检产物识别到具体缺项，请重跑 npm run sync:release-status。',
    [safeAppleMissingInputs],
  );
  const safeAppleReleaseSummary = useMemo(
    () => safeAppleMissingInputs.length > 0 && !appleReleaseSummary.includes('当前缺口：')
      ? `${appleReleaseSummary}；当前缺口：${appleMissingInputLabel}`
      : appleReleaseSummary,
    [appleMissingInputLabel, safeAppleMissingInputs.length, appleReleaseSummary],
  );
  const appleValidationDetailLabel = useMemo(
    () => appleValidationDetail?.trim() || 'Apple 预检尚未产生详细日志',
    [appleValidationDetail],
  );
  const effectiveUploadEvidenceSummary = useMemo(
    () => releaseUploadEvidenceSummary?.trim() || releaseSignals.uploadEvidenceSummary,
    [releaseSignals.uploadEvidenceSummary, releaseUploadEvidenceSummary],
  );
  const assetsValidationDetailLabel = useMemo(
    () => assetsValidationDetail?.trim() || 'App Store 素材预检尚未产生详细日志',
    [assetsValidationDetail],
  );
  const preflightValidationDetailLabel = useMemo(
    () => preflightValidationDetail?.trim() || 'TestFlight 总预检尚未产生详细报告',
    [preflightValidationDetail],
  );

  const readinessChecklist = useMemo(
    () => prioritizeReleaseChecklist(releaseSignals.checklist),
    [releaseSignals.checklist],
  );
  const releaseBlockerSummary = useMemo(
    () => summarizeReleaseBlockers(releaseSignals),
    [releaseSignals],
  );
  const latestLiveUploadDisplayLine = hasMeaningfulLatestLiveTrace && latestLiveUploadTraceLine
    ? latestLiveUploadTraceLine
    : releaseSignals.latestLiveUploadLabel;
  const releaseClosureCopy = useMemo(() => buildReleaseClosureCopy({
    target: releaseSignals.primaryNextTarget,
    fallbackLabel: releaseSignals.primaryNextLabel,
    primaryNextAction: releaseSignals.primaryNextAction,
    primaryGap: releaseSignals.buildGatePrimaryGap ?? releaseSignals.triggerGatePrimaryGap,
    primaryGapDetail: releaseSignals.buildGatePrimaryGapDetail ?? releaseSignals.triggerGatePrimaryGapDetail,
    command: releaseSignals.testFlightTriggerCommand,
  }), [
    releaseSignals.buildGatePrimaryGap,
    releaseSignals.buildGatePrimaryGapDetail,
    releaseSignals.primaryNextAction,
    releaseSignals.primaryNextLabel,
    releaseSignals.primaryNextTarget,
    releaseSignals.testFlightTriggerCommand,
    releaseSignals.triggerGatePrimaryGap,
    releaseSignals.triggerGatePrimaryGapDetail,
  ]);
  const releaseTriggerGateCopy = useMemo(() => buildReleaseTriggerGateCopy({
    summary: releaseSignals.triggerGateSummary,
    primaryGap: releaseSignals.triggerGatePrimaryGap,
    primaryGapDetail: releaseSignals.triggerGatePrimaryGapDetail,
    detail: releaseSignals.triggerGateDetail,
    pendingCount: releaseSignals.triggerGatePendingCount,
    totalCount: releaseSignals.triggerGateChecklist.length,
    responsibilitySummary: releaseSignals.triggerGateResponsibilitySummary,
  }), [
    releaseSignals.triggerGateChecklist.length,
    releaseSignals.triggerGateDetail,
    releaseSignals.triggerGatePendingCount,
    releaseSignals.triggerGatePrimaryGap,
    releaseSignals.triggerGatePrimaryGapDetail,
    releaseSignals.triggerGateResponsibilitySummary,
    releaseSignals.triggerGateSummary,
  ]);
  const appleMaterials = releaseSignals.appleMaterials;
  const readinessDoneCount = releaseSignals.doneCount;
  const readinessTotalCount = releaseSignals.totalCount;

  const handleShowAppStoreGuide = useCallback(() => {
    Alert.alert(
      '📋 App Store 上线清单',
      [
        `当前判定：${releaseSignals.readiness} · ${readinessDoneCount}/${readinessTotalCount}`,
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
        '8. 通过后运行: npm run trigger:testflight（统一安全触发入口）',
        '9. GitHub Actions 自动构建并上传 TestFlight',
        '10. App Store Connect → TestFlight → 添加测试人员',
      ].join('\n'),
      [{text: '知道了'}],
    );
  }, [readinessDoneCount, readinessTotalCount, releaseSignals.blockers, releaseSignals.readiness, releaseSignals.readinessDesc]);

  const handleJoinTestFlight = useCallback(() => {
    const body = firstTestFlightBuildUploaded
      ? '首个 TestFlight Build 已上传。请在 App Store Connect → TestFlight 中开启公开链接或添加内部测试人员，然后把链接写回发布状态。'
      : releaseSignals.buildReadyToTrigger && releaseSignals.triggerGateReady
        ? '代码侧、运行态、上传样本、Apple 校验和仓库触发门禁已经够了。下一步运行 npm run trigger:testflight；脚本会先重跑门禁，通过后再触发 v0.1.0 tag。'
        : releaseSignals.buildReadyToTrigger
          ? `代码侧、运行态、上传样本和 Apple 校验已经够了，但仓库触发门禁还没过：${releaseSignals.triggerGateDetail}。当前只建议运行 npm run preflight:testflight，不建议打 tag。`
          : `还不能加入 TestFlight。当前最先要补的是：${releaseSignals.primaryNextAction}`;

    Alert.alert(
      '加入 TestFlight',
      body,
      [
        {text: '查看上线准备', onPress: handleShowAppStoreGuide},
        {text: '好的'},
      ],
    );
  }, [firstTestFlightBuildUploaded, handleShowAppStoreGuide, releaseSignals.buildReadyToTrigger, releaseSignals.primaryNextAction, releaseSignals.triggerGateDetail, releaseSignals.triggerGateReady]);

  const handleLogout = useCallback(() => {
    Alert.alert('退出登录', '确定要退出当前账号吗?', [
      {text: '取消', style: 'cancel'},
      {text: '退出', style: 'destructive', onPress: () => {}},
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={C.primary}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>我</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>用户</Text>
            <Text style={styles.profileRole}>AI 大脑驾驶舱</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>在线</Text>
            </View>
          </View>
        </View>

        {/* 快捷入口 strip */}
        <View style={styles.quickAccessRow}>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('MemoryStore')}>
            <Text style={styles.quickAccessEmoji}>🧠</Text>
            <Text style={styles.quickAccessLabel}>记忆库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('KnowledgeBase')}>
            <Text style={styles.quickAccessEmoji}>📖</Text>
            <Text style={styles.quickAccessLabel}>知识库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('FileLibrary')}>
            <Text style={styles.quickAccessEmoji}>📎</Text>
            <Text style={styles.quickAccessLabel}>附件库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('DispatchChain')}>
            <Text style={styles.quickAccessEmoji}>🔗</Text>
            <Text style={styles.quickAccessLabel}>调度链</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <MetricCard label="总任务"     value={`${stats.totalTasks}`}     accent={C.primary} />
          <MetricCard label="已完成"     value={`${stats.completedTasks}`}  accent="#34d399" />
          <MetricCard label="活跃 Agent" value={`${stats.activeAgents}`}  accent={C.accent} />
        </View>

        <Text style={styles.sectionTitle}>🛰️ 当前运行态</Text>
        <View style={styles.runtimeBoard}>
          <View style={styles.runtimeBoardTop}>
            <View>
              <Text style={styles.runtimeBoardTitle}>OpenClaw 直连健康度</Text>
              <Text style={styles.runtimeBoardSub}>{gatewaySummary}</Text>
            </View>
            <View style={[styles.runtimeBadge, runtimeMode === 'live' ? styles.runtimeBadgeLive : styles.runtimeBadgeFallback]}>
              <Text style={[styles.runtimeBadgeText, runtimeMode === 'live' ? styles.runtimeBadgeTextLive : styles.runtimeBadgeTextFallback]}>
                {runtimeMode === 'live' ? 'LIVE' : '本地'}
              </Text>
            </View>
          </View>

          <View style={styles.runtimeGrid}>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>网关配置</Text>
              <Text style={styles.runtimeCellValue}>{gatewayConfigValid ? '可测试' : '待补全'}</Text>
              <Text style={styles.runtimeCellHint}>{gatewayWarningCount > 0 ? `${gatewayWarningCount} 个提醒` : '当前无预警'}</Text>
            </View>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>调度推进中</Text>
              <Text style={styles.runtimeCellValue}>{dispatchInFlight}</Text>
              <Text style={styles.runtimeCellHint}>直接影响首页 AI 产出流</Text>
            </View>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>待人工拍板</Text>
              <Text style={styles.runtimeCellValue}>{pendingConfirmations}</Text>
              <Text style={styles.runtimeCellHint}>不清掉就会卡住闭环</Text>
            </View>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>上传链路</Text>
              <Text style={styles.runtimeCellValue}>{activeUploads}</Text>
              <Text style={styles.runtimeCellHint}>前端上传 / 后台处理 / 回流</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>⚙️ 系统</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            emoji="🔔"
            title="需确认项"
            subtitle="待你决策的任务与问题"
            accent="#f87171"
            onPress={() => navigation.navigate('Confirmations')}
            badge={pendingConfirmations > 0 ? String(pendingConfirmations) : undefined}
          />
          <MenuItem
            emoji="📤"
            title="上传管理"
            subtitle={activeUploads > 0 ? `${activeUploads} 个文件上传/处理中` : '查看上传队列与处理状态'}
            accent={activeUploads > 0 ? C.primary : '#94a3b8'}
            onPress={() => navigation.navigate('Upload')}
            badge={activeUploads > 0 ? String(activeUploads) : undefined}
          />
          <MenuItem
            emoji="🛰️"
            title="当前可用闭环"
            subtitle="总览 / 对话 / 智能体 / 任务 / 我的 已全功能贯通"
            accent="#34d399"
            onPress={() => {}}
          />
          <MenuItem
            emoji="🌐"
            title="OpenClaw 状态"
            subtitle={runtimeSummary}
            accent={runtimeMode === 'live' ? C.primary : '#f97316'}
            onPress={() => navigation.navigate('GatewaySettings')}
            badge={runtimeMode === 'live' ? 'LIVE' : '本地'}
          />
          <MenuItem
            emoji="⚙️"
            title="Gateway 连接配置"
            subtitle="地址 / Token / 通道 / 目标账号 · 可保存可测试"
            accent={C.accent}
            onPress={() => navigation.navigate('GatewaySettings')}
          />
        </View>

        {/* 设置 */}
        <Text style={styles.sectionTitle}>🔧 设置</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            emoji="⚡"
            title="AI 模型配置"
            subtitle="选择语言模型 · 调整生成参数"
            accent="#fbbf24"
            onPress={() => navigation.navigate('GatewaySettings')}
          />
          <MenuItem
            emoji="🔊"
            title="通知与提醒"
            subtitle="任务状态变更 · AI 产出提醒"
            accent={C.primary}
            onPress={() => Alert.alert('通知权限', 'iOS 系统设置 → 通知 → AIBrainIM\n\n应用内通知由系统统一管理，开启后可接收任务状态变更和 AI 产出提醒。')}
          />
          <MenuItem
            emoji="🔒"
            title="隐私与安全"
            subtitle="数据存储 · 权限管理"
            accent={C.accent}
            onPress={() => {
              Alert.alert(
                '隐私与安全',
                '· 聊天记录仅保存在本设备\n· 附件文件不上传至第三方\n· Gateway 连接加密传输\n· 退出登录后本地数据清除',
                [{text: '知道了'}],
              );
            }}
          />
        </View>

        {/* 退出 */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: C.bgRoot},
  content:      {padding: 16, paddingBottom: 100},

  // Header
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    marginBottom: 16,
  },
  avatarWrap: {position: 'relative'},
  avatar: {
    width: 64, height: 64, borderRadius: 24,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {color: C.bgRoot, fontSize: 30, fontWeight: '900'},
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22d3ee',
    borderWidth: 2, borderColor: C.bgRoot,
  },
  profileInfo: {flex: 1},
  profileName: {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  profileRole: {color: C.textMuted, fontSize: 14, marginTop: 4},
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1, borderColor: C.accent,
    alignSelf: 'flex-start',
  },
  statusDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginRight: 5},
  statusText: {color: C.accent, fontSize: 12, fontWeight: '800'},

  // Quick Access Strip
  quickAccessRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickAccessBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  quickAccessEmoji: {fontSize: 26},
  quickAccessLabel: {color: C.textBody, fontSize: 12, fontWeight: '700', marginTop: 6},

  // Stats
  statsGrid: {flexDirection: 'row', gap: 10, marginBottom: 8},
  runtimeBoard: {
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 14,
    gap: 12,
  },
  runtimeBoardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  runtimeBoardTitle: {color: C.textTitle, fontSize: 16, fontWeight: '900'},
  runtimeBoardSub: {color: C.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6},
  runtimeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  runtimeBadgeLive: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: '#34d399',
  },
  runtimeBadgeFallback: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderColor: '#f97316',
  },
  runtimeBadgeText: {fontSize: 12, fontWeight: '900'},
  runtimeBadgeTextLive: {color: '#34d399'},
  runtimeBadgeTextFallback: {color: '#f97316'},
  runtimeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  runtimeCell: {
    width: '48%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(56,100,200,0.08)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  runtimeCellLabel: {color: C.textMuted, fontSize: 12, fontWeight: '700'},
  runtimeCellValue: {color: C.textTitle, fontSize: 24, fontWeight: '900', marginTop: 6},
  runtimeCellHint: {color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4},

  // Sections
  sectionTitle: {
    color: C.textTitle, fontSize: 16, fontWeight: '900',
    marginTop: 24, marginBottom: 10,
  },
  menuGroup: {
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1, borderColor: C.borderSubtle,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 13, padding: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  menuEmoji: {fontSize: 20},
  menuText:  {flex: 1},
  menuTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  menuTitle:    {color: C.textTitle, fontSize: 16, fontWeight: '800'},
  menuBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, marginLeft: 4,
  },
  menuBadgeText: {color: C.bgRoot, fontSize: 10, fontWeight: '900'},
  menuSubtitle: {color: C.textMuted, fontSize: 13, marginTop: 3},
  menuArrow: {color: C.textMuted, fontSize: 24, fontWeight: '300'},

  // Release / TestFlight card
  releaseCard: {
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    overflow: 'hidden',
    marginBottom: 8,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(56,100,200,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  releaseIconWrap: {
    width: 48, height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(56,100,200,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  releaseIcon: {fontSize: 28},
  releaseHeaderText: {flex: 1},
  releaseTitle: {color: C.textTitle, fontSize: 18, fontWeight: '900'},
  releaseVersion: {color: C.textMuted, fontSize: 12, marginTop: 4},
  releaseBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56,100,200,0.35)',
  },
  releaseBadgeText: {color: C.primary, fontSize: 12, fontWeight: '900'},
  releaseDesc: {
    color: C.textBody, fontSize: 12, lineHeight: 18,
    padding: 14, paddingBottom: 0,
  },
  releaseSnapshotRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  releaseSnapshotCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(56,100,200,0.08)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  releaseSnapshotValue: {color: C.textTitle, fontSize: 22, fontWeight: '900'},
  releaseSnapshotLabel: {color: C.textMuted, fontSize: 12, marginTop: 4},
  releaseChecklist: {
    padding: 14,
    gap: 7,
  },
  checkItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  checkIcon: {fontSize: 14, width: 20},
  checkText: {color: C.textBody, fontSize: 13, flex: 1},
  checkTextPending: {color: C.textMuted},
  releaseFocusBox: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(8,15,30,0.6)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 6,
  },
  releaseFocusTitle: {color: C.textTitle, fontSize: 14, fontWeight: '900'},
  releaseFocusText: {color: C.textBody, fontSize: 13, lineHeight: 20},
  releaseActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  releaseBtnPrimary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  releaseBtnPrimaryText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
  releaseBuildGateOk: {color: '#34d399', fontSize: 13, lineHeight: 20, fontWeight: '800'},
  releaseBuildGateWarn: {color: '#fbbf24', fontSize: 13, lineHeight: 20, fontWeight: '800'},
  releaseBtnSecondary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1,
    borderColor: C.borderActive,
    alignItems: 'center',
  },
  releaseBtnSecondaryText: {color: C.primary, fontWeight: '700', fontSize: 14},
  releaseBtnGhost: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: 'center',
  },
  releaseBtnGhostText: {color: C.textBody, fontWeight: '700', fontSize: 14},
  versionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  versionSep: {width: 1, height: 10, backgroundColor: C.borderSubtle},
  buildText: {color: C.textMuted, fontSize: 12},
  releaseProgressText: {color: C.textMuted, fontSize: 12, marginTop: 6},
  materialItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  materialDot: {fontSize: 13, width: 16},
  materialText: {color: C.textBody, fontSize: 13, flex: 1},
  materialTextPending: {color: C.textMuted},

  // Logout
  logoutBtn: {
    marginTop: 32,
    padding: 15, borderRadius: 16,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: '#f87171',
    alignItems: 'center',
  },
  logoutText: {color: '#f87171', fontSize: 16, fontWeight: '800'},

  footer: {height: 32},
});
