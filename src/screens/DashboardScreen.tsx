import React, {useCallback, useMemo, useEffect, useState} from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {C, LAYOUT} from '../data/constants';
import {commandTraceMock, aiFeedMock} from '../data/mockData';
import {SmartMineCard} from '../components/SmartMineCard';
import type {ProductionData, Equipment, Alert} from '../types/smartmine';
import {useAppContext} from '../context/AppContext';
import {useAgentRuntime, useAgentRuntimes, useActiveAgents, useMiningKPIs} from '../hooks';
import {MetricCard} from '../components/MetricCard';
import {MetricPill} from '../components/MetricPill';
import {SectionTitle} from '../components/SectionTitle';
import {StoreCard} from '../components/StoreCard';
import {FeedItem} from '../components/FeedItem';
import type {RootStackParamList} from '../App';
import type {Agent} from '../types';
import type {BrainStore, AIFeedItem, CommandTrace} from '../types';
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

type SpotlightCard = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  accent: string;
  onPress: () => void;
};

function buildLaunchSpotlight(params: {
  pendingConfirmations: number;
  runtimeMode: 'live' | 'fallback';
  gatewayConfigValid: boolean;
  gatewayWarningCount: number;
  latestBlockedConfirmation?: {title: string; description: string} | undefined;
  onOpenConfirmations: () => void;
  onOpenGatewaySettings: () => void;
  onOpenProfile: () => void;
  releaseProgressText?: string;
}): SpotlightCard {
  const {
    pendingConfirmations,
    runtimeMode,
    gatewayConfigValid,
    gatewayWarningCount,
    latestBlockedConfirmation,
    onOpenConfirmations,
    onOpenGatewaySettings,
    onOpenProfile,
    releaseProgressText,
  } = params;

  if (pendingConfirmations > 0) {
    return {
      id: 'spotlight-launch',
      eyebrow: '上线链路',
      title: `TestFlight / App Store 还有 ${pendingConfirmations} 项待拍板`,
      detail: latestBlockedConfirmation
        ? `先清掉「${latestBlockedConfirmation.title}」这一类人工确认项，上线链路才不会卡在最后一公里。`
        : '上线准备已经进入人工拍板阶段，先把待确认项收口。',
      accent: C.highUrgency,
      onPress: onOpenConfirmations,
    };
  }

  if (runtimeMode === 'fallback') {
    return {
      id: 'spotlight-launch',
      eyebrow: '上线链路',
      title: '上线前先打通真实 Gateway',
      detail: '没有真实 Gateway 回流，TestFlight 包只能演示样板，不能验证完整 AI 闭环。',
      accent: '#f97316',
      onPress: onOpenGatewaySettings,
    };
  }

  if (!gatewayConfigValid || gatewayWarningCount > 0) {
    return {
      id: 'spotlight-launch',
      eyebrow: '上线链路',
      title: !gatewayConfigValid
        ? '上线前先补齐 Gateway 配置'
        : `上线前还有 ${gatewayWarningCount} 个 Gateway 提醒`,
      detail: !gatewayConfigValid
        ? '真实调度链还没完全就绪，先把 Gateway 配置补齐，再去提 TestFlight 才不会只剩壳子。'
        : '现在不是继续堆页面的时候，先把真实链路里的提醒项清掉，避免提测后只剩演示态。',
      accent: '#f97316',
      onPress: onOpenGatewaySettings,
    };
  }

  return {
    id: 'spotlight-launch',
    eyebrow: '上线链路',
    title: releaseProgressText
      ? `TestFlight / App Store 已进入收口阶段 · ${releaseProgressText}`
      : 'TestFlight / App Store 已进入收口阶段',
    detail: '当前重点不再是补概念页，而是持续压实真实运行态、确认项和交付物一致性。',
    accent: '#34d399',
    onPress: onOpenProfile,
  };
}

const NAV_MAP: Record<string, keyof RootStackParamList> = {
  memory: 'MemoryStore',
  knowledge: 'KnowledgeBase',
  file: 'FileLibrary',
  project: 'ProjectLibrary',
  upload: 'Upload',
};

const URGENCY_COLOR: Record<string, string> = {
  high:   C.highUrgency,
  normal: C.normalUrgency,
  low:    C.lowUrgency,
};

const DISPATCH_STATUS_META = {
  submitted: {label: '已提交', accent: C.normalUrgency},
  dispatched: {label: '执行中', accent: C.primary},
  running: {label: '执行中', accent: C.primary},
  processing: {label: '处理中', accent: C.working},
  completed: {label: '已完成', accent: '#34d399'},
  failed: {label: '失败', accent: C.highUrgency},
} as const;

function getReleaseActionTag(target: ReleaseActionTarget) {
  switch (target) {
    case 'gateway':
      return '上线链路';
    case 'confirmations':
      return '需确认项';
    case 'upload':
      return '上传闭环';
    case 'profile':
    default:
      return '上线准备';
  }
}

function getReleaseActionAccent(target: ReleaseActionTarget) {
  switch (target) {
    case 'gateway':
      return '#f97316';
    case 'confirmations':
      return C.highUrgency;
    case 'upload':
      return '#34d399';
    case 'profile':
    default:
      return C.primary;
  }
}

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    agents,
    tasks,
    confirmations,
    dispatches,
    uploads,
    pendingConfirmations,
    refreshing,
    refresh,
    runtimeMode,
    runtimeError,
    recentCaptures,
    lastSyncedAt,
    sessionCount,
    gatewaySummary,
    gatewayConfigValid,
    gatewayWarningCount,
    applePrerequisitesReady,
    firstTestFlightBuildUploaded,
    appStoreAssetsReady,
    appleReleaseSummary,
    appleReleaseSource,
    appleReleaseValidatedAt,
    appStoreAssetsValidatedAt,
    preflightReportGeneratedAt,
    preflightOverallStatus,
    preflightBlockingCount,
    preflightFailedChecks,
    preflightSteps,
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

  const safeAgents = useMemo(() => Array.isArray(agents) ? agents : [], [agents]);
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeConfirmations = useMemo(() => Array.isArray(confirmations) ? confirmations : [], [confirmations]);
  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const safeAppleMissingInputs = useMemo(
    () => Array.isArray(appleMissingInputs) ? appleMissingInputs : [],
    [appleMissingInputs],
  );
  const safePreflightSteps = useMemo(
    () => Array.isArray(preflightSteps) ? preflightSteps : [],
    [preflightSteps],
  );
  const safePreflightNextActions = useMemo(
    () => Array.isArray(preflightNextActions) ? preflightNextActions : [],
    [preflightNextActions],
  );

  const safeUploads = useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);
  const pendingConfirmationItems = useMemo(
    () => safeConfirmations.filter(item => item.status !== 'confirmed' && item.status !== 'deferred'),
    [safeConfirmations],
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
  const uploadingCount = uploadEvidence.activeUploads;
  const completedUploadCount = uploadEvidence.completedUploads;
  const liveCompletedUploadCount = uploadEvidence.liveCompletedUploads;
  const simulatedCompletedUploadCount = uploadEvidence.simulatedCompletedUploads;
  const liveDispatchedOnlyUploadCount = uploadEvidence.liveDispatchedOnlyUploads;
  const latestLiveUploadCompletedAt = uploadEvidence.latestLiveUploadCompletedAt;
  const uploadEvidenceLine = useMemo(() => buildUploadEvidenceLine(uploadEvidence), [uploadEvidence]);
  const latestLiveUploadTraceLine = useMemo(() => buildLatestLiveUploadTraceLine(uploadEvidence), [uploadEvidence]);
  const hasMeaningfulLatestLiveTrace = useMemo(() => hasMeaningfulLatestLiveUploadTrace(uploadEvidence), [uploadEvidence]);
  const releaseReadiness = useMemo(() => computeReleaseReadiness({
    runtimeMode,
    pendingConfirmations,
    tasks: safeTasks,
    dispatches: safeDispatches,
    activeUploads: uploadingCount,
    completedUploads: completedUploadCount,
    liveCompletedUploads: liveCompletedUploadCount,
    liveDispatchedOnlyUploads: liveDispatchedOnlyUploadCount,
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
    preflightReportGeneratedAt,
    preflightBlockingCount,
    preflightFailedChecks,
    triggerTagName,
    triggerGateReady,
    triggerGateFailures,
  }), [
    applePrerequisitesReady,
    firstTestFlightBuildUploaded,
    appStoreAssetsReady,
    appStoreAssetsValidatedAt,
    appleReleaseValidatedAt,
    completedUploadCount,
    latestLiveUploadCompletedAt,
    uploadEvidence.latestLiveUpload,
    liveCompletedUploadCount,
    liveDispatchedOnlyUploadCount,
    safeAppleMissingInputs,
    gatewayConfigValid,
    gatewayWarningCount,
    pendingConfirmations,
    preflightBlockingCount,
    preflightFailedChecks,
    triggerTagName,
    triggerGateReady,
    triggerGateFailures,
    preflightOverallStatus,
    preflightReportGeneratedAt,
    runtimeMode,
    safeDispatches,
    safeTasks,
    uploadingCount,
  ]);
  const prioritizedReleaseChecklist = useMemo(
    () => prioritizeReleaseChecklist(releaseReadiness.checklist, 4),
    [releaseReadiness.checklist],
  );
  const latestLiveUploadDisplayLine = hasMeaningfulLatestLiveTrace && latestLiveUploadTraceLine
    ? latestLiveUploadTraceLine
    : releaseReadiness.latestLiveUploadLabel;
  const releaseBlockerSummary = useMemo(
    () => summarizeReleaseBlockers(releaseReadiness),
    [releaseReadiness],
  );
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

    const parts = [sourceLabel, preflightStatusLabel];
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
  const firstFailedPreflightStep = useMemo(
    () => safePreflightSteps.find(item => !item.ok),
    [safePreflightSteps],
  );
  const currentPreflightStepLabel = useMemo(
    () => firstFailedPreflightStep?.label
      ?? safePreflightSteps[safePreflightSteps.length - 1]?.label
      ?? '未记录',
    [firstFailedPreflightStep?.label, safePreflightSteps],
  );
  const failedPreflightStepSummaries = useMemo(
    () => safePreflightSteps
      .filter(item => !item.ok)
      .slice(0, 2)
      .map(item => ({
        label: item.label,
        detail: item.stderrTail[0] ?? item.stdoutTail[0] ?? `exit ${item.status ?? 'unknown'}`,
      })),
    [safePreflightSteps],
  );
  const appleValidationDetailLabel = useMemo(
    () => appleValidationDetail?.trim() || 'Apple 预检尚未产生详细日志',
    [appleValidationDetail],
  );
  const effectiveUploadEvidenceSummary = useMemo(
    () => releaseUploadEvidenceSummary?.trim() || releaseReadiness.uploadEvidenceSummary,
    [releaseReadiness.uploadEvidenceSummary, releaseUploadEvidenceSummary],
  );
  const assetsValidationDetailLabel = useMemo(
    () => assetsValidationDetail?.trim() || 'App Store 素材预检尚未产生详细日志',
    [assetsValidationDetail],
  );
  const preflightValidationDetailLabel = useMemo(
    () => preflightValidationDetail?.trim() || 'TestFlight 总预检尚未产生详细报告',
    [preflightValidationDetail],
  );

  // ── 智慧矿山态势感知（实时）────────────────────────────────────────────
  const {
    connected: smConnected,
    production: smProduction,
    equipment: smEquipment,
    alerts: smAlerts,
    cameras: smCameras,
    runningCount: smRunningCount,
    faultCount: smFaultCount,
    criticalCount: smCriticalCount,
    outputTrend: smOutputTrend,
    isLive: smIsLive,
  } = useMiningKPIs({enabled: true});

  // 将 DataBus 连接状态同步到 AppContext（供全局使用）
  const {setDataBusConnected} = useAppContext();
  useEffect(() => {
    setDataBusConnected(smConnected);
  }, [smConnected, setDataBusConnected]);

  // ── Agent 态势感知 ────────────────────────────────────────────────────────────
  const agentRuntimes = useAgentRuntimes();
  const activeAgents = useActiveAgents();

  const agentOnlineCount  = useMemo(() => safeAgents.filter(a => a.status === 'online').length, [safeAgents]);
  const agentWorkingCount = useMemo(() => safeAgents.filter(a => a.status === 'working').length, [safeAgents]);
  const agentIdleCount    = useMemo(() => safeAgents.filter(a => a.status === 'idle').length, [safeAgents]);
  const agentErrorCount   = useMemo(
    () => Object.values(agentRuntimes).filter(r => (r.errorRate ?? 0) > 5).length,
    [agentRuntimes],
  );

  function getAgentStatusColor(agent: Agent): string {
    if (agent.status === 'idle')   return C.textMuted;
    if (agent.status === 'watching') return '#a78bfa';
    if (agent.status === 'working')  return C.working;
    if (agent.status === 'online')   return '#34d399';
    return C.textMuted;
  }

  function getAgentStatusLabel(agent: Agent): string {
    const runtime = agentRuntimes[agent.id];
    const errorRate = runtime?.errorRate ?? 0;
    if (errorRate > 5) return '异常';
    switch (agent.status) {
      case 'working':  return '执行中';
      case 'online':   return '在线';
      case 'idle':     return '空闲';
      case 'watching': return '监控中';
      default:         return '离线';
    }
  }

  // Dynamic brain store entries driven by real context data — no hardcoded mock counts
  const brainStores = useMemo<BrainStore[]>(() => {
    const memorySignals = safeDispatches.filter(d => d.source === 'memory').length
      + safeTasks.filter(t => t.sourceType === 'memory').length;
    const knowledgeSignals = safeDispatches.filter(d => d.source === 'knowledge').length
      + safeTasks.filter(t => t.sourceType === 'knowledge').length;
    const projectSignals = safeDispatches.filter(d =>
      d.label?.includes('项目') || d.userText.includes('项目') || d.reply.includes('项目')).length;
    const fileSignals = safeUploads.length;

    return [
      {
        id: 'memory' as const,
        title: '记忆库',
        value: `${Math.min(99, memorySignals)} 条运行信号`,
        status: memorySignals > 0 ? 'active' as const : 'standby' as const,
        detail: '长期 + 短期记忆 · 搜索 · 新建',
        accent: '#a78bfa',
        screen: 'MemoryStore',
      },
      {
        id: 'knowledge' as const,
        title: '知识库',
        value: `${Math.min(99, knowledgeSignals)} 条运行信号`,
        status: knowledgeSignals > 0 ? 'active' as const : 'standby' as const,
        detail: '矿业 + 工程 + 技术 · 搜索 · 收录',
        accent: C.primary,
        screen: 'KnowledgeBase',
      },
      {
        id: 'project' as const,
        title: '项目库',
        value: projectSignals > 0 ? `${Math.min(99, projectSignals)} 条项目信号` : 'AIBrainIM / 聚源三维',
        status: projectSignals > 0 ? 'active' as const : 'standby' as const,
        detail: '智慧矿山 · 项目跟踪 · 产出管理',
        accent: '#34d399',
        screen: 'ProjectLibrary',
      },
      {
        id: 'file' as const,
        title: '附件库',
        value: fileSignals > 0 ? `${fileSignals} 个附件` : '暂无附件',
        status: fileSignals > 0 ? 'active' as const : 'standby' as const,
        detail: `图片 / 视频 / 文档 · ${uploadingCount} 个上传中`,
        accent: '#f97316',
        screen: 'FileLibrary',
      },
      {
        id: 'upload' as const,
        title: '上传入口',
        value: uploadingCount > 0 ? `${uploadingCount} 个上传中` : '随时可用',
        status: uploadingCount > 0 ? 'pending' as const : 'active' as const,
        detail: '图片 / 视频 / 文档 · AI 自动分派',
        accent: uploadingCount > 0 ? '#fbbf24' : C.primary,
        screen: 'Upload',
      },
    ];
  }, [safeDispatches, safeTasks, safeUploads, uploadingCount]);

  const activeCount  = useMemo(() => safeAgents.filter(a => a.status === 'online' || a.status === 'working').length, [safeAgents]);
  const runningCount = useMemo(() => safeTasks.filter(t => t.state === 'running').length, [safeTasks]);
  const doneCount = useMemo(() => safeTasks.filter(t => t.state === 'done').length, [safeTasks]);
  const blockedCount = useMemo(() => safeTasks.filter(t => t.state === 'blocked').length, [safeTasks]);
  const dispatchActiveCount = useMemo(() => safeDispatches.filter(item => item.status === 'submitted' || item.status === 'dispatched' || item.status === 'processing').length, [safeDispatches]);
  const uploadDoneCount = useMemo(() => safeUploads.filter(u => u.status === 'done').length, [safeUploads]);

  const latestDispatch = safeDispatches[0];
  const latestDispatchMeta = latestDispatch ? DISPATCH_STATUS_META[latestDispatch.status] : null;
  const latestRunningTask = safeTasks.find(task => task.state === 'running');
  const latestBlockedConfirmation = pendingConfirmationItems[0];
  const hottestUpload = safeUploads.find(item => item.status === 'uploading' || item.status === 'processing' || item.status === 'dispatched');

  const openFocusedDispatch = useCallback(() => navigation.navigate('DispatchChain', {
    focusDispatchId: latestDispatch?.dispatchId,
    focusTaskId: latestDispatch?.taskId,
    focusSessionKey: latestDispatch?.sessionKey,
  }), [latestDispatch?.dispatchId, latestDispatch?.sessionKey, latestDispatch?.taskId, navigation]);

  const openFocusedConfirmations = useCallback(() => navigation.navigate('Confirmations', {
    focusConfirmationId: latestBlockedConfirmation?.id,
    focusTaskId: latestBlockedConfirmation?.followUpTaskId,
    focusDispatchId: latestBlockedConfirmation?.followUpDispatchId,
  }), [latestBlockedConfirmation?.followUpDispatchId, latestBlockedConfirmation?.followUpTaskId, latestBlockedConfirmation?.id, navigation]);

  const openFocusedUpload = useCallback(() => navigation.navigate('Upload', {
    focusFileId: hottestUpload?.id,
    focusDispatchId: hottestUpload?.dispatchId,
  }), [hottestUpload?.dispatchId, hottestUpload?.id, navigation]);

  const openProfile = useCallback(() => navigation.navigate('Tabs', {screen: 'Profile'}), [navigation]);
  const openGatewaySettings = useCallback(() => navigation.navigate('GatewaySettings'), [navigation]);
  const openPrimaryReleaseTarget = useCallback((target: ReleaseActionTarget) => {
    switch (target) {
      case 'gateway':
        navigation.navigate('GatewaySettings');
        return;
      case 'confirmations':
        openFocusedConfirmations();
        return;
      case 'upload':
        openFocusedUpload();
        return;
      case 'profile':
      default:
        openProfile();
    }
  }, [navigation, openFocusedConfirmations, openFocusedUpload, openProfile]);

  const focusDescription = latestDispatch
    ? `最新调度「${latestDispatchMeta?.label ?? latestDispatch.status}」：${latestDispatch.userText.slice(0, 42)}${latestDispatch.userText.length > 42 ? '…' : ''}`
    : latestRunningTask
      ? `当前最需要盯住的是「${latestRunningTask.title}」，它正在从任务流向结果交付收口。`
      : runtimeMode === 'fallback'
        ? `还没连通真实 Gateway，先在「对话」中发一条消息，验证基础调度链路是否正常。${runtimeError ? ` 当前异常：${runtimeError}` : ''}`
        : gatewayConfigValid
          ? `当前没有进行中的调度单，系统运转正常。${gatewayWarningCount > 0 ? ` 但 Gateway 配置还有 ${gatewayWarningCount} 个提醒待处理。` : ''}`
          : `当前没有进行中的调度单，但 Gateway 配置还没完全就绪。${gatewaySummary ? ` ${gatewaySummary}` : ''}`;
  const liveFeed = useMemo<AIFeedItem[]>(() => {
    const safeCaptures = Array.isArray(recentCaptures) ? recentCaptures : [];

    const dispatchFeed = safeDispatches.slice(0, 4).map((item, index) => ({
      id: `dispatch-${item.id}-${index}`,
      agent: `助理 · ${DISPATCH_STATUS_META[item.status].label}`,
      agentAccent: DISPATCH_STATUS_META[item.status].accent,
      text: item.reply,
      timestamp: new Date(item.createdAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
      type: item.status === 'failed' ? 'system' as const : item.status === 'completed' ? 'output' as const : 'dispatch' as const,
    }));

    const uploadFeed = safeUploads
      .filter(item => item.status === 'dispatched' || item.status === 'error' || item.status === 'processing')
      .slice(-3)
      .reverse()
      .map(item => ({
        id: `upload-${item.id}`,
        agent: item.agent ?? '附件队列',
        agentAccent: item.status === 'error' ? C.highUrgency : '#34d399',
        text:
          item.status === 'error'
            ? `附件「${item.name}」处理失败：${item.error ?? '未知错误'}`
            : item.status === 'processing'
              ? `附件「${item.name}」已上传完成，正在进入后台处理队列。`
              : `附件「${item.name}」已分派给 ${item.agent ?? '对应智能体'}。`,
        timestamp: item.timestamp,
        type: item.status === 'error' ? 'system' as const : 'upload' as const,
      }));

    const captureFeed = safeCaptures.slice(0, 4).map(entry => ({
      id: entry.id,
      agent: entry.type === 'knowledge' ? '📖 知识收录' : '🧠 记忆沉淀',
      agentAccent: entry.type === 'knowledge' ? C.primary : '#a78bfa',
      text: entry.savedRemotely
        ? `「${entry.title}」已收录到${entry.type === 'knowledge' ? '知识' : '记忆'}层${entry.category ? `（${entry.category}）` : ''}，并回流到任务流。`
        : `「${entry.title}」已先沉淀在本地闭环${entry.type === 'knowledge' ? '知识' : '记忆'}层。`,
      timestamp: new Date(entry.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
      type: entry.type as 'knowledge' | 'memory',
    }));

    const merged = [...captureFeed, ...dispatchFeed, ...uploadFeed];
    return merged.length ? merged.slice(0, 6) : aiFeedMock;
  }, [recentCaptures, safeDispatches, safeUploads]);

  const dispatchTrace = useMemo<CommandTrace[]>(() => {
    if (!safeDispatches.length) return commandTraceMock;
    const latest = safeDispatches[0];
    return [
      {stage:'receive', title:'接收指令', actor:'你 → 助理', detail: latest.userText},
      {stage:'dispatch', title:'生成调度单', actor:'助理 / Gateway', detail: `taskId=${latest.taskId ?? '未生成'} · dispatchId=${latest.dispatchId ?? '未生成'}`},
      {stage:'feedback', title:'状态回流', actor:'移动端', detail: latest.reply},
      {stage:'synthesis', title:'当前状态', actor:'调度链', detail: `${DISPATCH_STATUS_META[latest.status].label}${latest.sessionKey ? ` · session=${latest.sessionKey}` : ''}`},
      {stage:'deliver', title:'结果交付', actor:'APP', detail: latest.status === 'completed' ? '该调度单已完成，并已同步到任务流、调度链和 AI 产出流。' : latest.status === 'failed' ? '该调度单执行异常，已保留记录，建议查看调度链并重试。' : '该调度单已同步到任务流、调度链和 AI 产出流。'},
    ];
  }, [safeDispatches]);

  const actionQueue = useMemo(() => {
    const queue: Array<{
      id: string;
      tag: string;
      title: string;
      detail: string;
      accent: string;
      onPress: () => void;
    }> = [];

    const releaseActionLabel = getReleaseActionLabel(
      releaseReadiness.primaryNextTarget,
      releaseReadiness.primaryNextLabel,
    );
    const releaseActionDetail = safePreflightNextActions[0]
      ? `${releaseReadiness.primaryNextAction} 当前最直接的动作是：${safePreflightNextActions[0]}`
      : releaseReadiness.primaryNextAction;

    queue.push({
      id: 'release-next-step',
      tag: getReleaseActionTag(releaseReadiness.primaryNextTarget),
      title: `下一步：${releaseActionLabel}`,
      detail: releaseActionDetail,
      accent: getReleaseActionAccent(releaseReadiness.primaryNextTarget),
      onPress: () => openPrimaryReleaseTarget(releaseReadiness.primaryNextTarget),
    });

    if (latestBlockedConfirmation) {
      queue.push({
        id: `confirm-${latestBlockedConfirmation.id}`,
        tag: '需确认项',
        title: latestBlockedConfirmation.title,
        detail: latestBlockedConfirmation.description,
        accent: URGENCY_COLOR[latestBlockedConfirmation.urgency],
        onPress: openFocusedConfirmations,
      });
    }

    if (hottestUpload) {
      queue.push({
        id: `upload-${hottestUpload.id}`,
        tag: '附件链路',
        title: `附件：${hottestUpload.name}`,
        detail: hottestUpload.status === 'processing'
          ? '后台正在处理这份附件，结果会继续回流到 AI 产出流。'
          : hottestUpload.status === 'dispatched'
            ? `已经分派给 ${hottestUpload.agent ?? '对应智能体'}，现在要盯执行结果。`
            : `当前进度 ${hottestUpload.progress}% ，前端上传链路保持在线。`,
        accent: '#34d399',
        onPress: openFocusedUpload,
      });
    }

    if (latestDispatch && latestDispatchMeta) {
      queue.push({
        id: `dispatch-${latestDispatch.id}`,
        tag: 'AI 产出流',
        title: `先盯这条调度：${latestDispatchMeta.label}`,
        detail: latestDispatch.reply,
        accent: latestDispatchMeta.accent,
        onPress: openFocusedDispatch,
      });
    }

    if (latestRunningTask) {
      queue.push({
        id: `task-${latestRunningTask.id}`,
        tag: '任务推进',
        title: latestRunningTask.title,
        detail: latestRunningTask.next,
        accent: C.working,
        onPress: () => navigation.navigate('DispatchChain', {
          focusTaskId: latestRunningTask.id,
          focusSessionKey: latestRunningTask.sessionKey,
        }),
      });
    }

    if (queue.length === 1) {
      if (pendingConfirmationItems.length > 0) {
        pendingConfirmationItems.slice(0, 2).forEach(item => {
          queue.push({
            id: `confirm-fallback-${item.id}`,
            tag: '需确认项',
            title: item.title,
            detail: item.description,
            accent: URGENCY_COLOR[item.urgency],
            onPress: () => navigation.navigate('Confirmations'),
          });
        });
      } else if (!latestDispatch && !latestRunningTask && !hottestUpload) {
        queue.push({
          id: 'idle-default',
          tag: '第一步',
          title: '发送第一条消息，开启 AI 协作',
          detail: '在「对话」中告诉助理你想做什么，调度链会立即开始工作。',
          accent: C.primary,
          onPress: () => navigation.navigate('Tabs', {screen: 'Chat'}),
        });
      }
    }

    return queue.slice(0, 3);
  }, [hottestUpload, latestBlockedConfirmation, latestDispatch, latestDispatchMeta, latestRunningTask, navigation, openFocusedConfirmations, openFocusedDispatch, openFocusedUpload, openPrimaryReleaseTarget, pendingConfirmationItems, releaseReadiness.primaryNextAction, releaseReadiness.primaryNextLabel, releaseReadiness.primaryNextTarget, safePreflightNextActions]);

  const releaseClosureCopy = useMemo(() => buildReleaseClosureCopy({
    target: releaseReadiness.primaryNextTarget,
    fallbackLabel: releaseReadiness.primaryNextLabel,
    primaryNextAction: releaseReadiness.primaryNextAction,
    primaryGap: releaseReadiness.buildGatePrimaryGap ?? releaseReadiness.triggerGatePrimaryGap,
    primaryGapDetail: releaseReadiness.buildGatePrimaryGapDetail ?? releaseReadiness.triggerGatePrimaryGapDetail,
    command: releaseReadiness.testFlightTriggerCommand,
  }), [
    releaseReadiness.buildGatePrimaryGap,
    releaseReadiness.buildGatePrimaryGapDetail,
    releaseReadiness.primaryNextAction,
    releaseReadiness.primaryNextLabel,
    releaseReadiness.primaryNextTarget,
    releaseReadiness.testFlightTriggerCommand,
    releaseReadiness.triggerGatePrimaryGap,
    releaseReadiness.triggerGatePrimaryGapDetail,
  ]);

  const releaseTriggerGateCopy = useMemo(() => buildReleaseTriggerGateCopy({
    summary: releaseReadiness.triggerGateSummary,
    primaryGap: releaseReadiness.triggerGatePrimaryGap,
    primaryGapDetail: releaseReadiness.triggerGatePrimaryGapDetail,
    detail: releaseReadiness.triggerGateDetail,
    pendingCount: releaseReadiness.triggerGatePendingCount,
    totalCount: releaseReadiness.triggerGateChecklist.length,
    responsibilitySummary: releaseReadiness.triggerGateResponsibilitySummary,
  }), [
    releaseReadiness.triggerGateChecklist.length,
    releaseReadiness.triggerGateDetail,
    releaseReadiness.triggerGatePendingCount,
    releaseReadiness.triggerGatePrimaryGap,
    releaseReadiness.triggerGatePrimaryGapDetail,
    releaseReadiness.triggerGateResponsibilitySummary,
    releaseReadiness.triggerGateSummary,
  ]);

  const summaryCards = useMemo(() => {
    const summary: Array<{
      id: string;
      label: string;
      value: string;
      detail: string;
      accent: string;
    }> = [
      {
        id: 'dispatch',
        label: '调度闭环',
        value: dispatchActiveCount > 0 ? `${dispatchActiveCount} 条推进中` : '当前无堆积',
        detail: latestDispatchMeta
          ? `最新状态是「${latestDispatchMeta.label}」，移动端已经能持续回看调度链。`
          : '没有新的调度单压住首页，说明当前前台节奏是干净的。',
        accent: latestDispatchMeta?.accent ?? C.primary,
      },
      {
        id: 'task',
        label: '任务收口',
        value: runningCount > 0 ? `${runningCount} 条执行中 / ${doneCount} 条已完成` : `${doneCount} 条已完成`,
        detail: blockedCount > 0
          ? `还有 ${blockedCount} 条任务被确认链卡住，需要人工拍板后继续推进。`
          : '任务流已经能把执行中、完成态和人工阻塞态清楚分开。',
        accent: blockedCount > 0 ? C.highUrgency : C.working,
      },
      {
        id: 'upload',
        label: '附件链路',
        value: uploadingCount > 0
          ? `${uploadingCount} 条处理中`
          : liveCompletedUploadCount > 0
            ? `${liveCompletedUploadCount} 条 LIVE 真回流`
            : `${uploadDoneCount} 条已完成`,
        detail: uploadingCount > 0
          ? '前端上传、后台处理、智能体分派三段链路都在跑。'
          : liveDispatchedOnlyUploadCount > 0
            ? `已有 ${liveDispatchedOnlyUploadCount} 条 LIVE 附件只到已分派，还不能算最终回流。`
            : simulatedCompletedUploadCount > 0 && liveCompletedUploadCount === 0
              ? '当前完成样本仍以模拟回流为主，提测前还差真实 Gateway 真回流。'
              : '上传入口已经不只是按钮，处理结果会继续回流到 AI 产出流。',
        accent: '#34d399',
      },
    ];

    return summary;
  }, [blockedCount, dispatchActiveCount, doneCount, latestDispatchMeta, liveCompletedUploadCount, liveDispatchedOnlyUploadCount, runningCount, simulatedCompletedUploadCount, uploadDoneCount, uploadingCount]);

  const handleStorePress = useCallback((store: BrainStore) => {
    const screen = NAV_MAP[store.id];
    if (screen) navigation.navigate(screen);
  }, [navigation]);

  const spotlightCards = useMemo<SpotlightCard[]>(() => {
    const projectSignal = dispatchActiveCount > 0
      ? `AI 产出、调度状态和任务链已经开始共用真实运行态数据，当前还有 ${dispatchActiveCount} 条链路在前台可见。`
      : '当前没有新的执行堆积，适合继续推进产品闭环或做真机验证。';

    const launchSpotlight = buildLaunchSpotlight({
      pendingConfirmations,
      runtimeMode,
      gatewayConfigValid,
      gatewayWarningCount,
      latestBlockedConfirmation,
      onOpenConfirmations: openFocusedConfirmations,
      onOpenGatewaySettings: openGatewaySettings,
      onOpenProfile: openProfile,
      releaseProgressText: `${releaseReadiness.doneCount}/${releaseReadiness.totalCount}`,
    });

    return [
      {
        id: 'spotlight-output',
        eyebrow: '首页主线',
        title: latestDispatchMeta ? `AI 产出正在${latestDispatchMeta.label}` : 'AI 产出流已收口到首页',
        detail: latestDispatch
          ? `${latestDispatch.reply}${latestDispatch.agentId ? ` · 执行方 ${latestDispatch.agentId}` : ''}`
          : '当前首页会优先顶出最新 AI 结果，不再让工程噪音抢首屏。',
        accent: latestDispatchMeta?.accent ?? C.primary,
        onPress: openFocusedDispatch,
      },
      {
        id: 'spotlight-confirm',
        eyebrow: '人工决策',
        title: pendingConfirmations > 0 ? `还有 ${pendingConfirmations} 项待拍板` : '确认链路当前比较干净',
        detail: latestBlockedConfirmation
          ? `${latestBlockedConfirmation.title} · ${latestBlockedConfirmation.description}`
          : '已经处理过的事项不会继续占首页，只有真正待确认的内容会被顶上来。',
        accent: pendingConfirmations > 0 ? C.highUrgency : '#34d399',
        onPress: openFocusedConfirmations,
      },
      launchSpotlight,
      {
        id: 'spotlight-project',
        eyebrow: '项目闭环',
        title: 'P1 正在从样板走向可用驾驶舱',
        detail: projectSignal,
        accent: C.primary,
        onPress: () => navigation.navigate('ProjectLibrary'),
      },
    ];
  }, [dispatchActiveCount, gatewayConfigValid, gatewayWarningCount, latestBlockedConfirmation, latestDispatch, latestDispatchMeta, navigation, openFocusedConfirmations, openFocusedDispatch, openGatewaySettings, openProfile, pendingConfirmations, releaseReadiness.doneCount, releaseReadiness.totalCount, runtimeMode]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={C.primary}
        />
      }
    >
      {/* ── Redesigned Header Bar ── */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>⬡</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Brain</Text>
            <Text style={styles.headerSubtitle}>Industrial AI Collaboration</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Redesigned Hero Section ── */}
      <View style={styles.heroNew}>
        {/* 3D-style messaging bubble graphic */}
        <View style={styles.bubbleContainer}>
          <View style={styles.bubbleGlowOuter} />
          <View style={styles.bubbleGlowMiddle} />
          <View style={styles.bubbleGlowInner} />
          <View style={styles.bubbleCore}>
            <View style={styles.bubbleTail} />
            <View style={styles.bubbleIcon}>
              <Text style={styles.bubbleIconText}>💬</Text>
            </View>
          </View>
        </View>

        {/* Bilingual slogan */}
        <Text style={styles.heroSlogan}>Start collaborating</Text>
        <Text style={styles.heroSloganZh}>开始协作，解锁工业AI的力量</Text>
        <Text style={styles.heroSub}>Unlock the power of industrial AI</Text>

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Tabs', {screen: 'Chat'})}
        >
          <Text style={styles.ctaBtnIcon}>+</Text>
          <Text style={styles.ctaBtnText}>Start New Collaboration</Text>
        </TouchableOpacity>
      </View>

      {/* ── Action Cards ── */}
      <View style={styles.actionCards}>
        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Tabs', {screen: 'Chat'})}
        >
          <View style={styles.actionCardLeft}>
            <View style={[styles.actionCardIcon, {backgroundColor: 'rgba(77,255,136,0.12)'}]}>
              <Text style={styles.actionCardIconText}>🚀</Text>
            </View>
            <View style={styles.actionCardText}>
              <Text style={styles.actionCardTitle}>Explore Collaboration Spaces</Text>
              <Text style={styles.actionCardDesc}>探索协作空间</Text>
            </View>
          </View>
          <Text style={styles.actionCardArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SmartMine')}
        >
          <View style={styles.actionCardLeft}>
            <View style={[styles.actionCardIcon, {backgroundColor: 'rgba(179,102,255,0.12)'}]}>
              <Text style={styles.actionCardIconText}>⛏️</Text>
            </View>
            <View style={styles.actionCardText}>
              <Text style={styles.actionCardTitle}>Connect Devices & Data</Text>
              <Text style={styles.actionCardDesc}>连接设备与数据</Text>
            </View>
          </View>
          <Text style={styles.actionCardArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Original Hero (preserved for runtime context) ── */}
      <View style={styles.hero}>
        {/* Industrial background layers */}
        <View style={styles.heroBg} />
        <View style={styles.heroGlowGreen} />
        <View style={styles.heroGlowBlue} />
        <View style={styles.heroGridLines} />
        {/* Content */}
        <View style={styles.heroContent}>
          <View style={styles.heroLeft}>
            <View style={styles.heroBrandRow}>
              <Text style={styles.heroBrand}>AI Brain</Text>
              <View style={styles.livePill}>
                <View style={[styles.liveDot, runtimeMode === 'fallback' && styles.liveDotFallback]} />
                <Text style={[styles.liveText, runtimeMode === 'fallback' && styles.liveTextFallback]}>
                  {runtimeMode === 'live' ? 'LIVE' : 'DEMO'}
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>工业智能操作系统</Text>
            <Text style={styles.heroSub}>Industrial Intelligence OS</Text>
            <Text style={styles.heroTagline}>把目标变成可执行任务</Text>
          </View>
        </View>
        {/* Corner accent */}
        <View style={styles.heroCorner} />
      </View>

      {runtimeMode === 'fallback' && (
        <View style={styles.demoHintBanner}>
          <Text style={styles.demoHintIcon}>🛰️</Text>
          <View style={styles.demoHintText}>
            <Text style={styles.demoHintTitle}>尚未连接 OpenClaw Gateway</Text>
            <Text style={styles.demoHintSub}>
              当前显示本地数据；去「我的 → Gateway 配置」连接后可体验完整实时闭环。{runtimeError ? ` 当前异常：${runtimeError}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.demoSettingsBtn}
            activeOpacity={0.8}
            onPress={openGatewaySettings}
          >
            <Text style={styles.demoSettingsBtnText}>去配置</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Stats Pills (Horizontal Scroll) ── */}
      <Text style={styles.sectionLabel}>实时状态 / Live Status</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsRow}
        style={styles.metricsScroll}
      >
        <MetricPill label="活跃 Agent" value={`${activeCount}/${safeAgents.length}`} accent={C.accent} subLabel="Active" />
        <MetricPill label="进行中" value={`${runningCount}`} accent={C.working} subLabel="Running" />
        <MetricPill label="上传队列" value={`${uploadingCount}`} accent="#34d399" subLabel="Uploading" />
        <MetricPill label="需确认" value={`${pendingConfirmations}`} accent={C.highUrgency} subLabel="Pending" />
        <MetricPill label="活跃会话" value={`${sessionCount}`} accent={C.primary} subLabel="Sessions" />
        {lastSyncedAt ? (
          <MetricPill
            label="最后同步"
            value={new Date(lastSyncedAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}
            accent={runtimeMode === 'live' ? '#34d399' : '#fbbf24'}
            subLabel="Last Sync"
          />
        ) : null}
      </ScrollView>

      {/* ── 实时 Agent 态势感知区 ── */}
      <View style={styles.agentSitrepBoard}>
        <View style={styles.agentSitrepHeader}>
          <Text style={styles.agentSitrepTitle}>实时 Agent 态势感知</Text>
          <View style={styles.agentSitrepMeta}>
            <Text style={styles.agentSitrepMetaText}>
              在线 {agentOnlineCount} / 执行中 {agentWorkingCount} / 空闲 {agentIdleCount}
              {agentErrorCount > 0 ? ` / 异常 ${agentErrorCount}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.agentDotGrid}>
          {safeAgents.map(agent => {
            const runtime = agentRuntimes[agent.id];
            const statusColor = getAgentStatusColor(agent);
            const statusLabel = getAgentStatusLabel(agent);
            const hasWarning = (runtime?.errorRate ?? 0) > 5;
            const isRunning = agent.status === 'working';
            const currentTask = isRunning ? safeTasks.find(t => t.agentId === agent.id && t.state === 'running') : null;

            return (
              <View key={agent.id} style={styles.agentDotCard}>
                <View style={styles.agentDotRow}>
                  <View style={[styles.agentStatusDot, {backgroundColor: statusColor}]} />
                  <Text style={styles.agentDotName} numberOfLines={1}>{agent.name}</Text>
                  {hasWarning && <Text style={styles.agentWarningIcon}>⚠️</Text>}
                  <Text style={[styles.agentStatusLabel, {color: statusColor}]}>{statusLabel}</Text>
                </View>
                {isRunning && currentTask && (
                  <View style={styles.agentTaskInfo}>
                    <Text style={styles.agentTaskName} numberOfLines={1}>
                      {currentTask.title}
                    </Text>
                    <View style={styles.agentProgressBar}>
                      <View
                        style={[
                          styles.agentProgressFill,
                          {
                            width: `${currentTask.progress ?? 0}%`,
                            backgroundColor: C.working,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.agentProgressText}>
                      {currentTask.progress ?? 0}%
                    </Text>
                  </View>
                )}
                {runtime && (
                  <View style={styles.agentRuntimeInfo}>
                    {runtime.avgLatencyMs != null && (
                      <Text style={styles.agentRuntimeText}>延迟 {runtime.avgLatencyMs}ms</Text>
                    )}
                    {runtime.model && (
                      <Text style={styles.agentRuntimeText} numberOfLines={1}>{runtime.model}</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.focusBoard}>
        <View style={styles.focusHeader}>
          <View>
            <Text style={styles.focusEyebrow}>TODAY FOCUS</Text>
            <Text style={styles.focusTitle}>先看 AI 产出，再看调度状态</Text>
          </View>
          <View style={styles.focusBadge}>
            <Text style={styles.focusBadgeText}>
              {latestDispatchMeta ? `最新调度：${latestDispatchMeta.label}` : blockedCount > 0 ? `${blockedCount} 项待处理` : '闭环正常'}
            </Text>
          </View>
        </View>
        <Text style={styles.focusDesc}>{focusDescription}</Text>
        <Text style={styles.focusMeta}>
          {runtimeMode === 'live'
            ? (gatewayConfigValid
              ? `Gateway：${gatewaySummary}${gatewayWarningCount > 0 ? ` · ${gatewayWarningCount} 个提醒待处理` : ''}`
              : `Gateway 待完善：${gatewaySummary}`)
            : `当前处于本地演示运行态${runtimeError ? ` · ${runtimeError}` : ''}`}
        </Text>
        <View style={styles.quickActionRow}>
          <TouchableOpacity
            style={styles.quickActionChip}
            activeOpacity={0.8}
            onPress={openFocusedDispatch}
          >
            <Text style={styles.quickActionText}>看调度链</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionChip}
            activeOpacity={0.8}
            onPress={openFocusedConfirmations}
          >
            <Text style={styles.quickActionText}>处理确认项</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionChip}
            activeOpacity={0.8}
            onPress={openFocusedUpload}
          >
            <Text style={styles.quickActionText}>看上传队列</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionTitle title="首页重点" hint="首屏只保留用户真会关心的三件事" />
      <View style={styles.spotlightGrid}>
        {spotlightCards.map(card => (
          <TouchableOpacity
            key={card.id}
            style={styles.spotlightCard}
            activeOpacity={0.85}
            onPress={card.onPress}
          >
            <Text style={[styles.spotlightEyebrow, {color: card.accent}]}>{card.eyebrow}</Text>
            <Text style={styles.spotlightTitle}>{card.title}</Text>
            <Text style={styles.spotlightDetail}>{card.detail}</Text>
            <Text style={[styles.spotlightAction, {color: card.accent}]}>打开查看 ›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle title="闭环摘要" hint="先判断现在是在产出、卡点，还是等待确认" />
      <View style={styles.summaryGrid}>
        {summaryCards.map(card => (
          <View key={card.id} style={styles.summaryCard}>
            <Text style={[styles.summaryLabel, {color: card.accent}]}>{card.label}</Text>
            <Text style={styles.summaryValue}>{card.value}</Text>
            <Text style={styles.summaryDetail}>{card.detail}</Text>
          </View>
        ))}
      </View>

      <SectionTitle title="提测收口" hint="直接看 TestFlight 还差什么" />
      <View style={styles.releaseCard}>
        <View style={styles.releaseHeaderRow}>
          <View style={styles.releaseHeaderTextBlock}>
            <Text style={styles.releaseEyebrow}>TESTFLIGHT READINESS</Text>
            <Text style={styles.releaseTitle}>{releaseReadiness.readiness}</Text>
            <Text style={styles.releaseDesc}>{releaseReadiness.readinessDesc}</Text>
          </View>
          <View style={[styles.releaseBadge, {borderColor: releaseReadiness.readinessAccent, backgroundColor: `${releaseReadiness.readinessAccent}22`}]}>
            <Text style={[styles.releaseBadgeText, {color: releaseReadiness.readinessAccent}]}>
              {releaseReadiness.doneCount}/{releaseReadiness.totalCount}
            </Text>
          </View>
        </View>

        <View style={styles.releaseChecklistRow}>
          {prioritizedReleaseChecklist.map(item => (
            <View key={item.text} style={styles.releaseChecklistItem}>
              <Text style={styles.releaseChecklistIcon}>{item.done ? '✅' : '⬜'}</Text>
              <Text style={[styles.releaseChecklistText, !item.done && styles.releaseChecklistTextPending]} numberOfLines={2}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.releaseFocusBox}>
          <Text style={styles.releaseFocusTitle}>首个 Build 动作状态</Text>
          <Text style={styles.releaseFocusText}>• {releaseReadiness.launchStepLabel}</Text>
          <Text style={styles.releaseFocusText}>• {releaseReadiness.launchStepDetail}</Text>
          <Text style={releaseReadiness.buildReadyToTrigger ? styles.releaseBuildGateOk : styles.releaseChecklistTextPending}>• 触发计划：{releaseReadiness.testFlightTriggerPlanLabel}</Text>
          <Text style={releaseReadiness.triggerGateReady ? styles.releaseBuildGateOk : styles.releaseBuildGateWarn}>• {releaseTriggerGateCopy.summaryLine}</Text>
          <Text style={releaseReadiness.triggerGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>• {releaseTriggerGateCopy.primaryGapLine}</Text>
          <Text style={releaseReadiness.triggerGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>• {releaseTriggerGateCopy.reasonLine}</Text>
          <Text style={releaseReadiness.triggerGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>• {releaseTriggerGateCopy.pendingCountLine}</Text>
          <Text style={releaseReadiness.triggerGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>• {releaseReadiness.triggerGateResponsibilitySummary}</Text>
          <Text style={styles.releaseFocusText}>• 触发说明：{releaseReadiness.testFlightTriggerPlanDetail}</Text>
          <Text style={styles.releaseFocusText}>• 建议命令：{releaseReadiness.testFlightTriggerCommand}</Text>
          <Text style={styles.releaseFocusText}>• 主按钮动作：{getReleaseActionLabel(releaseReadiness.primaryNextTarget, releaseReadiness.primaryNextLabel)}</Text>
          <Text style={styles.releaseFocusText}>• {releaseClosureCopy.summaryLine}</Text>
          <Text style={styles.releaseFocusText}>• {releaseClosureCopy.reasonLine}</Text>
          <Text style={styles.releaseFocusText}>• {releaseClosureCopy.commandLine}</Text>
          <Text style={releaseReadiness.buildGateReady ? styles.releaseBuildGateOk : styles.releaseBuildGateWarn}>
            • 首个 Build 三件套：{releaseReadiness.buildGateSummary}
          </Text>
          <Text style={releaseReadiness.buildGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>
            • 当前主卡点：{releaseReadiness.buildGatePrimaryGap ?? '三件套已闭合'}
          </Text>
          <Text style={releaseReadiness.buildGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>
            • 主卡点原因：{releaseReadiness.buildGatePrimaryGapDetail ?? releaseReadiness.buildGateDetail}
          </Text>
          <Text style={releaseReadiness.buildGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>
            • 剩余门禁数：{releaseReadiness.buildGatePendingCount} / 3
          </Text>
          {releaseReadiness.buildGateChecklist.map(item => (
            <Text
              key={item.id}
              style={item.ready ? styles.releaseFocusText : styles.releaseChecklistTextPending}>
              • {item.label}：{item.value}。{item.detail}
            </Text>
          ))}
          <Text style={styles.releaseFocusText}>• {releaseReadiness.buildGateDetail}</Text>
        </View>

        <View style={styles.releaseFocusBox}>
          <Text style={styles.releaseFocusTitle}>还差什么才能触发 Build</Text>
          {releaseBlockerSummary.map(item => (
            <Text key={`release-blocker-${item.label}`} style={styles.releaseFocusText}>
              • {item.label}：{item.detail}
            </Text>
          ))}
        </View>

        <View style={styles.releaseFocusBox}>
          <Text style={styles.releaseFocusTitle}>当前缺口</Text>
          {releaseReadiness.blockers.length > 0 ? (
            releaseReadiness.blockers.slice(0, 2).map(item => (
              <Text key={item} style={styles.releaseFocusText}>• {item}</Text>
            ))
          ) : (
            <Text style={styles.releaseFocusText}>• 代码侧已基本收口，下一步重点是 Apple 账号、App Store Connect 和真实 LIVE 闭环验证。</Text>
          )}
          <Text style={styles.releaseFocusText}>• {safeAppleReleaseSummary}</Text>
          {safeAppleMissingInputs.length > 0 && (
            <Text style={styles.releaseFocusText}>• Apple 预检明确缺项：{appleMissingInputLabel}</Text>
          )}
          <Text style={styles.releaseFocusText}>• Apple 当前状态：{releaseReadiness.appleStateLabel}</Text>
          <Text style={styles.releaseFocusText}>• Apple 校验新鲜度：{releaseReadiness.appleValidationLabel}</Text>
          <Text style={styles.releaseFocusText}>• Apple 预检详情：{appleValidationDetailLabel}</Text>
          <Text style={styles.releaseFocusText}>• 总预检状态：{releaseReadiness.preflightStateLabel}</Text>
          <Text style={styles.releaseFocusText}>• 总预检新鲜度：{releaseReadiness.preflightValidationLabel}</Text>
          <Text style={styles.releaseFocusText}>• 总预检详情：{preflightValidationDetailLabel}</Text>
          {preflightFailedChecks.length > 0 && (
            <Text style={styles.releaseFocusText}>• 总预检失败项：{preflightFailedChecks.join('、')}</Text>
          )}
          {safePreflightSteps.length > 0 && (
            <Text style={styles.releaseFocusText}>
              • 当前卡点：{currentPreflightStepLabel}
            </Text>
          )}
          {failedPreflightStepSummaries.map(item => (
            <Text key={`preflight-step-${item.label}`} style={styles.releaseFocusText}>
              • 预检步骤「{item.label}」失败：{item.detail}
            </Text>
          ))}
          {safePreflightNextActions.length > 0 && (
            <Text style={styles.releaseFocusText}>• 总预检建议动作：{safePreflightNextActions[0]}</Text>
          )}
          <Text style={styles.releaseFocusText}>• 素材当前状态：{releaseReadiness.appleAssetsStateLabel}</Text>
          <Text style={styles.releaseFocusText}>• 素材校验新鲜度：{releaseReadiness.appleAssetsValidationLabel}</Text>
          <Text style={styles.releaseFocusText}>• 素材预检详情：{assetsValidationDetailLabel}</Text>
          <Text style={styles.releaseFocusText}>• TestFlight 当前状态：{releaseReadiness.testFlightBuildLabel}</Text>
          <Text style={styles.releaseFocusText}>• TestFlight 触发计划：{releaseReadiness.testFlightTriggerPlanLabel}</Text>
          <Text style={styles.releaseFocusText}>• TestFlight 建议命令：{releaseReadiness.testFlightTriggerCommand}</Text>
          <Text style={releaseReadiness.triggerGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>• 仓库触发门禁：{releaseReadiness.triggerGateLabel}</Text>
          <Text style={releaseReadiness.triggerGateReady ? styles.releaseFocusText : styles.releaseChecklistTextPending}>• {releaseTriggerGateCopy.detailLine}</Text>
          {releaseReadiness.triggerGateTagName ? (
            <Text style={styles.releaseFocusText}>• 当前触发 tag：{releaseReadiness.triggerGateTagName}</Text>
          ) : null}
          {releaseReadiness.triggerGateFailures.map(item => (
            <Text key={`trigger-gate-${item}`} style={styles.releaseChecklistTextPending}>• 仓库态阻塞：{item}</Text>
          ))}
          {releaseReadiness.triggerGateUserInputFailures.length > 0 ? (
            <Text style={styles.releaseChecklistTextPending}>• 待用户补输入：{releaseReadiness.triggerGateUserInputFailures.join('；')}</Text>
          ) : null}
          {releaseReadiness.triggerGateVersionFailures.length > 0 ? (
            <Text style={styles.releaseChecklistTextPending}>• 待封版 / 改版本：{releaseReadiness.triggerGateVersionFailures.join('；')}</Text>
          ) : null}
          {releaseReadiness.triggerGateRepoCleanupFailures.length > 0 ? (
            <Text style={styles.releaseChecklistTextPending}>• 待仓库封版清理：{releaseReadiness.triggerGateRepoCleanupFailures.join('；')}</Text>
          ) : null}
          <Text style={styles.releaseFocusText}>• 上传闭环状态：{releaseReadiness.uploadStateLabel}</Text>
          <Text style={styles.releaseFocusText}>• 上传回流真值：{releaseReadiness.uploadReleaseTruthLabel}</Text>
          <Text style={styles.releaseFocusText}>• 上传真值说明：{releaseReadiness.uploadReleaseTruthDetail}</Text>
          <Text style={styles.releaseFocusText}>• 上传样本计数：{uploadEvidenceLine}</Text>
          <Text style={styles.releaseFocusText}>• 上传样本口径：{effectiveUploadEvidenceSummary}</Text>
          <Text style={styles.releaseFocusText}>• {latestLiveUploadDisplayLine}</Text>
          <Text style={styles.releaseFocusText}>• 上传样本新鲜度：{releaseReadiness.uploadValidationLabel}</Text>
          <Text style={styles.releaseFocusText}>• Apple 校验来源：{appleReleaseMeta}</Text>
          <Text style={styles.releaseFocusText}>• {releaseReadiness.appleValidationFresh ? '当前 Apple 校验仍在 72 小时有效窗内，可以直接拿来做提测依据。' : '当前 Apple 校验还没形成新鲜真值，提测前最好先重跑一轮预检。'}</Text>
          <Text style={styles.releaseFocusText}>• {releaseReadiness.buildReadyToTrigger ? '代码侧和运行态已经够用了，下一步就是去触发首个 TestFlight Build。' : '还不能直接触发首个 Build，先把运行态、Apple 校验、上传样本或确认链路里的缺口补平。'}</Text>
          <Text style={styles.releaseFocusText}>• {releaseReadiness.uploadValidationReady ? (releaseReadiness.uploadValidationFresh ? '真实上传回流样本已经有了，而且还在有效窗口内，附件链现在不是概念功能。' : '真实上传回流样本不是没有，而是已经偏旧了，提测前最好再跑一条新的。') : '真实上传回流样本还没补齐，提测前最好至少跑通一条图片/文档/视频样本。'}</Text>
          <Text style={styles.releaseFocusText}>• 建议下一步：{releaseReadiness.primaryNextAction}</Text>
        </View>

        <View style={styles.releaseActionRow}>
          <TouchableOpacity
            style={styles.releasePrimaryBtn}
            activeOpacity={0.82}
            onPress={() => openPrimaryReleaseTarget(releaseReadiness.primaryNextTarget)}
          >
            <Text style={styles.releasePrimaryBtnText}>{getReleaseActionLabel(releaseReadiness.primaryNextTarget, releaseReadiness.primaryNextLabel)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.releaseSecondaryBtn} activeOpacity={0.82} onPress={openFocusedConfirmations}>
            <Text style={styles.releaseSecondaryBtnText}>先清需确认项</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionTitle title="现在要处理什么" hint="把 AI 产出流、调度状态、需确认项顶到最前" />
      <View style={styles.actionQueueList}>
        {actionQueue.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.actionQueueCard}
            activeOpacity={0.85}
            onPress={item.onPress}
          >
            <View style={[styles.actionQueueAccent, {backgroundColor: item.accent}]} />
            <View style={styles.actionQueueBody}>
              <Text style={[styles.actionQueueTag, {color: item.accent}]}>{item.tag}</Text>
              <Text style={styles.actionQueueTitle}>{item.title}</Text>
              <Text style={styles.actionQueueDetail} numberOfLines={3}>{item.detail}</Text>
            </View>
            <Text style={styles.actionQueueArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle title="AI 产出流" hint="实时 AI 输出与系统事件" />
      <View style={styles.feedList}>
        {liveFeed.map(item => <FeedItem key={item.id} item={item} />)}
      </View>

      <SectionTitle
        title="调度链"
        hint="当前指令流转状态"
        action={{label: '展开链路', onPress: openFocusedDispatch}}
      />
      <View style={styles.dispatchBox}>
        {dispatchTrace.map((trace, i) => (
          <View key={trace.stage} style={styles.dispatchStep}>
            <View style={[styles.dispatchDot, i === dispatchTrace.length - 1 && styles.dispatchDotLast]} />
            {i < dispatchTrace.length - 1 && <View style={styles.dispatchLine} />}
            <View style={styles.dispatchCard}>
              <Text style={styles.dispatchTitle}>{trace.title}</Text>
              <Text style={styles.dispatchActor}>{trace.actor}</Text>
              <Text style={styles.dispatchDetail}>{trace.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <SectionTitle
        title="需确认项"
        hint={`${pendingConfirmations} 项待确认`}
        action={{label: '查看全部', onPress: openFocusedConfirmations}}
      />
      <View style={styles.confirmList}>
        {pendingConfirmationItems.length > 0 ? pendingConfirmationItems.slice(0, 3).map(item => {
          return (
            <View key={item.id} style={styles.confirmCard}>
              <View style={[styles.confirmDot, {backgroundColor: URGENCY_COLOR[item.urgency]}]} />
              <View style={styles.confirmText}>
                <View style={styles.confirmHeaderRow}>
                  <Text style={styles.confirmTitle}>{item.title}</Text>
                  <View style={styles.confirmStatusBadge}>
                    <Text style={styles.confirmStatusText}>待确认</Text>
                  </View>
                </View>
                <Text style={styles.confirmDesc}>{item.description}</Text>
                <Text style={styles.confirmMeta}>{item.agent} · {item.timestamp}</Text>
              </View>
            </View>
          );
        }) : (
          <View style={styles.confirmEmptyCard}>
            <Text style={styles.confirmEmptyTitle}>当前没有待确认项</Text>
            <Text style={styles.confirmEmptyDesc}>人工拍板链路已清空，首页不会再把已处理事项继续顶成待办。</Text>
          </View>
        )}
      </View>

      <SectionTitle
        title="记忆 · 知识 · 附件 · 项目"
        hint="点击进入对应模块"
      />
      <View style={styles.storeGrid}>
        {brainStores.map(store => (
          <StoreCard key={store.id} store={store} onPress={handleStorePress} />
        ))}
      </View>

      {/* ── 智慧矿山态势感知（实时增强） ── */}
      {smProduction?.today && (
        <>
          <SectionTitle
            title="⛏️ 矿山态势感知"
            hint={smIsLive ? '✨ 实时数据' : '智能体·实时数据'}
          />

          {/* 连接状态横幅 */}
          {!smConnected && (
            <View style={styles.smDisconnectedBanner}>
              <Text style={styles.smDisconnectedText}>
                ⚡ 实时连接断开，正在重连…
              </Text>
            </View>
          )}

          {/* 实时指示器 + 运行统计 */}
          {smConnected && (
            <View style={styles.smLiveIndicatorRow}>
              <View style={styles.smLivePill}>
                <View style={styles.smLiveDot} />
                <Text style={styles.smLivePillText}>LIVE</Text>
              </View>
              <Text style={styles.smLiveStats}>
                运行 {smRunningCount} / 故障 {smFaultCount} / 告警 {smCriticalCount}
              </Text>
            </View>
          )}

          <View style={styles.smSituationRow}>
            <View style={styles.smLeftCards}>
              <SmartMineCard
                title="今日产量"
                icon="⛏️"
                data={[
                  { label: '产量', value: smProduction?.today?.output ?? 0, unit: smProduction?.today?.unit ?? "吨", trend: smOutputTrend as ('up' | 'down' | 'stable') ?? 'stable', status: smOutputTrend === 'down' ? 'warning' as const : 'normal' as const },
                  { label: '回收率', value: smProduction?.today?.recovery ?? 0, unit: '%', trend: 'stable' as const, status: 'normal' as const },
                ]}
              />
              <SmartMineCard
                title="OEE · 安全"
                icon="📊"
                data={[
                  { label: 'OEE', value: smProduction?.today?.oee ?? 0, unit: '%', trend: 'up' as const, status: 'normal' as const },
                  { label: '安全天数', value: smProduction?.today?.safetyDays ?? 0, unit: '天', status: 'normal' as const },
                ]}
              />
            </View>
            <View style={styles.smEquipStatus}>
              <Text style={styles.smSectionLabel}>设备状态</Text>
              {smEquipment.slice(0, 5).map(eq => {
                const dotColor = eq.status === 'running' ? '#34d399' : eq.status === 'fault' ? C.error : '#94a3b8';
                return (
                  <View key={eq.id} style={styles.smEquipRow}>
                    <View style={[styles.smEquipDot, {backgroundColor: dotColor}]} />
                    <Text style={styles.smEquipName} numberOfLines={1}>{eq.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {smAlerts.length > 0 && (
            <View style={styles.smAlertSection}>
              <Text style={styles.smSectionLabel}>实时告警</Text>
              {smAlerts.slice(0, 3).map(alert => {
                const color = alert.level === 'critical' ? C.error : alert.level === 'warning' ? C.warning : C.primary;
                return (
                  <View key={alert.id} style={styles.smAlertRow}>
                    <View style={[styles.smAlertDot, {backgroundColor: color}]} />
                    <Text style={styles.smAlertText} numberOfLines={1}>{alert.title}</Text>
                    <Text style={[styles.smAlertTime, {color}]}>{alert.time}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {smCameras.length > 0 && (
            <View style={styles.smCameraRow}>
              <Text style={styles.smSectionLabel}>摄像头</Text>
              <View style={styles.smCameraDots}>
                {smCameras.map(cam => (
                  <View key={cam.id} style={styles.smCameraItem}>
                    <View style={[styles.smCameraDot, {backgroundColor: cam.status === 'online' ? '#34d399' : C.error}]} />
                    <Text style={styles.smCameraName} numberOfLines={1}>{cam.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.footer} />
    </ScrollView>
  );
}

const BR = 24;
const styles = StyleSheet.create({
  content: {padding: 16, paddingBottom: 100, gap: 0},

  hero: {
    borderRadius: BR + 4,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 24,
    minHeight: 160,
  },
  heroBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#060912',
    borderRadius: BR + 4,
  },
  heroGlowGreen: {
    position: 'absolute', top: -20, right: -20,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(77,255,136,0.08)',
    shadowColor: '#4DFF88',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  heroGlowBlue: {
    position: 'absolute', bottom: -30, left: -10,
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(26,56,180,0.12)',
  },
  heroGridLines: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.04,
  },
  heroContent: {
    position: 'relative',
    padding: 24,
    paddingTop: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  heroLeft: {flex: 1},
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 10,
  },
  heroBrand: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heroTitle: {
    color: C.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heroSub: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  heroTagline: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(77,255,136,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(77,255,136,0.3)',
  },
  liveDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary, marginRight: 6},
  liveDotFallback: {backgroundColor: '#f97316'},
  liveText: {color: C.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1},
  liveTextFallback: {color: '#f97316'},
  heroCorner: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 60, height: 60,
    borderTopLeftRadius: BR,
    backgroundColor: 'rgba(77,255,136,0.05)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(77,255,136,0.15)',
  },

  sectionLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  metricsScroll: {marginBottom: 8},
  metricsRow: {
    flexDirection: 'row',
    paddingRight: 20,
    paddingTop: 2,
    paddingBottom: 4,
  },

  metricsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24},
  demoHintBanner: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 12,
    gap: 10,
  },
  demoHintIcon: {fontSize: 22, marginBottom: 4},
  demoHintText: {flex: 1},
  demoHintTitle: {color: '#fbbf24', fontSize: 13, fontWeight: '700'},
  demoHintSub: {color: C.textMuted, fontSize: 11, marginTop: 3, lineHeight: 16},
  demoHintArrow: {color: '#fbbf24', fontSize: 20, fontWeight: '700'},
  demoSettingsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.15)',
    borderWidth: 1,
    borderColor: C.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  demoSettingsBtnText: {color: C.primary, fontSize: 12, fontWeight: '900'},
  summaryGrid: {gap: 10, marginBottom: 24},
  spotlightGrid: {gap: 10, marginBottom: 24},
  spotlightCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  spotlightEyebrow: {fontSize: 11, fontWeight: '900', letterSpacing: 0.5},
  spotlightTitle: {color: C.textTitle, fontSize: 16, fontWeight: '900', marginTop: 6},
  spotlightDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  spotlightAction: {fontSize: 12, fontWeight: '800', marginTop: 10},
  summaryCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  summaryLabel: {fontSize: 11, fontWeight: '900', letterSpacing: 0.5},
  summaryValue: {color: C.textTitle, fontSize: 17, fontWeight: '900', marginTop: 6},
  summaryDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  actionQueueList: {gap: 10, marginBottom: 24},
  releaseCard: {
    marginBottom: 24,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  releaseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  releaseHeaderTextBlock: {flex: 1},
  releaseEyebrow: {color: C.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.6},
  releaseTitle: {color: C.textTitle, fontSize: 18, fontWeight: '900', marginTop: 6},
  releaseDesc: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  releaseBadge: {
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  releaseBadgeText: {fontSize: 12, fontWeight: '900'},
  releaseChecklistRow: {gap: 8},
  releaseChecklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  releaseChecklistIcon: {fontSize: 13, lineHeight: 18},
  releaseChecklistText: {flex: 1, color: C.textBody, fontSize: 12, lineHeight: 18},
  releaseChecklistTextPending: {color: C.textMuted},
  releaseFocusBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 6,
  },
  releaseFocusTitle: {color: C.textTitle, fontSize: 13, fontWeight: '900'},
  releaseFocusText: {color: C.textBody, fontSize: 12, lineHeight: 18},
  releaseActionRow: {flexDirection: 'row', gap: 10},
  releasePrimaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  releasePrimaryBtnText: {color: C.bgRoot, fontSize: 13, fontWeight: '900'},
  releaseBuildGateOk: {color: '#34d399', fontSize: 12, lineHeight: 18, fontWeight: '800'},
  releaseBuildGateWarn: {color: '#fbbf24', fontSize: 12, lineHeight: 18, fontWeight: '800'},
  releaseSecondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1,
    borderColor: C.borderActive,
    alignItems: 'center',
  },
  releaseSecondaryBtnText: {color: C.primary, fontSize: 13, fontWeight: '800'},
  actionQueueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.62)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  actionQueueAccent: {width: 4, alignSelf: 'stretch', borderRadius: 999},
  actionQueueBody: {flex: 1},
  actionQueueTag: {fontSize: 11, fontWeight: '900', letterSpacing: 0.5},
  actionQueueTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900', marginTop: 4},
  actionQueueDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  actionQueueArrow: {color: C.textMuted, fontSize: 24, fontWeight: '300'},
  feedList: {gap: 9, marginBottom: 24},
  confirmList: {gap: 9, marginBottom: 24},
  storeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  overviewGrid: {gap: 10},

  focusBoard: {
    marginTop: 24,
    padding: 16,
    borderRadius: BR,
    backgroundColor: 'rgba(10,22,42,0.88)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  focusEyebrow: {color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1},
  focusTitle: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 4},
  focusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
  },
  focusBadgeText: {color: '#f97316', fontSize: 11, fontWeight: '900'},
  focusDesc: {color: C.textBody, fontSize: 13, lineHeight: 20, marginTop: 10},
  focusMeta: {color: C.textMuted, fontSize: 11, lineHeight: 17, marginTop: 8},
  quickActionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  quickActionChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  quickActionText: {color: C.primary, fontSize: 12, fontWeight: '800'},

  dispatchBox: {
    padding: 12,
    borderRadius: BR,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  dispatchStep: {flexDirection: 'row'},
  dispatchDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.primary,
    marginTop: 16,
    marginRight: 12,
  },
  dispatchDotLast: {backgroundColor: C.accent},
  dispatchLine: {
    width: 2, flex: 1,
    backgroundColor: 'rgba(56,100,200,0.25)',
    marginRight: 10,
  },
  dispatchCard: {
    flex: 1, marginBottom: 10, padding: 13, borderRadius: 18,
    backgroundColor: 'rgba(16,31,51,0.65)',
    borderWidth: 1, borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  dispatchTitle: {color: C.textTitle, fontWeight: '900', fontSize: 15},
  dispatchActor: {color: C.accent, fontWeight: '800', fontSize: 11, marginTop: 4},
  dispatchDetail: {color: C.textBody, fontSize: 13, lineHeight: 19, marginTop: 5},

  confirmCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmDot: {width: 8, height: 8, borderRadius: 4, marginTop: 6},
  confirmText: {flex: 1},
  confirmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  confirmTitle: {flex: 1, color: C.textTitle, fontSize: 14, fontWeight: '800'},
  confirmStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  confirmStatusText: {color: C.primary, fontSize: 10, fontWeight: '800'},
  confirmDesc: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 3},
  confirmMeta: {color: C.textMuted, fontSize: 11, marginTop: 4},
  confirmResolution: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5},
  confirmEmptyCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmEmptyTitle: {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  confirmEmptyDesc: {color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6},

  footer: {height: 32},

  // Agent 态势感知
  agentSitrepBoard: {
    marginTop: 16,
    padding: 14,
    borderRadius: BR,
    backgroundColor: 'rgba(10,22,42,0.88)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  agentSitrepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  agentSitrepTitle: {
    color: C.textTitle,
    fontSize: 15,
    fontWeight: '900',
  },
  agentSitrepMeta: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  agentSitrepMetaText: {
    color: C.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  agentDotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  agentDotCard: {
    width: '48%',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(16,31,51,0.65)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  agentDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agentDotName: {
    flex: 1,
    color: C.textTitle,
    fontSize: 12,
    fontWeight: '800',
  },
  agentWarningIcon: {
    fontSize: 10,
  },
  agentStatusLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  agentTaskInfo: {
    marginTop: 6,
    gap: 4,
  },
  agentTaskName: {
    color: C.textBody,
    fontSize: 10,
    lineHeight: 14,
  },
  agentProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(56,100,200,0.2)',
    overflow: 'hidden',
  },
  agentProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  agentProgressText: {
    color: C.textMuted,
    fontSize: 9,
    textAlign: 'right',
  },
  agentRuntimeInfo: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  agentRuntimeText: {
    color: C.textMuted,
    fontSize: 9,
  },

  // Smart Mine / 矿山态势感知
  smSituationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  smLeftCards: {
    flex: 1,
    gap: 10,
  },
  smEquipStatus: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 8,
  },
  smSectionLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  smEquipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smEquipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  smEquipName: {
    color: C.textBody,
    fontSize: 12,
    flex: 1,
  },
  smAlertSection: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 8,
    marginBottom: 12,
  },
  smAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smAlertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  smAlertText: {
    flex: 1,
    color: C.textBody,
    fontSize: 12,
  },
  smAlertTime: {
    fontSize: 11,
    fontWeight: '800',
  },
  smCameraRow: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 8,
    marginBottom: 12,
  },
  smCameraDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  smCameraItem: {
    alignItems: 'center',
    width: 52,
  },
  smCameraDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  smCameraName: {
    color: C.textMuted,
    fontSize: 9,
    textAlign: 'center',
  },

  // ── 实时感知增强样式 ─────────────────────────────────────────────────
  smDisconnectedBanner: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  smDisconnectedText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '600',
  },
  smLiveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  smLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  smLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
    marginRight: 5,
  },
  smLivePillText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  smLiveStats: {
    color: C.textMuted,
    fontSize: 11,
  },
  // ── Redesigned Hero + Header Styles ───────────────────────────────────────
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.pageMargin,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoText: {
    fontSize: 18,
    color: C.primary,
  },
  headerTitle: {
    color: C.textTitle,
    fontSize: 17,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 16,
  },

  // Hero
  heroNew: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: LAYOUT.pageMargin,
    position: 'relative',
  },
  bubbleContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  bubbleGlowOuter: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(77,255,136,0.06)',
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  bubbleGlowMiddle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(77,255,136,0.10)',
  },
  bubbleGlowInner: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(77,255,136,0.16)',
  },
  bubbleCore: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 8,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    left: 16,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.primary,
  },
  bubbleIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleIconText: {
    fontSize: 24,
  },
  heroSlogan: {
    color: C.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSloganZh: {
    color: C.primary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  heroSubtitle: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: LAYOUT.cardRadiusSmall,
    height: 50,
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 8,
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnIcon: {
    fontSize: 18,
    color: '#080A0F',
    fontWeight: '900',
  },
  ctaBtnText: {
    color: '#080A0F',
    fontSize: 15,
    fontWeight: '800',
  },

  // Action Cards
  actionCards: {
    paddingHorizontal: LAYOUT.pageMargin,
    gap: 12,
    marginBottom: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bgCard,
    borderRadius: LAYOUT.cardRadius,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 16,
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  actionCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardIconText: {
    fontSize: 20,
  },
  actionCardText: {
    flex: 1,
  },
  actionCardTitle: {
    color: C.textTitle,
    fontSize: 15,
    fontWeight: '800',
  },
  actionCardDesc: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  actionCardArrow: {
    color: C.textMuted,
    fontSize: 22,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: C.borderSubtle,
    marginHorizontal: LAYOUT.pageMargin,
    marginVertical: 20,
  },
});
