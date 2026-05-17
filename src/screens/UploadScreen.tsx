import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/constants';
import {useAppContext} from '../context/AppContext';
import {uploadService, enqueueUpload, type UploadFile, type UploadQueueStage} from '../services/uploadService';
import {launchImageLibrary, type ImagePickerResponse} from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import type {RootStackParamList} from '../App';
import {computeReleaseReadiness, type ReleaseActionTarget} from '../utils/releaseReadiness';
import {buildReleaseClosureCopy, buildReleaseTriggerGateCopy, getReleaseActionLabel} from '../utils/releaseActionLabel';
import {summarizeUploadReleaseEvidence, buildUploadEvidenceLine, mergeUploadReleaseEvidence, buildLatestLiveUploadTraceLine, hasMeaningfulLatestLiveUploadTrace} from '../utils/uploadReleaseEvidence';

const STATUS_META: Record<string, {label: string; color: string; bg: string}> = {
  queued:     {label:'排队中', color:'#94a3b8', bg:'rgba(148,163,184,0.1)'},
  uploading:  {label:'上传中', color: C.primary,  bg:'rgba(56,100,200,0.12)'},
  processing: {label:'处理中', color:'#818cf8', bg:'rgba(129,140,248,0.1)'},
  done:       {label:'已完成', color:'#34d399', bg:'rgba(52,211,153,0.1)'},
  dispatched: {label:'已分派', color:'#34d399', bg:'rgba(52,211,153,0.1)'},
  error:      {label:'失败',   color:'#f87171', bg:'rgba(248,113,113,0.1)'},
};

const QUEUE_STAGE_LABEL: Record<UploadQueueStage, string> = {
  queued: '等待上传',
  chunking: '分片准备中',
  uploading: '上传中',
  merging: '分片合并中',
  processing: '后台处理中',
  dispatched: '已进入调度链',
  done: '已完成',
  error: '上传失败',
};

function describeTransfer(file: UploadFile): string {
  const stage = QUEUE_STAGE_LABEL[file.queueStage] ?? '处理中';
  const executionLabel = file.executionMode === 'live'
    ? 'LIVE'
    : file.executionMode === 'simulated'
      ? '模拟'
      : '待判定';
  if (file.transferMode === 'direct') {
    return `直传 · ${executionLabel} · ${stage}`;
  }

  const chunkText = file.totalChunks
    ? `${file.uploadedChunks ?? 0}/${file.totalChunks} 片`
    : '分片模式';
  return `分片 / 断点续传 · ${executionLabel} · ${chunkText} · ${stage}`;
}

function FileTypeIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz')) return '📦';
  return '📎';
}

const PREFLIGHT_FRESH_MS = 72 * 60 * 60 * 1000;
const LIVE_UPLOAD_FRESH_MS = 72 * 60 * 60 * 1000;

function isFreshTimestamp(timestamp?: number, freshMs = 72 * 60 * 60 * 1000): boolean {
  return typeof timestamp === 'number'
    && Number.isFinite(timestamp)
    && Date.now() - timestamp <= freshMs;
}

function formatFreshness(timestamp?: number, freshMs = 72 * 60 * 60 * 1000): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return '未记录时间';
  }

  const ageMs = Date.now() - timestamp;
  if (ageMs <= 0) return '刚完成';
  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  if (ageHours < 1) return '1 小时内';
  if (ageHours < 24) return `${ageHours} 小时前`;
  const ageDays = Math.floor(ageHours / 24);
  return ageMs <= freshMs ? `${ageDays} 天前 · 仍在有效窗` : `${ageDays} 天前 · 已过期`;
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

function sortMostRecentFirst(files: UploadFile[], getTime: (file: UploadFile) => number | undefined): UploadFile[] {
  return [...files]
    .map((file, index) => ({file, index, time: getTime(file) ?? -1}))
    .sort((a, b) => {
      if (b.time !== a.time) return b.time - a.time;
      return b.index - a.index;
    })
    .map(item => item.file);
}

export function UploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Defensive: useRoute is a React Navigation hook that may not be available in test environments
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rawRoute = (typeof useRoute === 'function') ? useRoute() : null;
  const route = (rawRoute ?? {params: undefined}) as RouteProp<RootStackParamList, 'Upload'> | {params?: RootStackParamList['Upload']};
  const {
    runtimeMode,
    runtimeError,
    gatewayConfigValid,
    gatewayWarningCount,
    preflightOverallStatus,
    preflightBlockingCount,
    preflightNextActions,
    preflightFailedChecks,
    firstTestFlightBuildUploaded,
    preflightReportGeneratedAt,
    applePrerequisitesReady,
    appStoreAssetsReady,
    appleReleaseValidatedAt,
    appStoreAssetsValidatedAt,
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
  } = useAppContext();
  const [files, setFiles] = useState<UploadFile[]>([]);

  const focusFileId = route.params?.focusFileId;
  const focusDispatchId = route.params?.focusDispatchId;

  useEffect(() => {
    const unsubscribe = uploadService.subscribe(queue => {
      setFiles([...queue]);
    });

    return unsubscribe;
  }, []);

  const handleRetry = useCallback((file: UploadFile) => {
    uploadService.retryUpload(file.id);
    setFiles([...uploadService.getQueue()]);
  }, []);

  const handleUpload = useCallback(() => {
    Alert.alert(
      '📎 添加文件',
      '选择文件来源',
      [
        {
          text: '图片 / 视频',
          onPress: () => {
            launchImageLibrary({mediaType: 'mixed', selectionLimit: 0}, (res: ImagePickerResponse) => {
              if (res.didCancel || res.errorCode) return;
              (res.assets ?? []).forEach(asset => {
                if (!asset.uri) return;
                const name = asset.fileName ?? `file_${Date.now()}`;
                enqueueUpload(name, asset.uri, asset.type ?? 'application/octet-stream', asset.fileSize ?? 0);
              });
              setFiles([...uploadService.getQueue()]);
            });
          },
        },
        {
          text: '文档 / 其他',
          onPress: () => {
            DocumentPicker.pick({allowMultiSelection: true})
              .then((results) => {
                results.forEach(doc => {
                  if (!doc.uri) return;
                  enqueueUpload(doc.name ?? '文档', doc.uri, doc.type ?? 'application/octet-stream', doc.size ?? 0);
                });
                setFiles([...uploadService.getQueue()]);
              })
              .catch((err) => {
                if (DocumentPicker.isCancel(err)) return;
                Alert.alert('选择失败', String(err));
              });
          },
        },
        {text: '取消', style: 'cancel'},
      ],
    );
  }, []);

  const handleAnalyzeInChat = useCallback((file: UploadFile) => {
    uploadService.markFileForNextDispatch(file.id);
    navigation.navigate('Tabs', {screen: 'Chat'});
  }, [navigation]);

  const handleDelete = useCallback((fileId: string) => {
    Alert.alert('删除文件', '确定从上传队列中移除？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          uploadService.removeFile(fileId);
          setFiles([...uploadService.getQueue()]);
        },
      },
    ]);
  }, []);

  const rankedFiles = useMemo(() => {
    if (!focusFileId && !focusDispatchId) {
      return files;
    }

    const score = (file: UploadFile) => {
      if (focusFileId && file.id === focusFileId) return 0;
      if (focusDispatchId && file.dispatchId === focusDispatchId) return 1;
      return 9;
    };

    return [...files].sort((a, b) => score(a) - score(b));
  }, [files, focusDispatchId, focusFileId]);

  const completed = rankedFiles.filter(f => f.status === 'done');
  const dispatched = rankedFiles.filter(f => f.status === 'dispatched');
  const active    = rankedFiles.filter(f => f.status === 'uploading' || f.status === 'queued' || f.status === 'processing');
  const failed    = rankedFiles.filter(f => f.status === 'error');
  const spotlightFile = rankedFiles.find(file => file.id === focusFileId)
    ?? rankedFiles.find(file => focusDispatchId != null && file.dispatchId === focusDispatchId)
    ?? rankedFiles[0];
  const completedCount = completed.length;
  const dispatchedCount = dispatched.length;
  const uploadEvidence = useMemo(() => mergeUploadReleaseEvidence(
    summarizeUploadReleaseEvidence(rankedFiles),
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
    rankedFiles,
    releaseActiveUploads,
    releaseCompletedUploads,
    releaseLiveCompletedUploads,
    releaseSimulatedCompletedUploads,
    releaseLiveDispatchedOnlyUploads,
    releaseLatestLiveUploadCompletedAt,
    releaseLatestLiveUpload,
  ]);
  const uploadEvidenceLine = buildUploadEvidenceLine(uploadEvidence);
  const liveCompletedCount = uploadEvidence.liveCompletedUploads;
  const simulatedCompletedCount = uploadEvidence.simulatedCompletedUploads;
  const liveDispatchedOnlyCount = uploadEvidence.liveDispatchedOnlyUploads;
  const latestCompleted = sortMostRecentFirst(completed, file => file.completedAt)[0];
  const latestLiveCompleted = sortMostRecentFirst(
    completed.filter(file => file.executionMode === 'live'),
    file => file.completedAt,
  )[0];
  const latestLiveCompletedAt = uploadEvidence.latestLiveUploadCompletedAt;
  const latestLiveUploadTraceLine = buildLatestLiveUploadTraceLine(uploadEvidence, LIVE_UPLOAD_FRESH_MS);
  const hasMeaningfulLatestLiveTrace = hasMeaningfulLatestLiveUploadTrace(uploadEvidence);
  const liveUploadFresh = isFreshTimestamp(latestLiveCompletedAt, LIVE_UPLOAD_FRESH_MS);
  const preflightFresh = isFreshTimestamp(preflightReportGeneratedAt, PREFLIGHT_FRESH_MS);
  const latestDispatchedOnly = sortMostRecentFirst(
    dispatched.filter(file => file.executionMode === 'live'),
    () => undefined,
  )[0] ?? sortMostRecentFirst(dispatched, () => undefined)[0];
  const preflightActionHint = Array.isArray(preflightNextActions)
    ? preflightNextActions.find(item => typeof item === 'string' && item.trim())
    : undefined;
  const preflightFailedChecksLabel = Array.isArray(preflightFailedChecks) && preflightFailedChecks.length > 0
    ? preflightFailedChecks.join('、')
    : undefined;
  const appleMissingInputsLabel = Array.isArray(appleMissingInputs) && appleMissingInputs.length > 0
    ? appleMissingInputs.join('、')
    : undefined;
  const gatewayWarningCountForReadiness = typeof gatewayWarningCount === 'number' && Number.isFinite(gatewayWarningCount)
    ? gatewayWarningCount
    : runtimeMode === 'live' && gatewayConfigValid
      ? 0
      : 1;
  const preflightGeneratedAtLabel = typeof preflightReportGeneratedAt === 'number' && Number.isFinite(preflightReportGeneratedAt)
    ? new Date(preflightReportGeneratedAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;
  const releaseReadiness = useMemo(() => computeReleaseReadiness({
    runtimeMode,
    pendingConfirmations: 0,
    tasks: [],
    dispatches: [],
    activeUploads: uploadEvidence.activeUploads,
    completedUploads: uploadEvidence.completedUploads,
    liveCompletedUploads: uploadEvidence.liveCompletedUploads,
    liveDispatchedOnlyUploads: uploadEvidence.liveDispatchedOnlyUploads,
    latestLiveUploadCompletedAt: uploadEvidence.latestLiveUploadCompletedAt,
    latestLiveUpload: uploadEvidence.latestLiveUpload,
    applePrerequisitesReady,
    appStoreAssetsReady,
    appStoreAssetsValidatedAt,
    appleValidatedAt: appleReleaseValidatedAt,
    gatewayConfigValid,
    gatewayWarningCount: gatewayWarningCountForReadiness,
    appleMissingInputs,
    preflightOverallStatus,
    preflightReportGeneratedAt,
    preflightBlockingCount,
    preflightFailedChecks,
    triggerTagName,
    triggerGateReady,
    triggerGateFailures,
  }), [
    appleMissingInputs,
    applePrerequisitesReady,
    appStoreAssetsReady,
    appStoreAssetsValidatedAt,
    appleReleaseValidatedAt,
    gatewayConfigValid,
    gatewayWarningCountForReadiness,
    preflightBlockingCount,
    preflightFailedChecks,
    triggerTagName,
    triggerGateReady,
    triggerGateFailures,
    preflightOverallStatus,
    preflightReportGeneratedAt,
    runtimeMode,
    uploadEvidence,
  ]);

  const effectiveUploadEvidenceSummary = releaseUploadEvidenceSummary?.trim() || releaseReadiness.uploadEvidenceSummary;
  const latestLiveUploadDisplayLine = hasMeaningfulLatestLiveTrace && latestLiveUploadTraceLine
    ? latestLiveUploadTraceLine
    : releaseReadiness.latestLiveUploadLabel;
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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>📤 上传管理</Text>
            <Text style={styles.sub}>
              {files.length} 个文件{files.length > 0 ? ` · ${active.length} 上传中 · ${failed.length} 失败` : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.8} onPress={handleUpload}>
              <Text style={styles.uploadBtnText}>+ 上传</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {runtimeMode !== 'live' && (
        <View style={styles.runtimeBanner}>
          <Text style={styles.runtimeBannerIcon}>🛰️</Text>
          <View style={styles.runtimeBannerText}>
            <Text style={styles.runtimeBannerTitle}>当前为回退模式</Text>
            <Text style={styles.runtimeBannerSub}>
              {runtimeError
                ? runtimeError
                : gatewayConfigValid
                  ? 'Gateway 配置已就绪，可尝试切换至 LIVE 模式'
                  : '附件上传后需真实 Gateway 才能完成后续 AI 处理'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.runtimeBannerBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('GatewaySettings')}
          >
            <Text style={styles.runtimeBannerBtnText}>去配置</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {(spotlightFile || completedCount > 0 || dispatchedCount > 0 || preflightOverallStatus != null || files.length === 0) && (
          <View style={styles.closureCard}>
            <Text style={styles.closureEyebrow}>上传闭环</Text>
            <Text style={styles.closureTitle}>
              {spotlightFile
                ? `当前焦点：${spotlightFile.name}`
                : liveCompletedCount > 0 && !liveUploadFresh
                  ? '已有 LIVE 真回流样本，但提测真值已经过期'
                  : liveCompletedCount > 0
                    ? `最近已拿到 ${liveCompletedCount} 条 LIVE 真回流样本`
                    : simulatedCompletedCount > 0
                      ? '已有附件处理完成，但仍缺首条 LIVE 真回流'
                      : liveDispatchedOnlyCount > 0
                        ? `当前有 ${liveDispatchedOnlyCount} 条 LIVE 附件仍在等待最终回流`
                        : completedCount > 0
                          ? `最近已完成 ${completedCount} 个附件处理`
                          : dispatchedCount > 0
                            ? `当前有 ${dispatchedCount} 条附件仍在等待最终回流`
                            : '当前还没有 LIVE 真回流样本'}
            </Text>
            <Text style={styles.closureDetail}>
              {spotlightFile
                ? `${describeTransfer(spotlightFile)}${spotlightFile.dispatchId ? ` · 已关联调度 ${spotlightFile.dispatchId}` : ''}`
                : liveCompletedCount > 0 && !liveUploadFresh
                  ? '附件上传、后台处理和调度链不是没跑通，而是最近一条 LIVE 真回流已经过旧，提测前最好补一条新样本把上传真值刷新到有效窗口内。'
                  : liveCompletedCount > 0
                    ? '附件上传、后台处理和调度链已经形成可见闭环，而且最近一条 LIVE 真回流仍在提测有效窗内。'
                    : simulatedCompletedCount > 0
                      ? '现在看到的完成样本里仍有模拟回流，说明产品演示链路能走通，但它不能抵扣首条 LIVE done 缺口。'
                      : liveDispatchedOnlyCount > 0
                        ? '上传入口和调度链已经开始工作，但当前 LIVE 样本还只到 dispatched，缺最终 done 回流，暂时不能把它算成提测真值。'
                        : completedCount > 0
                          ? '附件上传、后台处理和调度链已经形成可见闭环。'
                          : dispatchedCount > 0
                            ? '上传入口和调度链已经开始工作，但还缺最终 done 回流，暂时不能把它算成提测真值。'
                            : '上传入口已经就绪，但提测口径下仍缺至少一条 LIVE Gateway 真回流样本。'}
            </Text>
            {liveCompletedCount > 0 ? (
              <Text style={styles.closureLiveText}>
                已拿到 {liveCompletedCount} 条 LIVE 真回流样本{latestLiveCompleted ? ` · 最近一条：${latestLiveCompleted.name}` : ''}
              </Text>
            ) : null}
            {simulatedCompletedCount > 0 ? (
              <Text style={styles.closureWarnText}>
                当前已完成里还有 {simulatedCompletedCount} 条模拟回流，仅用于产品演示；只有 LIVE Gateway 真回流样本才会计入提测真值。
                {liveCompletedCount <= 0 ? ' 这些模拟完成不能抵扣首条 LIVE done 缺口，提测前仍要补一条真实 Gateway 回流。' : ''}
              </Text>
            ) : spotlightFile?.executionMode === 'simulated' ? (
              <Text style={styles.closureWarnText}>
                当前附件为模拟回流，仅用于产品演示；要作为提测真值，还需要至少一条 LIVE Gateway 真回流样本。
              </Text>
            ) : null}
            {liveDispatchedOnlyCount > 0 ? (
              <Text style={styles.closureWarnText}>
                另有 {liveDispatchedOnlyCount} 条 LIVE 附件只到“已分派”，还没有最终 done 回流；即便已经进入真实调度链，也不能计入提测真值。
                {latestDispatchedOnly ? ` 当前最近一条：${latestDispatchedOnly.name}${latestDispatchedOnly.agent ? ` · ${latestDispatchedOnly.agent}` : ''}` : ''}
              </Text>
            ) : null}
            {latestLiveCompletedAt ? (
              <Text style={liveUploadFresh ? styles.closureLiveText : styles.closureWarnText}>
                最近一条 LIVE 真回流时间：{new Date(latestLiveCompletedAt).toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })} · {formatFreshness(latestLiveCompletedAt, LIVE_UPLOAD_FRESH_MS)}
                {liveUploadFresh ? '，可作为提测上传证据。' : '，已有 LIVE 真回流样本，但提测真值已经过期，最近一条 LIVE 真回流已经过旧，提测前建议补跑一条新样本。'}
              </Text>
            ) : null}
            {preflightOverallStatus ? (
              <Text style={preflightOverallStatus === 'PASS' && preflightFresh ? styles.closureLiveText : styles.closureWarnText}>
                TestFlight 总预检：{preflightOverallStatus}
                {typeof preflightBlockingCount === 'number' ? ` · 阻塞 ${preflightBlockingCount}` : ''}
                {preflightReportGeneratedAt ? ` · ${formatFreshness(preflightReportGeneratedAt, PREFLIGHT_FRESH_MS)}` : ' · 未记录时间'}
                {preflightOverallStatus === 'PASS'
                  ? preflightFresh
                    ? ' · 当前上传页看到的闭环证据可继续服务提测收口。'
                    : ' · PASS 记录已不够新鲜，触发 Build 前要重跑总预检。'
                  : ' · 当前上传真值还不能单独证明可提测，仍需先清掉总预检阻塞。'}
              </Text>
            ) : null}
            {preflightOverallStatus === 'PASS' && !preflightFresh ? (
              <Text style={styles.closureWarnText}>
                总预检 PASS 也有 72 小时有效窗；当前记录已过期，不能和新的上传样本一起作为触发 Build 的最终依据。
              </Text>
            ) : null}
            {preflightOverallStatus === 'FAIL' && preflightFailedChecksLabel ? (
              <Text style={styles.closureWarnText}>
                总预检失败项：{preflightFailedChecksLabel}
              </Text>
            ) : null}
            {preflightOverallStatus === 'FAIL' && appleMissingInputsLabel ? (
              <Text style={styles.closureWarnText}>
                当前 Apple 缺口：{appleMissingInputsLabel}
              </Text>
            ) : null}
            {preflightOverallStatus === 'FAIL' && preflightGeneratedAtLabel ? (
              <Text style={styles.closureWarnText}>
                最近总预检时间：{preflightGeneratedAtLabel}
              </Text>
            ) : null}
            {preflightOverallStatus === 'FAIL' && preflightActionHint ? (
              <Text style={styles.closureWarnText}>
                当前建议动作：{preflightActionHint}
              </Text>
            ) : null}
            <Text style={styles.closureSubtext}>
              提测准备度：{releaseReadiness.readiness}
            </Text>
            <Text style={styles.closureSubtext}>
              上传样本计数：{uploadEvidenceLine}
            </Text>
            <Text style={styles.closureSubtext}>
              上传样本口径：{effectiveUploadEvidenceSummary}
            </Text>
            <Text style={styles.closureSubtext}>
              {latestLiveUploadDisplayLine}
            </Text>
            <Text style={releaseReadiness.buildGateReady ? styles.closureLiveText : styles.closureWarnText}>
              首个 Build 三件套：{releaseReadiness.buildGateSummary}
              {releaseReadiness.buildGateReady ? '。三项运行态真值已同屏闭合，可进入触发前最后确认。' : '。三项必须同时为真，才能作为触发 TestFlight Build 的最终依据。'}
            </Text>
            <Text style={releaseReadiness.buildGateReady ? styles.closureSubtext : styles.closureWarnText}>
              当前主卡点：{releaseReadiness.buildGatePrimaryGap ?? '三件套已闭合'}
            </Text>
            <Text style={releaseReadiness.buildGateReady ? styles.closureSubtext : styles.closureWarnText}>
              主卡点原因：{releaseReadiness.buildGatePrimaryGapDetail ?? releaseReadiness.buildGateDetail}
            </Text>
            <Text style={releaseReadiness.buildGateReady ? styles.closureSubtext : styles.closureWarnText}>
              剩余门禁数：{releaseReadiness.buildGatePendingCount} / 3
            </Text>
            <Text style={releaseReadiness.buildReadyToTrigger ? styles.closureLiveText : styles.closureWarnText}>
              TestFlight 触发计划：{releaseReadiness.testFlightTriggerPlanLabel}
            </Text>
            <Text style={styles.closureSubtext}>
              建议命令：{releaseReadiness.testFlightTriggerCommand}
            </Text>
            <Text style={styles.closureSubtext}>{releaseClosureCopy.summaryLine}</Text>
            <Text style={styles.closureSubtext}>{releaseClosureCopy.reasonLine}</Text>
            <Text style={styles.closureSubtext}>{releaseClosureCopy.commandLine}</Text>
            <Text style={releaseReadiness.triggerGateReady ? styles.closureSubtext : styles.closureWarnText}>
              {releaseTriggerGateCopy.summaryLine}
            </Text>
            <Text style={releaseReadiness.triggerGateReady ? styles.closureSubtext : styles.closureWarnText}>
              {releaseTriggerGateCopy.primaryGapLine}
            </Text>
            <Text style={releaseReadiness.triggerGateReady ? styles.closureSubtext : styles.closureWarnText}>
              {releaseTriggerGateCopy.reasonLine}
            </Text>
            <Text style={releaseReadiness.triggerGateReady ? styles.closureSubtext : styles.closureWarnText}>
              {releaseTriggerGateCopy.detailLine}
            </Text>
            <Text style={releaseReadiness.triggerGateReady ? styles.closureSubtext : styles.closureWarnText}>
              {releaseTriggerGateCopy.pendingCountLine}
            </Text>
            <Text style={releaseReadiness.triggerGateReady ? styles.closureSubtext : styles.closureWarnText}>
              {releaseTriggerGateCopy.responsibilityLine}
            </Text>
            {releaseReadiness.triggerGateTagName ? (
              <Text style={styles.closureSubtext}>
                当前触发 tag：{releaseReadiness.triggerGateTagName}
              </Text>
            ) : null}
            {releaseReadiness.triggerGateFailures.map(item => (
              <Text key={`upload-trigger-gate-${item}`} style={styles.closureWarnText}>
                仓库态阻塞：{item}
              </Text>
            ))}
            {releaseReadiness.triggerGateUserInputFailures.length > 0 ? (
              <Text style={styles.closureWarnText}>
                待用户补输入：{releaseReadiness.triggerGateUserInputFailures.join('；')}
              </Text>
            ) : null}
            {releaseReadiness.triggerGateVersionFailures.length > 0 ? (
              <Text style={styles.closureWarnText}>
                待封版 / 改版本：{releaseReadiness.triggerGateVersionFailures.join('；')}
              </Text>
            ) : null}
            {releaseReadiness.triggerGateRepoCleanupFailures.length > 0 ? (
              <Text style={styles.closureWarnText}>
                待仓库封版清理：{releaseReadiness.triggerGateRepoCleanupFailures.join('；')}
              </Text>
            ) : null}
            {releaseReadiness.triggerGateChecklist.map(item => (
              <Text
                key={`upload-trigger-check-${item.id}`}
                style={item.ready ? styles.closureSubtext : styles.closureWarnText}>
                {item.label}：{item.value}。{item.detail}
              </Text>
            ))}
            {releaseReadiness.buildGateChecklist.map(item => (
              <Text
                key={item.id}
                style={item.ready ? styles.closureSubtext : styles.closureWarnText}>
                {item.label}：{item.value}。{item.detail}
              </Text>
            ))}
            <Text style={styles.closureSubtext}>
              下一步：{releaseReadiness.primaryNextAction}
            </Text>
            <View style={styles.closureActions}>
              {spotlightFile?.dispatchId ? (
                <TouchableOpacity
                  style={styles.closurePrimaryBtn}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('DispatchChain', {focusDispatchId: spotlightFile.dispatchId})}
                >
                  <Text style={styles.closurePrimaryBtnText}>查看调度链</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.closurePrimaryBtn}
                  activeOpacity={0.82}
                  onPress={() => openReleaseTarget(releaseReadiness.primaryNextTarget, navigation)}
                >
                  <Text style={styles.closurePrimaryBtnText}>{getReleaseActionLabel(releaseReadiness.primaryNextTarget, releaseReadiness.primaryNextLabel, 'decorated')}</Text>
                </TouchableOpacity>
              )}
              {spotlightFile ? (
                <TouchableOpacity
                  style={styles.closureSecondaryBtn}
                  activeOpacity={0.82}
                  onPress={() => handleAnalyzeInChat(spotlightFile)}
                >
                  <Text style={styles.closureSecondaryBtnText}>回到对话继续分析</Text>
                </TouchableOpacity>
              ) : files.length === 0 ? (
                <TouchableOpacity
                  style={styles.closureSecondaryBtn}
                  activeOpacity={0.82}
                  onPress={handleUpload}
                >
                  <Text style={styles.closureSecondaryBtnText}>先跑上传闭环</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {latestCompleted ? (
              <Text style={styles.closureSubtext}>
                最近完成：{latestCompleted.name}{latestCompleted.agent ? ` · ${latestCompleted.agent}` : ''}
              </Text>
            ) : null}
          </View>
        )}

        {/* Active uploads — always visible at top when any are running */}
        {active.length > 0 && (
          <View style={styles.activeBanner}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>
              {active.length} 个文件正在上传/处理中，结果会自动进入 AI 产出流
            </Text>
          </View>
        )}

        {/* 上传链路说明：不做大小限制 */}
        <View style={styles.uploadPolicyBanner}>
          <Text style={styles.uploadPolicyText}>
            📡 无大小限制 · 自动选择直传或分片续传 · 后台 AI 处理队列
          </Text>
        </View>

        {files.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>暂无上传任务</Text>
            <Text style={styles.emptyDesc}>
              直接点击下方按钮上传文件，无大小限制。
            </Text>
            <Text style={styles.emptyHint}>
              系统会按文件状态自动选择直传或分片续传，不需要你手动判断。
            </Text>
            <View style={styles.emptyUploadRow}>
              <TouchableOpacity
                style={styles.emptyUploadBtn}
                activeOpacity={0.8}
                onPress={handleUpload}
              >
                <Text style={styles.emptyUploadBtnText}>📎 选择文件上传</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.emptyNote}>
              上传后文件自动进入后台处理队列；只有标记为 LIVE 的回流样本才会计入提测真值。
            </Text>
          </View>
        ) : null}

        {files.length > 0 && (
          <>
            {/* Failed first */}
            {failed.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>❌ 失败 ({failed.length})</Text>
                {failed.map(f => {
                  const meta = STATUS_META[f.status] ?? STATUS_META.error;
                  const isFocused = focusFileId === f.id || (focusDispatchId && focusDispatchId === f.dispatchId);
                  return (
                    <View key={f.id} style={[styles.card, isFocused && styles.focusCard]}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.fileEmoji}>{FileTypeIcon(f.mimeType)}</Text>
                        </View>
                        <View style={styles.cardBody}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.fileMeta}>
                            {uploadService.formatBytes(f.size)} · {meta.label}
                          </Text>
                          {f.error ? (
                            <Text style={styles.errorText}>{f.error}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.retryBtn}
                          activeOpacity={0.75}
                          onPress={() => handleRetry(f)}
                        >
                          <Text style={styles.retryBtnText}>🔄 重试</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          activeOpacity={0.75}
                          onPress={() => handleDelete(f.id)}
                        >
                          <Text style={styles.deleteBtnText}>🗑 删除</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Active uploads */}
            {active.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>⏳ 进行中 ({active.length})</Text>
                {active.map(f => {
                  const meta = STATUS_META[f.status] ?? STATUS_META.uploading;
                  const isFocused = focusFileId === f.id || (focusDispatchId && focusDispatchId === f.dispatchId);
                  return (
                    <View key={f.id} style={[styles.card, isFocused && styles.focusCard]}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.fileEmoji}>{FileTypeIcon(f.mimeType)}</Text>
                        </View>
                        <View style={styles.cardBody}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.fileMeta}>
                            {uploadService.formatBytes(f.size)} · {meta.label}
                            {f.status === 'uploading' && ` · ${Math.round(f.progress)}%`}
                          </Text>
                          <Text style={styles.transferMeta}>{describeTransfer(f)}</Text>
                          {f.transferMode === 'chunked' && typeof f.totalChunks === 'number' ? (
                            <Text style={styles.chunkMeta}>已完成 {f.uploadedChunks ?? 0}/{f.totalChunks} 片</Text>
                          ) : null}
                          {(f.status === 'uploading' || f.status === 'processing') && (
                            <View style={styles.progressBar}>
                              <View style={[styles.progressFill, {width: `${f.progress}%`}]} />
                            </View>
                          )}
                        </View>
                        <Text style={styles.statusDot}>●</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>✅ 已完成 ({completed.length})</Text>
                {completed.map(f => {
                  const meta = STATUS_META[f.status] ?? STATUS_META.done;
                  const isFocused = focusFileId === f.id || (focusDispatchId && focusDispatchId === f.dispatchId);
                  return (
                    <View key={f.id} style={[styles.card, isFocused && styles.focusCard]}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.fileEmoji}>{FileTypeIcon(f.mimeType)}</Text>
                        </View>
                        <View style={styles.cardBody}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.fileMeta}>
                            {uploadService.formatBytes(f.size)} · {f.agent ? `分派给 ${f.agent}` : meta.label}
                          </Text>
                          {f.dispatchId ? (
                            <TouchableOpacity
                              style={styles.dispatchLink}
                              activeOpacity={0.7}
                              onPress={() => navigation.navigate('DispatchChain', {focusDispatchId: f.dispatchId})}
                            >
                              <Text style={styles.dispatchLinkText}>
                                🔗 查看调度单 {f.dispatchId.length > 18 ? `…${f.dispatchId.slice(-14)}` : f.dispatchId}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            style={styles.chatLink}
                            activeOpacity={0.78}
                            onPress={() => handleAnalyzeInChat(f)}
                          >
                            <Text style={styles.chatLinkText}>💬 回到对话继续分析</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(f.id)}>
                          <Text style={styles.doneIcon}>✓</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       {flex: 1, backgroundColor: C.bgRoot},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  headerRow:  {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  headerActions:{flexDirection: 'row', gap: 8, alignItems: 'center'},
  uploadBtn:  {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: C.primary,
  },
  uploadBtnText:{color: C.bgRoot, fontWeight: '900', fontSize: 14},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  content:    {padding: 16, paddingBottom: 100},

  emptyState: {
    alignItems: 'center', paddingVertical: 48,
    gap: 12,
  },
  emptyEmoji: {fontSize: 48},
  emptyTitle: {color: C.textTitle, fontSize: 18, fontWeight: '800'},
  emptyDesc:  {color: C.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingHorizontal: 32},
  emptyHint:  {color: C.primary, fontSize: 12, textAlign: 'center', paddingHorizontal: 32},
  emptyUploadRow: {marginTop: 8, flexDirection: 'row'},
  emptyUploadBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: C.primary,
  },
  emptyUploadBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
  emptyNote:  {color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6, fontStyle: 'italic', paddingHorizontal: 32},

  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  activeDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary},
  activeText: {color: C.primary, fontSize: 12, fontWeight: '800', flex: 1},

  closureCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.18)',
    marginBottom: 10,
  },
  closureEyebrow: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  closureTitle: {color: C.textTitle, fontSize: 16, fontWeight: '900'},
  closureDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  closureLiveText: {color: '#34d399', fontSize: 11, lineHeight: 17, marginTop: 6, fontWeight: '800'},
  closureWarnText: {color: '#fbbf24', fontSize: 11, lineHeight: 17, marginTop: 6, fontWeight: '700'},
  closureActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  closurePrimaryBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#34d399',
  },
  closurePrimaryBtnText: {color: C.bgRoot, fontSize: 13, fontWeight: '900'},
  closureSecondaryBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.borderSubtle,
  },
  closureSecondaryBtnText: {color: C.textTitle, fontSize: 13, fontWeight: '800'},
  closureSubtext: {color: C.textMuted, fontSize: 11, marginTop: 10},

  uploadPolicyBanner: {
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(52,211,153,0.07)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.18)',
  },
  uploadPolicyText: {color: '#34d399', fontSize: 11, fontWeight: '700', textAlign: 'center'},

  sectionTitle: {
    color: C.textMuted, fontSize: 11, fontWeight: '900',
    marginTop: 8, marginBottom: 8,
    letterSpacing: 1,
  },

  card: {
    padding: 14, borderRadius: 18,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
    marginBottom: 10,
  },
  focusCard: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
  },
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: 12},
  cardLeft: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  fileEmoji: {fontSize: 22},
  cardBody:  {flex: 1},
  fileName:  {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  fileMeta:  {color: C.textMuted, fontSize: 11, marginTop: 4},
  transferMeta: {color: C.textBody, fontSize: 11, marginTop: 6},
  chunkMeta: {color: C.textMuted, fontSize: 11, marginTop: 2},
  errorText: {color: '#f87171', fontSize: 11, marginTop: 4},
  statusDot: {fontSize: 16, color: C.primary},
  doneIcon:  {fontSize: 18, color: '#34d399', fontWeight: '900'},

  progressBar: {
    marginTop: 8, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(56,100,200,0.2)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2, backgroundColor: C.primary,
  },

  cardActions: {flexDirection: 'row', gap: 8, marginTop: 10},
  retryBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.15)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  retryBtnText: {color: C.primary, fontSize: 13, fontWeight: '800'},
  deleteBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
  },
  deleteBtnText: {color: '#f87171', fontSize: 13, fontWeight: '800'},

  footer: {height: 24},

  dispatchLink: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(56,100,200,0.1)',
    alignSelf: 'flex-start',
  },
  dispatchLinkText: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  chatLink: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(52,211,153,0.1)',
    alignSelf: 'flex-start',
  },
  chatLinkText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },

  runtimeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
  runtimeBannerIcon: {fontSize: 20},
  runtimeBannerText: {flex: 1},
  runtimeBannerTitle: {color: '#f97316', fontSize: 13, fontWeight: '800'},
  runtimeBannerSub: {color: C.textMuted, fontSize: 11, marginTop: 3, lineHeight: 16},
  runtimeBannerBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
  },
  runtimeBannerBtnText: {color: '#f97316', fontSize: 12, fontWeight: '800'},
});
