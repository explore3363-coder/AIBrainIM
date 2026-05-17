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

        {/* 信息层入口 */}
        <Text style={styles.sectionTitle}>📚 信息层</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            emoji="🧠"
            title="记忆库"
            subtitle={`${stats.memoryEntries} 条运行态信号 · 长期 + 短期记忆入口`}
            accent="#a78bfa"
            onPress={() => navigation.navigate('MemoryStore')}
          />
          <MenuItem
            emoji="📖"
            title="知识库"
            subtitle={`${stats.knowledgeDocs} 条知识信号 · 矿业 + 工程 + 技术入口`}
            accent={C.primary}
            onPress={() => navigation.navigate('KnowledgeBase')}
          />
          <MenuItem
            emoji="📎"
            title="附件库"
            subtitle="图片 / 视频 / 文档 · 上传后 AI 自动分派"
            accent="#f97316"
            onPress={() => navigation.navigate('FileLibrary')}
          />
          <MenuItem
            emoji="🔗"
            title="调度链"
            subtitle="查看指令从接收到交付的完整流转"
            accent={C.accent}
            onPress={() => navigation.navigate('DispatchChain')}
          />
          <MenuItem
            emoji="📁"
            title="项目库"
            subtitle="AIBrainIM / 聚源三维 · 项目文档与进度"
            accent="#34d399"
            onPress={() => navigation.navigate('ProjectLibrary')}
          />
        </View>

        {/* 🚀 TestFlight / App Store 准备 */}
        <Text style={styles.sectionTitle}>🚀 上线准备</Text>
        <View style={styles.releaseCard}>
          <View style={styles.releaseHeader}>
            <View style={styles.releaseIconWrap}>
              <Text style={styles.releaseIcon}>🚀</Text>
            </View>
            <View style={styles.releaseHeaderText}>
              <Text style={styles.releaseTitle}>AI协作平台</Text>
              <View style={styles.versionTag}>
                <Text style={styles.releaseVersion}>v0.1.0 · build 1</Text>
                <View style={styles.versionSep} />
                <Text style={styles.buildText}>AIBrainIM / Alpha</Text>
              </View>
              <Text style={styles.releaseProgressText}>提测收口进度 {readinessDoneCount}/{readinessTotalCount}</Text>
            </View>
            <View style={[styles.releaseBadge, {backgroundColor: releaseSignals.readinessAccent + '22', borderColor: releaseSignals.readinessAccent + '55'}]}>
              <Text style={[styles.releaseBadgeText, {color: releaseSignals.readinessAccent}]}>{releaseSignals.readiness}</Text>
            </View>
          </View>

          <Text style={styles.releaseDesc}>
            {releaseSignals.readinessDesc}
          </Text>

          <View style={styles.releaseSnapshotRow}>
            <View style={styles.releaseSnapshotCard}>
              <Text style={styles.releaseSnapshotValue}>{runningTasks}</Text>
              <Text style={styles.releaseSnapshotLabel}>执行中任务</Text>
            </View>
            <View style={styles.releaseSnapshotCard}>
              <Text style={styles.releaseSnapshotValue}>{doneTasks}</Text>
              <Text style={styles.releaseSnapshotLabel}>已收口任务</Text>
            </View>
            <View style={styles.releaseSnapshotCard}>
              <Text style={styles.releaseSnapshotValue}>{dispatchInFlight}</Text>
              <Text style={styles.releaseSnapshotLabel}>推进中调度</Text>
            </View>
          </View>

          <View style={styles.releaseChecklist}>
            {readinessChecklist.map((item, i) => (
              <View key={i} style={styles.checkItem}>
                {/* eslint-disable-next-line react-native/no-inline-styles */}
                <Text style={[styles.checkIcon, {color: item.done ? '#34d399' : C.textMuted}]}> 
                  {item.done ? '✅' : '⬜'}
                </Text>
                <Text style={[styles.checkText, !item.done && styles.checkTextPending]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>首个 Build 动作状态</Text>
            <Text style={styles.releaseFocusText}>• {releaseSignals.launchStepLabel}</Text>
            <Text style={styles.releaseFocusText}>• {releaseSignals.launchStepDetail}</Text>
            <Text style={releaseSignals.buildReadyToTrigger ? styles.releaseBuildGateOk : styles.checkTextPending}>• 触发计划：{releaseSignals.testFlightTriggerPlanLabel}</Text>
            <Text style={releaseSignals.triggerGateReady ? styles.releaseBuildGateOk : styles.releaseBuildGateWarn}>• {releaseTriggerGateCopy.summaryLine}</Text>
            <Text style={releaseSignals.triggerGateReady ? styles.releaseFocusText : styles.checkTextPending}>• {releaseTriggerGateCopy.primaryGapLine}</Text>
            <Text style={releaseSignals.triggerGateReady ? styles.releaseFocusText : styles.checkTextPending}>• {releaseTriggerGateCopy.reasonLine}</Text>
            <Text style={releaseSignals.triggerGateReady ? styles.releaseFocusText : styles.checkTextPending}>• {releaseTriggerGateCopy.detailLine}</Text>
            <Text style={styles.releaseFocusText}>• 触发说明：{releaseSignals.testFlightTriggerPlanDetail}</Text>
            <Text style={styles.releaseFocusText}>• 建议命令：{releaseSignals.testFlightTriggerCommand}</Text>
            <Text style={styles.releaseFocusText}>• {releaseClosureCopy.summaryLine}</Text>
            <Text style={styles.releaseFocusText}>• {releaseClosureCopy.reasonLine}</Text>
            <Text style={styles.releaseFocusText}>• {releaseClosureCopy.commandLine}</Text>
            {releaseSignals.triggerGateChecklist.map(item => (
              <Text
                key={`launch-${item.id}`}
                style={item.ready ? styles.releaseFocusText : styles.checkTextPending}>
                • {item.label}：{item.value}。{item.detail}
              </Text>
            ))}
            <Text style={releaseSignals.triggerGateReady ? styles.releaseFocusText : styles.checkTextPending}>• {releaseTriggerGateCopy.pendingCountLine}</Text>
            <Text style={releaseSignals.triggerGateReady ? styles.releaseFocusText : styles.checkTextPending}>• {releaseSignals.triggerGateResponsibilitySummary}</Text>
            {releaseSignals.triggerGateFailures.map(item => (
              <Text key={`launch-trigger-gate-${item}`} style={styles.checkTextPending}>• 触发前必须处理：{item}</Text>
            ))}
            <Text style={styles.releaseFocusText}>• 当前主动作：{getReleaseActionLabel(releaseSignals.primaryNextTarget, releaseSignals.primaryNextLabel, 'decorated')}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseBuildGateOk : styles.releaseBuildGateWarn}>• 首个 Build 三件套：{releaseSignals.buildGateSummary}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseFocusText : styles.checkTextPending}>• 当前主卡点：{releaseSignals.buildGatePrimaryGap ?? '三件套已闭合'}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseFocusText : styles.checkTextPending}>• 主卡点原因：{releaseSignals.buildGatePrimaryGapDetail ?? releaseSignals.buildGateDetail}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseFocusText : styles.checkTextPending}>• 剩余门禁数：{releaseSignals.buildGatePendingCount} / 3</Text>
            {releaseSignals.buildGateChecklist.map(item => (
              <Text
                key={item.id}
                style={item.ready ? styles.releaseFocusText : styles.checkTextPending}>
                • {item.label}：{item.value}。{item.detail}
              </Text>
            ))}
            <Text style={styles.releaseFocusText}>• {releaseSignals.buildGateDetail}</Text>
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>还差什么才能触发 Build</Text>
            {releaseBlockerSummary.map(item => (
              <Text key={item.label} style={styles.releaseFocusText}>• {item.label}：{item.detail}</Text>
            ))}
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>当前最该补的</Text>
            {releaseSignals.blockers.length > 0 ? releaseSignals.blockers.map((item, index) => (
              <Text key={index} style={styles.releaseFocusText}>• {item}</Text>
            )) : (
              <Text style={styles.releaseFocusText}>• 运行态已基本收口；Icon 与截图已经就绪，下一步优先补 Apple Developer / App Store Connect / API Key 配置。</Text>
            )}
            <Text style={styles.releaseFocusText}>• {safeAppleReleaseSummary}</Text>
            {safeAppleMissingInputs.length > 0 && (
              <Text style={styles.releaseFocusText}>• Apple 预检明确缺项：{appleMissingInputLabel}</Text>
            )}
            <Text style={styles.releaseFocusText}>• Apple 当前状态：{releaseSignals.appleStateLabel}</Text>
            <Text style={styles.releaseFocusText}>• Apple 校验新鲜度：{releaseSignals.appleValidationLabel}</Text>
            <Text style={styles.releaseFocusText}>• Apple 预检详情：{appleValidationDetailLabel}</Text>
            <Text style={styles.releaseFocusText}>• 总预检状态：{releaseSignals.preflightStateLabel}</Text>
            <Text style={styles.releaseFocusText}>• 总预检新鲜度：{releaseSignals.preflightValidationLabel}</Text>
            <Text style={styles.releaseFocusText}>• 总预检详情：{preflightValidationDetailLabel}</Text>
            {preflightFailedChecks.length > 0 && (
              <Text style={styles.releaseFocusText}>• 总预检失败项：{preflightFailedChecks.join('、')}</Text>
            )}
            {safePreflightNextActions.length > 0 && (
              <Text style={styles.releaseFocusText}>• 总预检建议动作：{safePreflightNextActions[0]}</Text>
            )}
            <Text style={styles.releaseFocusText}>• 素材当前状态：{releaseSignals.appleAssetsStateLabel}</Text>
            <Text style={styles.releaseFocusText}>• 素材校验新鲜度：{releaseSignals.appleAssetsValidationLabel}</Text>
            <Text style={styles.releaseFocusText}>• 素材预检详情：{assetsValidationDetailLabel}</Text>
            <Text style={styles.releaseFocusText}>• TestFlight 当前状态：{releaseSignals.testFlightBuildLabel}</Text>
            <Text style={styles.releaseFocusText}>• TestFlight 触发计划：{releaseSignals.testFlightTriggerPlanLabel}</Text>
            <Text style={styles.releaseFocusText}>• TestFlight 建议命令：{releaseSignals.testFlightTriggerCommand}</Text>
            <Text style={releaseSignals.triggerGateReady ? styles.releaseFocusText : styles.checkTextPending}>• 仓库触发门禁：{releaseSignals.triggerGateLabel}</Text>
            <Text style={releaseSignals.triggerGateReady ? styles.releaseFocusText : styles.checkTextPending}>• {releaseTriggerGateCopy.detailLine}</Text>
            {releaseSignals.triggerGateTagName ? (
              <Text style={styles.releaseFocusText}>• 当前触发 tag：{releaseSignals.triggerGateTagName}</Text>
            ) : null}
            {releaseSignals.triggerGateFailures.map(item => (
              <Text key={`trigger-gate-${item}`} style={styles.checkTextPending}>• 仓库态阻塞：{item}</Text>
            ))}
            {releaseSignals.triggerGateUserInputFailures.length > 0 ? (
              <Text style={styles.checkTextPending}>• 待用户补输入：{releaseSignals.triggerGateUserInputFailures.join('；')}</Text>
            ) : null}
            {releaseSignals.triggerGateVersionFailures.length > 0 ? (
              <Text style={styles.checkTextPending}>• 待封版 / 改版本：{releaseSignals.triggerGateVersionFailures.join('；')}</Text>
            ) : null}
            {releaseSignals.triggerGateRepoCleanupFailures.length > 0 ? (
              <Text style={styles.checkTextPending}>• 待仓库封版清理：{releaseSignals.triggerGateRepoCleanupFailures.join('；')}</Text>
            ) : null}
            <Text style={styles.releaseFocusText}>• 上传闭环状态：{releaseSignals.uploadStateLabel}</Text>
            <Text style={styles.releaseFocusText}>• 上传回流真值：{releaseSignals.uploadReleaseTruthLabel}</Text>
            <Text style={styles.releaseFocusText}>• 上传真值说明：{releaseSignals.uploadReleaseTruthDetail}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseBuildGateOk : styles.releaseBuildGateWarn}>• 首个 Build 三件套：{releaseSignals.buildGateSummary}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseFocusText : styles.checkTextPending}>• 当前主卡点：{releaseSignals.buildGatePrimaryGap ?? '三件套已闭合'}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseFocusText : styles.checkTextPending}>• 主卡点原因：{releaseSignals.buildGatePrimaryGapDetail ?? releaseSignals.buildGateDetail}</Text>
            <Text style={releaseSignals.buildGateReady ? styles.releaseFocusText : styles.checkTextPending}>• 剩余门禁数：{releaseSignals.buildGatePendingCount} / 3</Text>
            {releaseSignals.buildGateChecklist.map(item => (
              <Text
                key={item.id}
                style={item.ready ? styles.releaseFocusText : styles.checkTextPending}>
                • {item.label}：{item.value}。{item.detail}
              </Text>
            ))}
            <Text style={styles.releaseFocusText}>• 上传样本计数：{uploadEvidenceLine}</Text>
            <Text style={styles.releaseFocusText}>• 上传样本口径：{effectiveUploadEvidenceSummary}</Text>
            <Text style={styles.releaseFocusText}>• {latestLiveUploadDisplayLine}</Text>
            <Text style={styles.releaseFocusText}>• 上传样本新鲜度：{releaseSignals.uploadValidationLabel}</Text>
            <Text style={styles.releaseFocusText}>• {appleReleaseMeta}</Text>
            <Text style={styles.releaseFocusText}>• {releaseSignals.appleValidationFresh ? 'Apple 侧最近校验仍在有效窗口内，可以继续直接往提测收口推进。' : 'Apple 侧还缺新鲜校验真值，先别把“已就绪”当成最终完成。'}</Text>
            <Text style={styles.releaseFocusText}>• {releaseSignals.buildReadyToTrigger ? '现在已经具备触发首个 TestFlight Build 的条件，下一步不该再停留在文档备注。' : '现在还不能直接触发首个 Build，先把阻塞清单里的运行态、Apple 校验或上传样本缺口补平。'}</Text>
            <Text style={styles.releaseFocusText}>• {releaseSignals.uploadValidationReady ? (releaseSignals.uploadValidationFresh ? '附件上传已经有真实回流样本，而且还在有效窗口内，说明上传链不只是演示按钮。' : '附件上传不是没做过，而是最近样本已经偏旧，提测前最好再补跑一条新的。') : '附件上传还缺真实回流样本，提测前别跳过这一步。'}</Text>
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>下一步动作</Text>
            {(safePreflightNextActions.length > 0 ? safePreflightNextActions : releaseSignals.nextActions).slice(0, 3).map((item, index) => (
              <Text key={index} style={styles.releaseFocusText}>• {item}</Text>
            ))}
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>提测执行顺序</Text>
            <Text style={styles.releaseFocusText}>• 先跑 npm run preflight:testflight，统一覆盖类型、关键测试、Apple 输入、发布配置、App Store 素材与 releaseStatus 同步。</Text>
            <Text style={styles.releaseFocusText}>• 预检通过后只运行 npm run trigger:testflight；脚本会复跑预检、校验触发门禁，并在确认本地不存在重复 v0.1.0 tag 后才自动 tag/push。</Text>
            <Text style={styles.releaseFocusText}>• 首个 Build 出现在 App Store Connect 后，再回到这里确认 TestFlight 状态与真机安装结果。</Text>
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>Apple 上线缺口</Text>
            {appleMaterials.map((item, index) => (
              <View key={index} style={styles.materialItem}>
                {/* eslint-disable-next-line react-native/no-inline-styles */}
                <Text style={[styles.materialDot, {color: item.done ? '#34d399' : '#f97316'}]}>
                  {item.done ? '●' : '○'}
                </Text>
                <Text style={[styles.materialText, !item.done && styles.materialTextPending]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.releaseActions}>
            <TouchableOpacity
              style={styles.releaseBtnPrimary}
              activeOpacity={0.8}
              onPress={() => openReleaseTarget(releaseSignals.primaryNextTarget, navigation)}
            >
              <Text style={styles.releaseBtnPrimaryText}>{getReleaseActionLabel(releaseSignals.primaryNextTarget, releaseSignals.primaryNextLabel, 'decorated')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.releaseBtnSecondary}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Upload', uploadFocusTarget)}
            >
              <Text style={styles.releaseBtnSecondaryText}>📤 看上传闭环证据</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.releaseActions}>
            <TouchableOpacity
              style={styles.releaseBtnGhost}
              activeOpacity={0.8}
              onPress={handleJoinTestFlight}
            >
              <Text style={styles.releaseBtnGhostText}>📱 加入 TestFlight</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.releaseBtnGhost}
              activeOpacity={0.8}
              onPress={handleShowAppStoreGuide}
            >
              <Text style={styles.releaseBtnGhostText}>📋 App Store 准备清单</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 系统 */}
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
  avatarText: {color: C.bgRoot, fontSize: 26, fontWeight: '900'},
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22d3ee',
    borderWidth: 2, borderColor: C.bgRoot,
  },
  profileInfo: {flex: 1},
  profileName: {color: C.textTitle, fontSize: 22, fontWeight: '900'},
  profileRole: {color: C.textMuted, fontSize: 12, marginTop: 3},
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
  statusText: {color: C.accent, fontSize: 11, fontWeight: '800'},

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
  quickAccessEmoji: {fontSize: 22},
  quickAccessLabel: {color: C.textBody, fontSize: 11, fontWeight: '700', marginTop: 5},

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
  runtimeBoardTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900'},
  runtimeBoardSub: {color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5},
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
  runtimeBadgeText: {fontSize: 11, fontWeight: '900'},
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
  runtimeCellLabel: {color: C.textMuted, fontSize: 11, fontWeight: '700'},
  runtimeCellValue: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 6},
  runtimeCellHint: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4},

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
  menuEmoji: {fontSize: 18},
  menuText:  {flex: 1},
  menuTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  menuTitle:    {color: C.textTitle, fontSize: 15, fontWeight: '800'},
  menuBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, marginLeft: 4,
  },
  menuBadgeText: {color: C.bgRoot, fontSize: 10, fontWeight: '900'},
  menuSubtitle: {color: C.textMuted, fontSize: 12, marginTop: 3},
  menuArrow: {color: C.textMuted, fontSize: 22, fontWeight: '300'},

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
  releaseIcon: {fontSize: 24},
  releaseHeaderText: {flex: 1},
  releaseTitle: {color: C.textTitle, fontSize: 17, fontWeight: '900'},
  releaseVersion: {color: C.textMuted, fontSize: 11, marginTop: 3},
  releaseBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56,100,200,0.35)',
  },
  releaseBadgeText: {color: C.primary, fontSize: 11, fontWeight: '900'},
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
  releaseSnapshotValue: {color: C.textTitle, fontSize: 18, fontWeight: '900'},
  releaseSnapshotLabel: {color: C.textMuted, fontSize: 11, marginTop: 4},
  releaseChecklist: {
    padding: 14,
    gap: 7,
  },
  checkItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  checkIcon: {fontSize: 13, width: 18},
  checkText: {color: C.textBody, fontSize: 12, flex: 1},
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
  releaseFocusTitle: {color: C.textTitle, fontSize: 13, fontWeight: '900'},
  releaseFocusText: {color: C.textBody, fontSize: 12, lineHeight: 18},
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
  releaseBtnPrimaryText: {color: C.bgRoot, fontWeight: '900', fontSize: 13},
  releaseBuildGateOk: {color: '#34d399', fontSize: 12, lineHeight: 18, fontWeight: '800'},
  releaseBuildGateWarn: {color: '#fbbf24', fontSize: 12, lineHeight: 18, fontWeight: '800'},
  releaseBtnSecondary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1,
    borderColor: C.borderActive,
    alignItems: 'center',
  },
  releaseBtnSecondaryText: {color: C.primary, fontWeight: '700', fontSize: 13},
  releaseBtnGhost: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: 'center',
  },
  releaseBtnGhostText: {color: C.textBody, fontWeight: '700', fontSize: 13},
  versionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  versionSep: {width: 1, height: 10, backgroundColor: C.borderSubtle},
  buildText: {color: C.textMuted, fontSize: 11},
  releaseProgressText: {color: C.textMuted, fontSize: 11, marginTop: 6},
  materialItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  materialDot: {fontSize: 12, width: 14},
  materialText: {color: C.textBody, fontSize: 12, flex: 1},
  materialTextPending: {color: C.textMuted},

  // Logout
  logoutBtn: {
    marginTop: 32,
    padding: 15, borderRadius: 16,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: '#f87171',
    alignItems: 'center',
  },
  logoutText: {color: '#f87171', fontSize: 15, fontWeight: '800'},

  footer: {height: 32},
});
