import type {ReleaseActionTarget} from './releaseReadiness';

export type ReleaseActionLabelStyle = 'plain' | 'decorated';

export type ReleaseActionClosureCopy = {
  actionLabel: string;
  summaryLine: string;
  reasonLine: string;
  commandLine: string;
};

export type ReleaseTriggerGateCopy = {
  summaryLine: string;
  primaryGapLine: string;
  reasonLine: string;
  detailLine: string;
  pendingCountLine: string;
  responsibilityLine: string;
};

function decorateLabel(label: string): string {
  if (label.includes('Gateway')) return `🛰️ ${label}`;
  if (label.includes('确认')) return `✅ ${label}`;
  if (label.includes('上传')) return `📤 ${label}`;
  if (label.includes('Build')) return `🚀 ${label}`;
  if (label.includes('上线')) return `🚀 ${label}`;
  return `🚀 ${label}`;
}

export function getReleaseActionLabel(
  target: ReleaseActionTarget,
  fallbackLabel?: string,
  style: ReleaseActionLabelStyle = 'plain',
): string {
  const baseLabel = fallbackLabel ?? (() => {
    switch (target) {
      case 'gateway':
        return '先补 Gateway 配置';
      case 'confirmations':
        return '先清需确认项';
      case 'upload':
        return '先跑上传闭环';
      case 'profile':
      default:
        return '去看上线准备';
    }
  })();

  return style === 'decorated' ? decorateLabel(baseLabel) : baseLabel;
}

export function buildReleaseClosureCopy(input: {
  target: ReleaseActionTarget;
  fallbackLabel?: string;
  primaryNextAction: string;
  primaryGap?: string;
  primaryGapDetail?: string;
  command: string;
}): ReleaseActionClosureCopy {
  const actionLabel = getReleaseActionLabel(input.target, input.fallbackLabel);
  return {
    actionLabel,
    summaryLine: `主动作：${actionLabel}`,
    reasonLine: `主动作原因：${input.primaryGapDetail ?? input.primaryGap ?? input.primaryNextAction}`,
    commandLine: `安全命令：${input.command}`,
  };
}

export function buildReleaseTriggerGateCopy(input: {
  summary: string;
  primaryGap?: string;
  primaryGapDetail?: string;
  detail: string;
  pendingCount: number;
  totalCount: number;
  responsibilitySummary?: string;
}): ReleaseTriggerGateCopy {
  return {
    summaryLine: `仓库触发摘要：${input.summary}`,
    primaryGapLine: `仓库当前卡点：${input.primaryGap ?? '仓库触发门禁已闭合'}`,
    reasonLine: `仓库卡点原因：${input.primaryGapDetail ?? input.detail}`,
    detailLine: `仓库态说明：${input.detail}`,
    pendingCountLine: `仓库剩余门禁数：${input.pendingCount} / ${input.totalCount}`,
    responsibilityLine: input.responsibilitySummary ?? '仓库触发责任：已闭合，无需额外处理。',
  };
}
