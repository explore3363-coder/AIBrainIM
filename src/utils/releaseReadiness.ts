import type {Task, DispatchRecord, RuntimeMode} from '../types';

export type ReleaseReadinessLevel = '可提测' | '待收口' | '未就绪';

export interface ReleaseChecklistItem {
  done: boolean;
  text: string;
}

export interface AppleMaterialItem {
  done: boolean;
  label: string;
}

export interface ReleaseReadinessResult {
  readiness: ReleaseReadinessLevel;
  readinessAccent: string;
  readinessDesc: string;
  blockers: string[];
  nextActions: string[];
  checklist: ReleaseChecklistItem[];
  appleMaterials: AppleMaterialItem[];
  doneCount: number;
  totalCount: number;
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
  /**
   * True only after Apple Developer / App Store Connect / GitHub CI variables
   * have been configured and structurally validated. The mobile app cannot read
   * GitHub secrets directly, so callers should pass this only from an explicit
   * release-check source; default is intentionally false to avoid claiming
   * TestFlight readiness while the Apple side is still missing.
   */
  applePrerequisitesReady?: boolean;
}

export function computeReleaseReadiness({
  runtimeMode,
  pendingConfirmations,
  tasks,
  dispatches,
  activeUploads,
  applePrerequisitesReady = false,
}: ComputeReleaseReadinessParams): ReleaseReadinessResult {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeDispatches = Array.isArray(dispatches) ? dispatches : [];

  const blockedTasks = safeTasks.filter(task => task.state === 'blocked').length;
  const dispatchInFlight = safeDispatches.filter(item => item.status !== 'completed' && item.status !== 'failed').length;

  const blockers: string[] = [];
  const nextActions: string[] = [];

  if (runtimeMode !== 'live') {
    blockers.push('当前仍在本地回退模式，TestFlight 前需至少验证一轮 LIVE 闭环。');
    nextActions.push('优先恢复 Gateway 连通性并验证真实调度链。');
  }

  if (pendingConfirmations > 0) {
    blockers.push(`还有 ${pendingConfirmations} 条需确认项未拍板，会上线体验里留下“待人工决策”缺口。`);
    nextActions.push('先清掉需确认项，确保闭环不是卡在人工拍板。');
  }

  if (blockedTasks > 0) {
    blockers.push(`当前有 ${blockedTasks} 条阻塞任务，提测前应至少收口到可解释状态。`);
    nextActions.push('进入任务页处理阻塞项，避免 TestFlight 首屏出现未解释异常。');
  }

  if (activeUploads > 0) {
    nextActions.push(`当前有 ${activeUploads} 条附件链路在跑，建议补看上传管理页确认回流正常。`);
  }

  if (dispatchInFlight > 0) {
    nextActions.push(`当前有 ${dispatchInFlight} 条调度仍在推进，建议补看调度链确认状态回流。`);
  }

  if (!applePrerequisitesReady) {
    blockers.push('Apple Developer / App Store Connect / GitHub Variables & Secrets 尚未验证，暂不能真正上传 TestFlight。');
    nextActions.push('补齐 Apple Developer、App Store Connect App 记录，以及 GitHub Variables / Secrets（APPLE_API_KEY_ID、APPLE_API_ISSUER_ID、APPLE_TEAM_ID、APPLE_API_KEY_CONTENT）后，先运行 validate:testflight 预检。');
  }

  if (!nextActions.length) {
    nextActions.push('P1 闭环状态稳定，Apple 链路也已通过预检，可触发 v0.1.0 TestFlight 构建。');
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
    {done: pendingConfirmations === 0, text: '需确认项清零或压到可解释范围'},
    {done: blockedTasks === 0, text: '阻塞任务收口到可提测状态'},
    {done: true, text: 'App Icon + 三尺寸截图已生成'},
    {done: applePrerequisitesReady, text: 'Apple Developer / App Store Connect / API Key / GitHub CI 变量'},
  ];

  const appleMaterials: AppleMaterialItem[] = [
    {done: true, label: '1024×1024 App Icon'},
    {done: true, label: 'iPhone 6.7" / 6.5" / 5.5" 截图'},
    {done: true, label: '隐私政策文件与截图脚本'},
    {done: applePrerequisitesReady, label: 'Apple Developer 账号与 Team ID'},
    {done: applePrerequisitesReady, label: 'App Store Connect App 记录'},
    {done: applePrerequisitesReady, label: 'App Store Connect API Key + GitHub Variables / Secrets（APPLE_API_KEY_ID / APPLE_API_ISSUER_ID / APPLE_TEAM_ID / APPLE_API_KEY_CONTENT）'},
    {done: applePrerequisitesReady, label: 'App Store Connect 隐私信息 / 年龄分级 / 支持链接'},
    {done: applePrerequisitesReady, label: '第一个 TestFlight Build 上传'},
  ];

  return {
    readiness,
    readinessAccent,
    readinessDesc,
    blockers,
    nextActions,
    checklist,
    appleMaterials,
    doneCount: checklist.filter(item => item.done).length,
    totalCount: checklist.length,
  };
}
