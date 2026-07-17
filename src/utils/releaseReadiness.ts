import type {Task, DispatchRecord, RuntimeMode} from '../types';
import {
  buildLatestLiveUploadTraceLine,
  hasMeaningfulLatestLiveUploadTrace,
  type LatestLiveUploadTrace,
} from './uploadReleaseEvidence';

export type ReleaseReadinessLevel = '可提测' | '待收口' | '未就绪';

export interface ReleaseChecklistItem {
  done: boolean;
  text: string;
}

export interface AppleMaterialItem {
  done: boolean;
  label: string;
}

export type ReleaseActionTarget = 'profile' | 'gateway' | 'confirmations' | 'upload';
export type ReleaseTriggerGateResponsibility = 'user-input' | 'release-version' | 'repo-cleanup' | 'remote-check' | 'repo-state';

export interface ReleaseBuildGateItem {
  id: 'gateway' | 'upload' | 'preflight';
  label: string;
  value: string;
  ready: boolean;
  detail: string;
}

export interface ReleaseTriggerGateItem {
  id: 'workspace' | 'local-tag' | 'remote-tag' | 'remote-check' | 'repo-state';
  label: string;
  value: string;
  ready: boolean;
  detail: string;
  failures: string[];
  responsibility: ReleaseTriggerGateResponsibility;
  responsibilityLabel: string;
  actionHint: string;
}

export interface ReleaseReadinessResult {
  readiness: ReleaseReadinessLevel;
  readinessAccent: string;
  readinessDesc: string;
  blockers: string[];
  nextActions: string[];
  topBlocker?: string;
  primaryNextAction: string;
  primaryNextTarget: ReleaseActionTarget;
  primaryNextLabel: string;
  checklist: ReleaseChecklistItem[];
  appleMaterials: AppleMaterialItem[];
  appleValidationFresh: boolean;
  appleStateLabel: string;
  appleValidationLabel: string;
  appleAssetsValidationFresh: boolean;
  appleAssetsStateLabel: string;
  appleAssetsValidationLabel: string;
  preflightValidationFresh: boolean;
  preflightStateLabel: string;
  preflightValidationLabel: string;
  testFlightBuildLabel: string;
  buildReadyToTrigger: boolean;
  launchStepLabel: string;
  launchStepDetail: string;
  uploadValidationReady: boolean;
  uploadValidationFresh: boolean;
  uploadStateLabel: string;
  uploadValidationLabel: string;
  latestLiveUploadLabel: string;
  latestLiveUploadTraceLabel?: string;
  uploadEvidenceSummary: string;
  uploadReleaseTruthLabel: string;
  uploadReleaseTruthDetail: string;
  gatewayBuildGateLabel: string;
  uploadBuildGateLabel: string;
  preflightBuildGateLabel: string;
  buildGateChecklist: ReleaseBuildGateItem[];
  buildGateReady: boolean;
  buildGateSummary: string;
  buildGateDetail: string;
  buildGatePendingCount: number;
  buildGatePrimaryGap?: string;
  buildGatePrimaryGapDetail?: string;
  testFlightTriggerPlanLabel: string;
  testFlightTriggerPlanDetail: string;
  testFlightTriggerCommand: string;
  triggerGateTagName?: string;
  triggerGateLabel: string;
  triggerGateDetail: string;
  triggerGateReady: boolean;
  triggerGateFailures: string[];
  triggerGateChecklist: ReleaseTriggerGateItem[];
  triggerGateSummary: string;
  triggerGatePendingCount: number;
  triggerGatePrimaryGap?: string;
  triggerGatePrimaryGapDetail?: string;
  triggerGateResponsibilitySummary: string;
  triggerGateUserInputFailures: string[];
  triggerGateVersionFailures: string[];
  triggerGateRepoCleanupFailures: string[];
  liveDispatchedOnlyUploads: number;
  doneCount: number;
  totalCount: number;
}

export interface ReleaseBlockerSummary {
  label: string;
  detail: string;
}

export function prioritizeReleaseChecklist(
  checklist: ReleaseChecklistItem[],
  limit = checklist.length,
): ReleaseChecklistItem[] {
  const safeChecklist = Array.isArray(checklist) ? checklist : [];
  const pending = safeChecklist.filter(item => !item.done);
  const done = safeChecklist.filter(item => item.done);
  return [...pending, ...done].slice(0, Math.max(0, limit));
}

interface ComputeReleaseReadinessParams {
  runtimeMode: RuntimeMode;
  pendingConfirmations: number;
  tasks: Task[];
  dispatches: DispatchRecord[];
  activeUploads: number;
  completedUploads?: number;
  liveCompletedUploads?: number;
  liveDispatchedOnlyUploads?: number;
  latestLiveUploadCompletedAt?: number;
  latestLiveUpload?: LatestLiveUploadTrace;
  /**
   * True only after Apple Developer / App Store Connect / GitHub CI variables
   * have been configured and structurally validated. The mobile app cannot read
   * GitHub secrets directly, so callers should pass this only from an explicit
   * release-check source; default is intentionally false to avoid claiming
   * TestFlight readiness while the Apple side is still missing.
   */
  applePrerequisitesReady?: boolean;
  firstTestFlightBuildUploaded?: boolean;
  appStoreAssetsReady?: boolean;
  appStoreAssetsValidatedAt?: number;
  /**
   * Timestamp of the latest explicit Apple/TestFlight readiness validation.
   * Even when prerequisites are marked ready, stale or missing validation should
   * keep TestFlight readiness from being treated as fully closed.
   */
  appleValidatedAt?: number;
  gatewayConfigValid?: boolean;
  gatewayWarningCount?: number;
  appleMissingInputs?: string[];
  preflightOverallStatus?: 'PASS' | 'FAIL';
  preflightReportGeneratedAt?: number;
  preflightBlockingCount?: number;
  preflightFailedChecks?: string[];
  triggerTagName?: string;
  triggerGateReady?: boolean;
  triggerGateFailures?: string[];
}

const APPLE_VALIDATION_STALE_MS = 72 * 60 * 60 * 1000;
const UPLOAD_VALIDATION_STALE_MS = 72 * 60 * 60 * 1000;
const PREFLIGHT_VALIDATION_STALE_MS = 72 * 60 * 60 * 1000;

function formatFreshnessLabel(validatedAt?: number, staleMs = APPLE_VALIDATION_STALE_MS): string {
  if (!validatedAt) {
    return '未记录最近一次校验时间';
  }

  const ageMs = Date.now() - validatedAt;
  if (ageMs <= 0) {
    return '刚完成校验';
  }

  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  if (ageHours < 1) {
    return '1 小时内刚校验';
  }
  if (ageHours < 24) {
    return `${ageHours} 小时前校验`;
  }

  const ageDays = Math.floor(ageHours / 24);
  if (ageMs <= staleMs) {
    return `${ageDays} 天前校验（仍在有效窗内）`;
  }
  return `${ageDays} 天前校验（已过期）`;
}

type TriggerGateCategory = ReleaseTriggerGateItem['id'];

function getTriggerGateResponsibility(category: TriggerGateCategory, failures: string[]): ReleaseTriggerGateResponsibility {
  const joined = failures.join('；');
  if (/APPLE|ASC|ISSUER|TEAM|GITHUB|SECRET|凭证|密钥|输入|配置/i.test(joined)) {
    return 'user-input';
  }
  if (category === 'local-tag' || category === 'remote-tag' || /tag|版本|封版|重复触发|改版本|沿用|删除重建/i.test(joined)) {
    return 'release-version';
  }
  if (category === 'workspace') {
    return 'repo-cleanup';
  }
  if (category === 'remote-check') {
    return 'remote-check';
  }
  return 'repo-state';
}

function getTriggerGateResponsibilityLabel(responsibility: ReleaseTriggerGateResponsibility): string {
  switch (responsibility) {
    case 'user-input':
      return '用户补输入';
    case 'release-version':
      return '封版 / 改版本';
    case 'repo-cleanup':
      return '仓库封版清理';
    case 'remote-check':
      return '远端检查';
    case 'repo-state':
    default:
      return '仓库状态处理';
  }
}

function getTriggerGateActionHint(responsibility: ReleaseTriggerGateResponsibility): string {
  switch (responsibility) {
    case 'user-input':
      return '补齐缺失输入后重跑 npm run preflight:testflight。';
    case 'release-version':
      return '先人工确认沿用、删除重建或改版本号，再允许 trigger:testflight 打 tag。';
    case 'repo-cleanup':
      return '先完成封版提交或清理工作区，再重跑触发门禁。';
    case 'remote-check':
      return '先确认远端 tag 检查可达，再重跑触发门禁。';
    case 'repo-state':
    default:
      return '先处理仓库态阻塞，再重跑触发门禁。';
  }
}

function summarizeTriggerGateResponsibilities(items: ReleaseTriggerGateItem[]): string {
  const pending = items.filter(item => !item.ready);
  if (pending.length === 0) {
    return '仓库触发责任：已闭合，无需额外处理。';
  }

  const userInputCount = pending.filter(item => item.responsibility === 'user-input').length;
  const versionCount = pending.filter(item => item.responsibility === 'release-version').length;
  const cleanupCount = pending.filter(item => item.responsibility === 'repo-cleanup').length;
  const remoteCheckCount = pending.filter(item => item.responsibility === 'remote-check').length;
  const repoStateCount = pending.filter(item => item.responsibility === 'repo-state').length;
  const parts = [
    userInputCount > 0 ? `用户补输入 ${userInputCount} 项` : undefined,
    versionCount > 0 ? `封版 / 改版本 ${versionCount} 项` : undefined,
    cleanupCount > 0 ? `仓库封版清理 ${cleanupCount} 项` : undefined,
    remoteCheckCount > 0 ? `远端检查 ${remoteCheckCount} 项` : undefined,
    repoStateCount > 0 ? `仓库状态处理 ${repoStateCount} 项` : undefined,
  ].filter(Boolean);

  return `仓库触发责任：${parts.join('；')}`;
}

function getTriggerGateCategory(failure: string): TriggerGateCategory {
  if (/工作区|未提交|dirty/i.test(failure)) {
    return 'workspace';
  }
  if (/本地.*tag|local.*tag|已存在.*本地/i.test(failure)) {
    return 'local-tag';
  }
  if (/远端.*检查|检查.*远端|remote.*check|ls-remote/i.test(failure)) {
    return 'remote-check';
  }
  if (/远端|origin|remote/i.test(failure)) {
    return 'remote-tag';
  }
  if (/tag/i.test(failure)) {
    return 'local-tag';
  }
  return 'repo-state';
}

function buildTriggerGateChecklist(
  failures: string[],
  triggerGateLabel: string,
  effectiveTriggerGateReady: boolean,
  firstTestFlightBuildUploaded: boolean,
): ReleaseTriggerGateItem[] {
  const baseItems: Array<Omit<ReleaseTriggerGateItem, 'value' | 'ready' | 'detail' | 'failures'>> = [
    {
      id: 'workspace',
      label: '工作区门禁',
      responsibility: 'repo-cleanup',
      responsibilityLabel: getTriggerGateResponsibilityLabel('repo-cleanup'),
      actionHint: '先清理或暂存未提交改动，再重新执行触发门禁校验。',
    },
    {
      id: 'local-tag',
      label: '本地 tag 门禁',
      responsibility: 'release-version',
      responsibilityLabel: getTriggerGateResponsibilityLabel('release-version'),
      actionHint: '处理本地重复 tag 或更新版本号后，再重新执行触发门禁校验。',
    },
    {
      id: 'remote-tag',
      label: '远端 tag 门禁',
      responsibility: 'release-version',
      responsibilityLabel: getTriggerGateResponsibilityLabel('release-version'),
      actionHint: '确认远端 tag 状态并避免重复版本后，再重新执行触发门禁校验。',
    },
    {
      id: 'remote-check',
      label: '远端检查门禁',
      responsibility: 'remote-check',
      responsibilityLabel: getTriggerGateResponsibilityLabel('remote-check'),
      actionHint: '先恢复远端可达性并完成 ls-remote 校验，再重新执行触发门禁校验。',
    },
  ];

  if (firstTestFlightBuildUploaded) {
    return [{
      id: 'repo-state',
      label: '仓库触发门禁',
      value: triggerGateLabel,
      ready: true,
      detail: '首个 Build 已上传，不再需要重复校验本轮 tag 触发门禁。',
      failures: [],
      responsibility: 'repo-state',
      responsibilityLabel: getTriggerGateResponsibilityLabel('repo-state'),
      actionHint: '首个 Build 已上传，无需重复触发。',
    }];
  }

  const failuresByCategory = failures.reduce<Record<TriggerGateCategory, string[]>>((acc, failure) => {
    const category = getTriggerGateCategory(failure);
    acc[category] = [...(acc[category] ?? []), failure];
    return acc;
  }, {
    workspace: [],
    'local-tag': [],
    'remote-tag': [],
    'remote-check': [],
    'repo-state': [],
  });

  const checklist = baseItems.map(item => {
    const itemFailures = failuresByCategory[item.id] ?? [];
    const ready = effectiveTriggerGateReady || itemFailures.length === 0;
    const responsibility = getTriggerGateResponsibility(item.id, itemFailures);
    return {
      ...item,
      value: ready ? '未发现阻塞' : itemFailures.join('；'),
      ready,
      detail: ready
        ? `${item.label}未阻塞 trigger:testflight。`
        : `${item.label}未通过：${itemFailures.join('；')}`,
      failures: itemFailures,
      responsibility,
      responsibilityLabel: getTriggerGateResponsibilityLabel(responsibility),
      actionHint: getTriggerGateActionHint(responsibility),
    };
  });

  if (failuresByCategory['repo-state'].length > 0) {
    const responsibility = getTriggerGateResponsibility('repo-state', failuresByCategory['repo-state']);
    checklist.push({
      id: 'repo-state',
      label: '其他仓库门禁',
      value: failuresByCategory['repo-state'].join('；'),
      ready: false,
      detail: `其他仓库态阻塞：${failuresByCategory['repo-state'].join('；')}`,
      failures: failuresByCategory['repo-state'],
      responsibility,
      responsibilityLabel: getTriggerGateResponsibilityLabel(responsibility),
      actionHint: getTriggerGateActionHint(responsibility),
    });
  }

  return [...checklist.filter(item => !item.ready), ...checklist.filter(item => item.ready)];
}

export function summarizeReleaseBlockers(result: ReleaseReadinessResult): ReleaseBlockerSummary[] {
  const items: ReleaseBlockerSummary[] = [];

  if (!result.buildGateChecklist[0]?.ready) {
    items.push({
      label: 'Gateway / 运行态',
      detail: `${result.gatewayBuildGateLabel}。${result.buildGateChecklist[0]?.detail ?? ''}`,
    });
  }

  if (!result.buildGateChecklist[1]?.ready) {
    items.push({
      label: '上传回流真值',
      detail: `${result.uploadReleaseTruthLabel}。${result.uploadReleaseTruthDetail}`,
    });
  }

  if (!result.buildGateChecklist[2]?.ready) {
    items.push({
      label: 'TestFlight 总预检',
      detail: `${result.preflightStateLabel}。${result.buildGateChecklist[2]?.detail ?? ''}`,
    });
  }

  if (result.appleStateLabel !== 'Apple 前置 72 小时内已校验') {
    items.push({
      label: 'Apple 账号与提测前置',
      detail: `${result.appleStateLabel}。${result.appleValidationLabel}`,
    });
  }

  if (!result.triggerGateReady) {
    items.push({
      label: '仓库触发门禁',
      detail: `${result.triggerGateLabel}。${result.triggerGateDetail}`,
    });
  }

  if (result.appleAssetsStateLabel !== '素材真值 72 小时内已校验') {
    items.push({
      label: 'App Store 素材',
      detail: `${result.appleAssetsStateLabel}。${result.appleAssetsValidationLabel}`,
    });
  }

  if (result.blockers.some(item => item.includes('需确认项未拍板'))) {
    const blocker = result.blockers.find(item => item.includes('需确认项未拍板'));
    items.push({label: '人工确认项', detail: blocker ?? '仍有待确认项影响提测节奏。'});
  }

  if (result.blockers.some(item => item.includes('阻塞任务'))) {
    const blocker = result.blockers.find(item => item.includes('阻塞任务'));
    items.push({label: '阻塞任务', detail: blocker ?? '仍有阻塞任务影响提测。'});
  }

  if (items.length === 0) {
    items.push({label: '当前状态', detail: '代码侧、运行态、上传真值和 Apple 预检已经收口，可进入首个 Build 触发。'});
  }

  return items;
}

export function computeReleaseReadiness({
  runtimeMode,
  pendingConfirmations,
  tasks,
  dispatches,
  activeUploads,
  completedUploads = 0,
  liveCompletedUploads,
  liveDispatchedOnlyUploads = 0,
  latestLiveUploadCompletedAt,
  latestLiveUpload,
  applePrerequisitesReady = false,
  firstTestFlightBuildUploaded = false,
  appStoreAssetsReady = false,
  appStoreAssetsValidatedAt,
  appleValidatedAt,
  gatewayConfigValid = true,
  gatewayWarningCount = 0,
  appleMissingInputs = [],
  preflightOverallStatus,
  preflightReportGeneratedAt,
  preflightBlockingCount,
  preflightFailedChecks = [],
  triggerTagName,
  triggerGateReady,
  triggerGateFailures = [],
}: ComputeReleaseReadinessParams): ReleaseReadinessResult {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeDispatches = Array.isArray(dispatches) ? dispatches : [];
  const safeAppleMissingInputs = Array.isArray(appleMissingInputs)
    ? appleMissingInputs.map(item => String(item).trim()).filter(Boolean)
    : [];
  const safePreflightFailedChecks = Array.isArray(preflightFailedChecks)
    ? [...new Set(preflightFailedChecks.map(item => String(item).trim()).filter(Boolean))]
    : [];
  const safeTriggerGateFailures = Array.isArray(triggerGateFailures)
    ? [...new Set(triggerGateFailures.map(item => String(item).trim()).filter(Boolean))]
    : [];
  const effectiveLiveDispatchedOnlyUploads = typeof liveDispatchedOnlyUploads === 'number' && Number.isFinite(liveDispatchedOnlyUploads)
    ? Math.max(0, Math.floor(liveDispatchedOnlyUploads))
    : 0;
  const effectivePreflightBlockingCount = typeof preflightBlockingCount === 'number' && Number.isFinite(preflightBlockingCount)
    ? Math.max(0, Math.floor(preflightBlockingCount))
    : preflightOverallStatus === 'FAIL'
      ? Math.max(1, safePreflightFailedChecks.length)
      : 0;
  const preflightFailedChecksLabel = safePreflightFailedChecks.length > 0
    ? safePreflightFailedChecks.join('、')
    : '未知预检项';
  const appleMissingInputLabel = safeAppleMissingInputs.length > 0
    ? safeAppleMissingInputs.join('、')
    : 'APPLE_API_KEY_ID / APPLE_API_ISSUER_ID / APPLE_TEAM_ID / APPLE_API_KEY_CONTENT';

  const blockedTasks = safeTasks.filter(task => task.state === 'blocked').length;
  const dispatchInFlight = safeDispatches.filter(item => item.status !== 'completed' && item.status !== 'failed').length;
  const hasExplicitCompletedUploads = typeof completedUploads === 'number' && Number.isFinite(completedUploads);
  const hasExplicitLiveCompletedUploads = typeof liveCompletedUploads === 'number' && Number.isFinite(liveCompletedUploads);
  const hasExplicitLiveUploadTimestamp = typeof latestLiveUploadCompletedAt === 'number' && Number.isFinite(latestLiveUploadCompletedAt);
  const hasExplicitLatestLiveUpload = !!latestLiveUpload
    && typeof latestLiveUpload === 'object'
    && (
      (typeof latestLiveUpload.name === 'string' && latestLiveUpload.name.trim().length > 0)
      || (typeof latestLiveUpload.dispatchId === 'string' && latestLiveUpload.dispatchId.trim().length > 0)
      || (typeof latestLiveUpload.agent === 'string' && latestLiveUpload.agent.trim().length > 0)
    );
  const hasExplicitLiveUploadInputs = hasExplicitLiveCompletedUploads
    || hasExplicitLiveUploadTimestamp
    || effectiveLiveDispatchedOnlyUploads > 0
    || hasExplicitLatestLiveUpload;
  const latestUploadValidationAt = hasExplicitLiveUploadTimestamp
    ? latestLiveUploadCompletedAt
    : undefined;
  const hasRecentUploadEvidence = latestUploadValidationAt != null;
  const effectiveLiveCompletedUploads = hasExplicitLiveCompletedUploads
    ? Math.max(0, Math.floor(liveCompletedUploads))
    : hasExplicitLiveUploadInputs && hasRecentUploadEvidence
      ? 1
      : 0;
  const explicitCompletedUploads = hasExplicitCompletedUploads
    ? Math.max(0, Math.floor(completedUploads))
    : 0;
  const effectiveCompletedUploads = hasExplicitLiveUploadInputs
    ? Math.max(explicitCompletedUploads, effectiveLiveCompletedUploads)
    : explicitCompletedUploads;

  const blockers: string[] = [];
  const nextActions: string[] = [];

  if (runtimeMode !== 'live') {
    blockers.push('当前仍在本地回退模式，TestFlight 前需至少验证一轮 LIVE 闭环。');
    nextActions.push('优先恢复 Gateway 连通性并验证真实调度链。');
  }

  if (!gatewayConfigValid) {
    blockers.push('Gateway 配置未通过校验，TestFlight 真机无法稳定进入真实 AI 闭环。');
    nextActions.push('先到 Gateway 设置页补齐 URL、Token 与目标 Session，再做 LIVE 闭环验证。');
  } else if (gatewayWarningCount > 0) {
    blockers.push(`Gateway 配置还有 ${gatewayWarningCount} 个上线前提醒，需确认真机网络可达性与安全性。`);
    nextActions.push('处理 Gateway 设置页提醒，尤其避免真机继续指向 localhost 或不可达内网地址。');
  }

  if (preflightOverallStatus === 'FAIL' || effectivePreflightBlockingCount > 0) {
    blockers.push(`TestFlight 总预检仍未通过，当前还有 ${effectivePreflightBlockingCount || 1} 个结构化阻塞：${preflightFailedChecksLabel}。`);
    nextActions.push('先重新跑 npm run preflight:testflight，并逐项处理总预检 failedChecks 后再触发 tag。');
  } else if (preflightOverallStatus === 'PASS' && !preflightReportGeneratedAt) {
    blockers.push('TestFlight 总预检虽然显示 PASS，但还缺最近一次预检时间，当前不能直接当成可提测真值。');
    nextActions.push('补记最近一次 npm run preflight:testflight 的生成时间，并确认 PASS 报告来自当前代码与配置。');
  } else if (preflightOverallStatus === 'PASS' && preflightReportGeneratedAt != null && Date.now() - preflightReportGeneratedAt > PREFLIGHT_VALIDATION_STALE_MS) {
    blockers.push('TestFlight 总预检上次通过时间已经过旧，提测前应重新跑一轮预检确认当前代码、配置和素材仍然一致。');
    nextActions.push('重新跑 npm run preflight:testflight，并用最新 PASS 报告覆盖过期预检时间。');
  }

  if (pendingConfirmations > 0) {
    blockers.push(`还有 ${pendingConfirmations} 条需确认项未拍板，会上线体验里留下“待人工决策”缺口。`);
    nextActions.push('先清掉需确认项，确保闭环不是卡在人工拍板。');
  }

  if (blockedTasks > 0) {
    blockers.push(`当前有 ${blockedTasks} 条阻塞任务，提测前应至少收口到可解释状态。`);
    nextActions.push('进入任务页处理阻塞项，避免 TestFlight 首屏出现未解释异常。');
  }

  if (effectiveLiveCompletedUploads <= 0) {
    if (effectiveLiveDispatchedOnlyUploads > 0) {
      blockers.push(`已有 ${effectiveLiveDispatchedOnlyUploads} 条 LIVE 附件只到已分派，还没有最终 done 回流，不能作为提测上传闭环真值。`);
      nextActions.push('继续等待或补跑 LIVE 上传，直到 Gateway 返回最终 done 回流并记录 completedAt。');
    }
    blockers.push('上传入口已经做出来了，但还缺至少一轮真实附件上传回流样本，当前不能算真正验证过上传闭环。');
    nextActions.push('补跑至少一条真实图片/文档/视频上传回流，让附件链真正进一次后台处理与结果回流。');
  } else if (!latestUploadValidationAt) {
    blockers.push('上传链路虽然已有成功样本，但还没记录最近一次真实回流时间，当前不适合把它当成提测真值。');
    nextActions.push('补记一次真实上传回流完成时间，最好直接保留对应 dispatch 记录，避免上传链只剩“做过”没有“最近做过”。');
  } else if (Date.now() - latestUploadValidationAt > UPLOAD_VALIDATION_STALE_MS) {
    blockers.push('上传链路上次真实回流样本已经过旧，提测前最好再跑一条新样本确认附件链还活着。');
    nextActions.push('重新跑一条真实图片/文档/视频上传回流，并确认最新 dispatch 状态已写回前台。');
  }

  if (activeUploads > 0) {
    nextActions.push(`当前有 ${activeUploads} 条附件链路在跑，建议补看上传管理页确认回流正常。`);
  }

  if (dispatchInFlight > 0) {
    nextActions.push(`当前有 ${dispatchInFlight} 条调度仍在推进，建议补看调度链确认状态回流。`);
  }

  if (!applePrerequisitesReady) {
    blockers.push(`Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets 尚未验证，当前明确缺项：${appleMissingInputLabel}，暂不能真正上传 TestFlight。`);
    nextActions.push(`补齐 Apple Developer、App Store Connect App 记录，以及 GitHub Variables / Secrets（${appleMissingInputLabel}）后，先运行 validate:testflight 预检。`);
  } else if (!appleValidatedAt) {
    blockers.push('Apple 前置项虽然被标记为已就绪，但还缺最近一次校验时间，当前不能直接当成可提测真值。');
    nextActions.push('补记一次 Apple / TestFlight 预检时间，并在触发提测前重新跑一轮 validate:testflight。');
  } else if (Date.now() - appleValidatedAt > APPLE_VALIDATION_STALE_MS) {
    blockers.push('Apple 前置项上次校验时间已经过旧，提测前应重新验证 App Store Connect / API Key / CI 变量仍然可用。');
    nextActions.push('重新跑一轮 validate:testflight，并更新最新 Apple 校验时间后再触发 TestFlight。');
  }

  if (!appStoreAssetsReady) {
    blockers.push('App Store 素材真值还没显式通过，App Icon / 三尺寸截图 / 隐私页至少要先完成一轮真实校验。');
    nextActions.push('先跑一次 validate:assets，并把 App Icon、三尺寸截图和隐私页真值校验结果写回运行态。');
  } else if (!appStoreAssetsValidatedAt) {
    blockers.push('App Store 素材虽然已标记通过，但还缺最近一次素材校验时间，当前不能直接当成提测真值。');
    nextActions.push('补记一次 validate:assets 校验时间，并在提测前重新核对 Icon、截图和隐私页产物。');
  } else if (Date.now() - appStoreAssetsValidatedAt > APPLE_VALIDATION_STALE_MS) {
    blockers.push('App Store 素材真值校验时间已经过旧，提测前应重新核对 Icon、截图和隐私页产物仍然一致。');
    nextActions.push('重新跑一轮 validate:assets，并更新最新素材校验时间后再触发 TestFlight。');
  }

  const triggerGateHasBlockingFailures = !firstTestFlightBuildUploaded && safeTriggerGateFailures.length > 0;
  const triggerGateExplicitlyBlocked = !firstTestFlightBuildUploaded && triggerGateReady === false;

  if (triggerGateHasBlockingFailures || triggerGateExplicitlyBlocked) {
    const triggerGateFailureLabel = safeTriggerGateFailures.length > 0
      ? safeTriggerGateFailures.join('；')
      : '仓库触发门禁未通过，但当前缺少结构化失败详情';
    blockers.push(`trigger:testflight 仓库态仍未收口：${triggerGateFailureLabel}。`);
    nextActions.push(`先清理 trigger:testflight 的仓库态阻塞（${triggerGateFailureLabel}），再触发首个 Build。`);
  }

  if (!firstTestFlightBuildUploaded) {
    nextActions.push('先跑一次 npm run preflight:testflight；通过后再触发第一个 v0.1.0 TestFlight Build，并确认 App Store Connect 出现可安装构建。');
  }

  if (!nextActions.length) {
    nextActions.push('P1 闭环状态稳定，Apple 链路也已通过预检，可继续推进 TestFlight 分发。');
  }

  const readiness: ReleaseReadinessLevel = blockers.length === 0
    ? '可提测'
    : blockers.length <= 3
      ? '待收口'
      : '未就绪';

  const readinessAccent = readiness === '可提测'
    ? '#34d399'
    : readiness === '待收口'
      ? '#fbbf24'
      : '#f97316';

  const readinessDesc = readiness === '可提测'
    ? '五主功能、真实运行态和 Apple CI 前置项都已形成可提测闭环。'
    : readiness === '待收口'
      ? '主功能已基本贯通，但还有少量运行态或 Apple 链路缺口要先补齐。'
      : '当前仍存在明显运行态或上线链路缺口，先别急着触发 TestFlight。';

  const checklist: ReleaseChecklistItem[] = [
    {done: true, text: 'React Native 主工程 + iOS 构建'},
    {done: true, text: '五主功能（总览 / 对话 / 智能体 / 任务 / 我的）'},
    {done: true, text: '记忆库 / 知识库 / 附件入口 / 调度链已接入前台'},
    {done: true, text: 'GitHub Actions + Fastlane TestFlight 链路已预置'},
    {done: runtimeMode === 'live', text: '至少完成一轮 LIVE 网关闭环验证'},
    {done: gatewayConfigValid && gatewayWarningCount === 0, text: 'Gateway 真机可达配置无阻塞提醒'},
    {done: preflightOverallStatus === 'PASS' && effectivePreflightBlockingCount === 0 && !!preflightReportGeneratedAt && Date.now() - preflightReportGeneratedAt <= PREFLIGHT_VALIDATION_STALE_MS, text: 'TestFlight 总预检结构化结果 PASS（最近 72 小时内）'},
    {done: effectiveLiveCompletedUploads > 0, text: '至少完成一轮真实附件上传回流验证'},
    {done: effectiveLiveCompletedUploads > 0 && !!latestUploadValidationAt && Date.now() - latestUploadValidationAt <= UPLOAD_VALIDATION_STALE_MS, text: '真实上传回流样本最近 72 小时内仍有效'},
    {done: effectiveLiveDispatchedOnlyUploads === 0, text: '不存在仅分派但未 done 的 LIVE 上传样本'},
    {done: pendingConfirmations === 0, text: '需确认项清零或压到可解释范围'},
    {done: blockedTasks === 0, text: '阻塞任务收口到可提测状态'},
    {done: !!appStoreAssetsValidatedAt && Date.now() - appStoreAssetsValidatedAt <= APPLE_VALIDATION_STALE_MS, text: 'App Store 素材真值最近 72 小时内已校验'},
    {done: applePrerequisitesReady, text: 'Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets'},
    {done: !!appleValidatedAt && Date.now() - appleValidatedAt <= APPLE_VALIDATION_STALE_MS, text: 'Apple / TestFlight 前置项最近 72 小时内已校验'},
  ];

  const appleMaterials: AppleMaterialItem[] = [
    {done: appStoreAssetsReady, label: '1024×1024 App Icon'},
    {done: appStoreAssetsReady, label: 'iPhone 6.7" / 6.5" / 5.5" 截图'},
    {done: appStoreAssetsReady, label: '隐私政策文件与截图脚本'},
    {done: !!appStoreAssetsValidatedAt && Date.now() - appStoreAssetsValidatedAt <= APPLE_VALIDATION_STALE_MS, label: '最近 72 小时内已重跑 App Store 素材真值校验'},
    {done: applePrerequisitesReady, label: 'Apple Developer 账号与 Team ID'},
    {done: applePrerequisitesReady, label: 'App Store Connect App 记录'},
    {done: applePrerequisitesReady, label: 'App Store Connect API Key + GitHub Variables & Secrets（APPLE_API_KEY_ID / APPLE_API_ISSUER_ID / APPLE_TEAM_ID / APPLE_API_KEY_CONTENT）'},
    {done: applePrerequisitesReady, label: 'App Store Connect 隐私信息 / 年龄分级 / 支持链接'},
    {done: !!appleValidatedAt && Date.now() - appleValidatedAt <= APPLE_VALIDATION_STALE_MS, label: '最近 72 小时内已重跑 Apple / TestFlight 预检'},
    {done: applePrerequisitesReady, label: '已具备触发第一个 TestFlight Build 的前置条件'},
    {done: firstTestFlightBuildUploaded, label: '第一个 TestFlight Build 已上传并进入 App Store Connect 处理队列'},
  ];

  const topBlocker = blockers.find(item => item.includes('Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets')) ?? blockers[0];
  const primaryNextAction = nextActions.find(item => item.includes('补齐 Apple Developer'))
    ?? nextActions.find(item => item.includes('npm run preflight:testflight'))
    ?? nextActions.find(item => item.includes('validate:assets'))
    ?? nextActions.find(item => item.includes('触发第一个 v0.1.0 TestFlight Build'))
    ?? nextActions[0]
    ?? '继续推进 TestFlight 收口。';

  const appleValidationFresh = !!appleValidatedAt && Date.now() - appleValidatedAt <= APPLE_VALIDATION_STALE_MS;
  const appleAssetsValidationFresh = !!appStoreAssetsValidatedAt && Date.now() - appStoreAssetsValidatedAt <= APPLE_VALIDATION_STALE_MS;
  const appleNeedsAttention = !applePrerequisitesReady || !appleValidationFresh;
  const appleAssetsNeedAttention = !appStoreAssetsReady || !appleAssetsValidationFresh;
  const simulatedCompletedCount = Math.max(0, effectiveCompletedUploads - effectiveLiveCompletedUploads);
  const uploadValidationReady = effectiveLiveCompletedUploads > 0;
  const uploadValidationFresh = uploadValidationReady
    && !!latestUploadValidationAt
    && Date.now() - latestUploadValidationAt <= UPLOAD_VALIDATION_STALE_MS;
  const uploadBuildGateReady = uploadValidationReady
    && uploadValidationFresh
    && effectiveLiveDispatchedOnlyUploads === 0;
  const preflightValidationFresh = !!preflightReportGeneratedAt
    && Date.now() - preflightReportGeneratedAt <= PREFLIGHT_VALIDATION_STALE_MS;

  const buildGateReady = runtimeMode === 'live'
    && gatewayConfigValid
    && gatewayWarningCount === 0
    && uploadBuildGateReady
    && preflightOverallStatus === 'PASS'
    && !!preflightReportGeneratedAt
    && preflightValidationFresh
    && effectivePreflightBlockingCount === 0;

  const buildReadyToTrigger = applePrerequisitesReady
    && appleValidationFresh
    && appStoreAssetsReady
    && appleAssetsValidationFresh
    && buildGateReady
    && pendingConfirmations === 0
    && blockedTasks === 0
    && !firstTestFlightBuildUploaded;

  const appleStateLabel = !applePrerequisitesReady
    ? 'Apple 前置未补齐'
    : !appleValidatedAt
      ? 'Apple 已配置但缺校验时间'
      : appleValidationFresh
        ? 'Apple 前置 72 小时内已校验'
        : 'Apple 校验已过期';

  const appleValidationLabel = !applePrerequisitesReady
    ? 'Apple 前置未形成可校验真值'
    : formatFreshnessLabel(appleValidatedAt, APPLE_VALIDATION_STALE_MS);

  const appleAssetsStateLabel = !appStoreAssetsReady
    ? 'App Store 素材真值未通过'
    : !appStoreAssetsValidatedAt
      ? '素材已通过但缺校验时间'
      : appleAssetsValidationFresh
        ? '素材真值 72 小时内已校验'
        : '素材真值校验已过期';

  const appleAssetsValidationLabel = !appStoreAssetsReady
    ? '素材真值尚未形成可校验记录'
    : formatFreshnessLabel(appStoreAssetsValidatedAt, APPLE_VALIDATION_STALE_MS);

  const preflightStateLabel = preflightOverallStatus === 'PASS'
    ? preflightValidationFresh
      ? '总预检 PASS 且仍在有效窗内'
      : '总预检 PASS 但已过期'
    : preflightOverallStatus === 'FAIL'
      ? `总预检 FAIL${effectivePreflightBlockingCount > 0 ? ` · 阻塞 ${effectivePreflightBlockingCount}` : ''}`
      : '总预检尚未形成真值';

  const preflightValidationLabel = !preflightReportGeneratedAt
    ? '未记录最近一次总预检时间'
    : formatFreshnessLabel(preflightReportGeneratedAt, PREFLIGHT_VALIDATION_STALE_MS);

  const testFlightBuildLabel = firstTestFlightBuildUploaded
    ? '首个 TestFlight Build 已上传'
    : buildReadyToTrigger
      ? '可触发首个 TestFlight Build'
      : applePrerequisitesReady
        ? 'Apple 前置已配置，但首个 Build 门禁未闭合'
        : '首个 TestFlight Build 仍不可触发';

  const uploadStateLabel = !uploadValidationReady
    ? activeUploads > 0
      ? '上传链路执行中，仍待首个真实回流样本'
      : '上传闭环未验证'
    : !latestUploadValidationAt
      ? '上传闭环做过，但缺最近验证时间'
      : uploadValidationFresh
        ? activeUploads > 0
          ? '上传闭环已验证，当前仍有队列在跑'
          : '上传闭环已验证'
        : '上传回流样本已过期';

  const uploadValidationLabel = !uploadValidationReady
    ? effectiveLiveDispatchedOnlyUploads > 0
      ? `已有 ${effectiveLiveDispatchedOnlyUploads} 条 LIVE 仅分派样本，仍缺最终 done 回流`
      : '还没有首个真实回流样本'
    : !latestUploadValidationAt
      ? '未记录最近一次真实回流时间'
      : formatFreshnessLabel(latestUploadValidationAt, UPLOAD_VALIDATION_STALE_MS);

  const latestLiveUploadName = typeof latestLiveUpload?.name === 'string' && latestLiveUpload.name.trim()
    ? latestLiveUpload.name.trim()
    : undefined;

  const latestLiveUploadCoreLabel = !uploadValidationReady
    ? effectiveLiveDispatchedOnlyUploads > 0
      ? latestLiveUploadName
        ? `暂无 LIVE 真回流样本；${latestLiveUploadName} 仍未完成最终回流，当前有 ${effectiveLiveDispatchedOnlyUploads} 条 LIVE 样本停在已分派`
        : `暂无 LIVE 真回流样本；${effectiveLiveDispatchedOnlyUploads} 条 LIVE 仍停在已分派`
      : latestLiveUploadName
        ? `暂无 LIVE 真回流样本；最近样本 ${latestLiveUploadName} 仍未形成可用提测证据`
        : '暂无 LIVE 真回流样本'
    : !latestUploadValidationAt
      ? latestLiveUploadName
        ? `LIVE 真回流样本存在，但时间未记录：${latestLiveUploadName}`
        : 'LIVE 真回流样本存在，但时间未记录'
      : latestLiveUploadName
        ? `最近一条 LIVE 真回流：${latestLiveUploadName} · ${new Date(latestUploadValidationAt).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : `最近一条 LIVE 真回流：${new Date(latestUploadValidationAt).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}`;

  const latestLiveUploadTraceLabel = hasMeaningfulLatestLiveUploadTrace({
    activeUploads,
    completedUploads: effectiveCompletedUploads,
    liveCompletedUploads: effectiveLiveCompletedUploads,
    simulatedCompletedUploads: simulatedCompletedCount,
    liveDispatchedOnlyUploads: effectiveLiveDispatchedOnlyUploads,
    latestLiveUploadCompletedAt: latestUploadValidationAt,
    latestLiveUpload,
  })
    ? buildLatestLiveUploadTraceLine({
        activeUploads,
        completedUploads: effectiveCompletedUploads,
        liveCompletedUploads: effectiveLiveCompletedUploads,
        simulatedCompletedUploads: simulatedCompletedCount,
        liveDispatchedOnlyUploads: effectiveLiveDispatchedOnlyUploads,
        latestLiveUploadCompletedAt: latestUploadValidationAt,
        latestLiveUpload,
      }, UPLOAD_VALIDATION_STALE_MS)
    : undefined;

  const latestLiveUploadLabel = latestLiveUploadCoreLabel;

  const uploadReleaseTruthLabel = uploadValidationReady && uploadValidationFresh
    ? 'LIVE done 可作为提测真值'
    : uploadValidationReady && !uploadValidationFresh
      ? 'LIVE done 已过期，需刷新样本'
      : effectiveLiveDispatchedOnlyUploads > 0
        ? 'LIVE dispatched-only 不能作为提测真值'
        : simulatedCompletedCount > 0
          ? '非 LIVE 完成不能作为提测真值'
          : activeUploads > 0
            ? '上传处理中，等待 LIVE done 真回流'
            : '尚无 LIVE done 提测真值';

  const uploadReleaseTruthDetail = uploadValidationReady && uploadValidationFresh
    ? '最近 72 小时内已有 LIVE Gateway 最终 done 回流，可抵扣 TestFlight 上传闭环门槛。'
    : uploadValidationReady && !uploadValidationFresh
      ? '虽然曾经拿到 LIVE done，但最近一条样本已超过 72 小时有效窗，触发 Build 前应重新跑一条。'
      : effectiveLiveDispatchedOnlyUploads > 0
        ? `已有 ${effectiveLiveDispatchedOnlyUploads} 条 LIVE 上传只到 dispatched，还缺最终 done 回流；已分派不等于后台处理完成。`
        : simulatedCompletedCount > 0
          ? '当前只有 simulated / 非 LIVE 完成样本，能证明演示流程可走，但不能证明真机 Gateway 上传闭环可提测。'
          : activeUploads > 0
            ? '上传队列正在跑，等至少一条 LIVE 样本进入最终 done 并记录 completedAt 后，才算提测真值。'
            : '当前没有任何可用于提测的 LIVE done 样本，必须先跑一条真实附件上传回流。';

  const gatewayBuildGateLabel = runtimeMode === 'live'
    ? gatewayConfigValid && gatewayWarningCount === 0
      ? 'Gateway LIVE 已就绪'
      : gatewayConfigValid
        ? `Gateway 仍有 ${gatewayWarningCount} 个提醒`
        : 'Gateway 配置未通过'
    : 'Gateway 仍在回退模式';

  const uploadBuildGateLabel = uploadValidationReady && uploadValidationFresh && effectiveLiveDispatchedOnlyUploads > 0
    ? `LIVE done 有效但仍有 ${effectiveLiveDispatchedOnlyUploads} 条仅分派`
    : uploadValidationReady && uploadValidationFresh
      ? `LIVE done 有效（${effectiveLiveCompletedUploads} 条）`
      : uploadValidationReady && !uploadValidationFresh
      ? 'LIVE done 已过期'
      : effectiveLiveDispatchedOnlyUploads > 0
        ? 'LIVE 仅分派，缺 done'
        : simulatedCompletedCount > 0
          ? '只有模拟完成，缺 LIVE done'
          : activeUploads > 0
            ? '上传处理中，等待 LIVE done'
            : '缺 LIVE done 样本';

  const preflightBuildGateLabel = preflightOverallStatus === 'PASS'
    ? preflightValidationFresh
      ? '总预检 PASS 有效'
      : '总预检 PASS 已过期'
    : preflightOverallStatus === 'FAIL'
      ? '总预检 FAIL'
      : '总预检未生成';

  const buildGateSummary = `${gatewayBuildGateLabel} · ${uploadBuildGateLabel} · ${preflightBuildGateLabel}`;
  const buildGateChecklist: ReleaseBuildGateItem[] = [
    {
      id: 'gateway',
      label: 'Gateway 门禁',
      value: gatewayBuildGateLabel,
      ready: runtimeMode === 'live' && gatewayConfigValid && gatewayWarningCount === 0,
      detail: runtimeMode === 'live' && gatewayConfigValid && gatewayWarningCount === 0
        ? '真机运行态已指向可用 Gateway，可作为首个 Build 的真实 AI 闭环前提。'
        : '首个 Build 前必须先确认真机不再停留在 fallback、localhost 或不可达 Gateway。',
    },
    {
      id: 'upload',
      label: '上传门禁',
      value: uploadBuildGateLabel,
      ready: uploadBuildGateReady,
      detail: uploadBuildGateReady
        ? '最近 72 小时内已有 LIVE 最终 done 回流，且没有 LIVE dispatched-only 尾巴，可作为附件链提测真值。'
        : uploadValidationReady && uploadValidationFresh && effectiveLiveDispatchedOnlyUploads > 0
          ? `虽然最近 72 小时内已有 LIVE 最终 done 回流，但仍有 ${effectiveLiveDispatchedOnlyUploads} 条 LIVE 样本只到 dispatched；首个 Build 前应等它们 done 或明确清理队列，避免把未完成上传尾巴带进提测。`
          : uploadReleaseTruthDetail,
    },
    {
      id: 'preflight',
      label: '预检门禁',
      value: preflightBuildGateLabel,
      ready: preflightOverallStatus === 'PASS' && preflightValidationFresh && effectivePreflightBlockingCount === 0,
      detail: preflightOverallStatus === 'PASS' && preflightValidationFresh && effectivePreflightBlockingCount === 0
        ? '总预检 PASS 且仍在 72 小时有效窗内，可作为触发 Build 前的当前代码真值。'
        : preflightOverallStatus === 'FAIL'
          ? `总预检仍有阻塞：${preflightFailedChecksLabel}。`
          : '触发 Build 前必须重新生成最近 72 小时内的 PASS 总预检报告。',
    },
  ];
  const buildGateDetail = buildGateReady
    ? '三项运行态真值已同屏闭合，可进入触发 TestFlight Build 前最后确认。'
    : '三项必须同时为真，才能作为触发 TestFlight Build 的最终依据。';
  const pendingBuildGates = buildGateChecklist.filter(item => !item.ready);
  const buildGatePendingCount = pendingBuildGates.length;
  const buildGatePrimaryGap = pendingBuildGates[0]
    ? `${pendingBuildGates[0].label}：${pendingBuildGates[0].value}`
    : undefined;
  const buildGatePrimaryGapDetail = pendingBuildGates[0]?.detail;

  const uploadEvidenceSummaryLabel = uploadValidationReady && uploadValidationFresh
    ? '提测真值 已拿到 LIVE done'
    : uploadValidationReady && !uploadValidationFresh
      ? '提测真值 LIVE done 已过期'
      : effectiveLiveDispatchedOnlyUploads > 0
        ? 'LIVE dispatched-only 不能作为提测真值'
        : simulatedCompletedCount > 0
          ? '提测真值 仍是模拟样本'
          : activeUploads > 0
            ? '提测真值 等待回流'
            : '提测真值 尚无样本';
  const uploadEvidenceSummary = `LIVE完成 ${effectiveLiveCompletedUploads} · LIVE仅分派 ${effectiveLiveDispatchedOnlyUploads} · 模拟完成 ${simulatedCompletedCount} · 处理中 ${activeUploads} · ${uploadEvidenceSummaryLabel}`;

  const effectiveTriggerGateReady = firstTestFlightBuildUploaded
    ? true
    : typeof triggerGateReady === 'boolean'
      ? triggerGateReady && safeTriggerGateFailures.length === 0
      : safeTriggerGateFailures.length === 0;
  const triggerGateLabel = firstTestFlightBuildUploaded
    ? '首个 Build 已上传'
    : effectiveTriggerGateReady
      ? (triggerTagName ? `仓库触发门禁已就绪（${triggerTagName}）` : '仓库触发门禁已就绪')
      : (triggerTagName ? `仓库触发门禁未过（${triggerTagName}）` : '仓库触发门禁未过');
  const triggerGateDetail = firstTestFlightBuildUploaded
    ? '首个 Build 已上传，仓库态触发门禁已转入历史状态。'
    : effectiveTriggerGateReady
      ? '工作区、版本 tag 与远端 tag 状态均未阻塞 trigger:testflight，可进入统一安全触发入口。'
      : safeTriggerGateFailures.join('；');
  const triggerGateChecklist = buildTriggerGateChecklist(
    safeTriggerGateFailures,
    triggerGateLabel,
    effectiveTriggerGateReady,
    firstTestFlightBuildUploaded,
  );
  const triggerGatePendingCount = triggerGateChecklist.filter(item => !item.ready).length;
  const triggerGateSummary = triggerGatePendingCount > 0
    ? `${triggerGateLabel} · 阻塞 ${triggerGatePendingCount} 项`
    : `${triggerGateLabel} · 已闭合`;
  const triggerGatePrimaryGap = !effectiveTriggerGateReady
    ? `${triggerGateLabel}：${triggerGateChecklist.find(item => !item.ready)?.value ?? safeTriggerGateFailures.join('；')}`
    : undefined;
  const triggerGatePrimaryGapDetail = !effectiveTriggerGateReady
    ? triggerGateChecklist.find(item => !item.ready)?.detail ?? triggerGateDetail
    : undefined;
  const triggerGateResponsibilitySummary = summarizeTriggerGateResponsibilities(triggerGateChecklist);
  const triggerGateUserInputFailures = triggerGateChecklist
    .filter(item => !item.ready && item.responsibility === 'user-input')
    .flatMap(item => item.failures);
  const triggerGateVersionFailures = triggerGateChecklist
    .filter(item => !item.ready && item.responsibility === 'release-version')
    .flatMap(item => item.failures);
  const triggerGateRepoCleanupFailures = triggerGateChecklist
    .filter(item => !item.ready && item.responsibility === 'repo-cleanup')
    .flatMap(item => item.failures);

  const testFlightTriggerCommand = buildReadyToTrigger && (firstTestFlightBuildUploaded || effectiveTriggerGateReady)
    ? 'npm run trigger:testflight'
    : 'npm run preflight:testflight';
  const testFlightTriggerPlanLabel = firstTestFlightBuildUploaded
    ? '首个 Build 已上传，当前转入安装验证'
    : buildReadyToTrigger && (firstTestFlightBuildUploaded || effectiveTriggerGateReady)
      ? '可以按最终命令触发首个 TestFlight Build'
      : !effectiveTriggerGateReady && triggerGatePrimaryGap
        ? `暂不触发 Build，先处理仓库触发门禁：${triggerGatePrimaryGap}`
        : buildGatePrimaryGap
          ? `暂不触发 Build，先处理${buildGatePrimaryGap}`
        : appleNeedsAttention
          ? '暂不触发 Build，先补 Apple / CI 凭证真值'
          : appleAssetsNeedAttention
            ? '暂不触发 Build，先刷新 App Store 素材真值'
            : pendingConfirmations > 0 || blockedTasks > 0
              ? '暂不触发 Build，先清人工确认或阻塞任务'
              : '暂不触发 Build，先处理仓库触发门禁，再重跑总预检确认状态';
  const testFlightTriggerPlanDetail = firstTestFlightBuildUploaded
    ? 'App Store Connect 已经出现首个构建，下一步重点是 TestFlight 安装、测试人员分发和真机反馈回收。'
    : buildReadyToTrigger && (firstTestFlightBuildUploaded || effectiveTriggerGateReady)
      ? '四类真值已闭合：Apple 前置、Gateway LIVE、LIVE 上传 done、72 小时内 PASS 总预检，且仓库触发门禁也已通过。通过统一安全入口 npm run trigger:testflight 触发；脚本会再次校验门禁后才打 tag 推送。'
      : !effectiveTriggerGateReady && triggerGatePrimaryGapDetail
        ? `${triggerGatePrimaryGapDetail} 当前只保留预检命令作为安全下一步，不建议打 tag。`
        : buildGatePrimaryGapDetail
          ? `${buildGatePrimaryGapDetail} 当前只保留预检命令作为安全下一步，不建议打 tag。`
        : primaryNextAction;

  const launchStepLabel = firstTestFlightBuildUploaded
    ? '首个 TestFlight Build 已经在路上'
    : buildReadyToTrigger && (firstTestFlightBuildUploaded || effectiveTriggerGateReady)
      ? '现在可以触发首个 TestFlight Build'
      : '距离首个 TestFlight Build 还差最后几步';

  const launchStepDetail = firstTestFlightBuildUploaded
    ? 'App Store Connect 已经有首个构建，接下来重点转到安装验证、测试分发和提测反馈。'
    : buildReadyToTrigger
      ? '代码侧、运行态、上传样本和 Apple 校验都已经够了，下一步就该跑总预检并触发 v0.1.0。'
      : `当前最先要补的是：${primaryNextAction}`;

  let primaryNextTarget: ReleaseActionTarget = 'profile';
  if (runtimeMode !== 'live' || !gatewayConfigValid || gatewayWarningCount > 0) {
    primaryNextTarget = 'gateway';
  } else if (appleNeedsAttention || appleAssetsNeedAttention || buildReadyToTrigger) {
    primaryNextTarget = 'profile';
  } else if (pendingConfirmations > 0 || blockedTasks > 0) {
    primaryNextTarget = 'confirmations';
  } else if (effectiveLiveCompletedUploads <= 0 || activeUploads > 0) {
    primaryNextTarget = 'upload';
  }

  const primaryNextLabel = primaryNextTarget === 'gateway'
    ? '先补 Gateway 配置'
    : primaryNextTarget === 'confirmations'
      ? '先清需确认项'
      : primaryNextTarget === 'upload'
        ? activeUploads > 0
          ? '去看上传队列'
          : '先跑上传闭环'
        : buildReadyToTrigger && !effectiveTriggerGateReady
          ? '先清仓库触发门禁'
          : buildReadyToTrigger
            ? '先跑提测总预检'
          : appleNeedsAttention || appleAssetsNeedAttention
            ? '去补 Apple 上线配置'
            : firstTestFlightBuildUploaded
              ? '去看上线准备'
              : '去看完整上线准备';

  return {
    readiness,
    readinessAccent,
    readinessDesc,
    blockers,
    nextActions,
    topBlocker,
    primaryNextAction,
    primaryNextTarget,
    primaryNextLabel,
    checklist,
    appleMaterials,
    appleValidationFresh,
    appleStateLabel,
    appleValidationLabel,
    appleAssetsValidationFresh,
    appleAssetsStateLabel,
    appleAssetsValidationLabel,
    preflightValidationFresh,
    preflightStateLabel,
    preflightValidationLabel,
    testFlightBuildLabel,
    buildReadyToTrigger,
    launchStepLabel,
    launchStepDetail,
    uploadValidationReady,
    uploadValidationFresh,
    uploadStateLabel,
    uploadValidationLabel,
    latestLiveUploadLabel,
    latestLiveUploadTraceLabel,
    uploadEvidenceSummary,
    uploadReleaseTruthLabel,
    uploadReleaseTruthDetail,
    gatewayBuildGateLabel,
    uploadBuildGateLabel,
    preflightBuildGateLabel,
    buildGateChecklist,
    buildGateReady,
    buildGateSummary,
    buildGateDetail,
    buildGatePendingCount,
    buildGatePrimaryGap,
    buildGatePrimaryGapDetail,
    testFlightTriggerPlanLabel,
    testFlightTriggerPlanDetail,
    testFlightTriggerCommand,
    triggerGateTagName: triggerTagName,
    triggerGateLabel,
    triggerGateDetail,
    triggerGateReady: firstTestFlightBuildUploaded || effectiveTriggerGateReady,
    triggerGateFailures: safeTriggerGateFailures,
    triggerGateChecklist,
    triggerGateSummary,
    triggerGatePendingCount,
    triggerGatePrimaryGap,
    triggerGatePrimaryGapDetail,
    triggerGateResponsibilitySummary,
    triggerGateUserInputFailures,
    triggerGateVersionFailures,
    triggerGateRepoCleanupFailures,
    liveDispatchedOnlyUploads: effectiveLiveDispatchedOnlyUploads,
    doneCount: checklist.filter(item => item.done).length,
    totalCount: checklist.length,
  };
}
