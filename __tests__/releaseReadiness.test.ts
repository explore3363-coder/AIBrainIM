import {computeReleaseReadiness, prioritizeReleaseChecklist} from '../src/utils/releaseReadiness';

describe('releaseReadiness', () => {
  it('marks release as not ready when runtime is fallback and Apple prerequisites are missing', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'fallback',
      pendingConfirmations: 2,
      tasks: [
        {
          id: 'task-1',
          title: '等待人工确认',
          owner: '助理',
          state: 'blocked',
          eta: '待确认',
          next: '等待拍板',
          priority: 'P1',
          sourceType: 'confirmation',
        },
      ],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 0,
      applePrerequisitesReady: false,
    });

    expect(result.readiness).toBe('未就绪');
    expect(result.blockers.some(item => item.includes('LIVE 闭环'))).toBe(true);
    expect(result.blockers.some(item => item.includes('上传闭环'))).toBe(true);
    expect(result.blockers.some(item => item.includes('Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets'))).toBe(true);
    expect(result.topBlocker).toContain('Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets');
    expect(result.primaryNextAction).toContain('补齐 Apple Developer');
    expect(result.checklist.find(item => item.text.includes('LIVE 网关闭环验证'))?.done).toBe(false);
    expect(result.checklist.find(item => item.text.includes('Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets'))?.done).toBe(false);
  });

  it('surfaces exact missing Apple inputs when generated precheck has named gaps', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 0,
      applePrerequisitesReady: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: Date.now(),
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
      appleMissingInputs: ['ASC_KEY_ID/APPLE_API_KEY_ID', 'APPLE_TEAM_ID'],
    });

    expect(result.blockers.some(item => item.includes('明确缺项：ASC_KEY_ID/APPLE_API_KEY_ID、APPLE_TEAM_ID'))).toBe(true);
    expect(result.primaryNextAction).toContain('ASC_KEY_ID/APPLE_API_KEY_ID、APPLE_TEAM_ID');
  });

  it('keeps release blocked when structured preflight still reports blockers even if Apple and assets are green', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-1',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'FAIL',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 2,
      preflightFailedChecks: ['TestFlight 输入预检', 'Release archive 预检'],
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('结构化阻塞'))).toBe(true);
    expect(result.blockers.some(item => item.includes('TestFlight 输入预检、Release archive 预检'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('TestFlight 总预检结构化结果 PASS（最近 72 小时内）'))?.done).toBe(false);
    expect(result.buildReadyToTrigger).toBe(false);
    expect(result.primaryNextAction).toContain('npm run preflight:testflight');
  });

  it('keeps release blocked when preflight says PASS but report time is missing', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-pass-without-time',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: undefined,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('还缺最近一次预检时间'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('TestFlight 总预检结构化结果 PASS（最近 72 小时内）'))?.done).toBe(false);
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('keeps release blocked when preflight PASS report is stale', () => {
    const now = Date.now();
    const stale = now - 80 * 60 * 60 * 1000;
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-pass-stale-time',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: stale,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('总预检上次通过时间已经过旧'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('TestFlight 总预检结构化结果 PASS（最近 72 小时内）'))?.done).toBe(false);
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('blocks final trigger plan when trigger:testflight repo gate is not ready', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-live-done',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '真实回流样本.png',
        dispatchId: 'dispatch-upload-1',
        agent: '黑金',
        completedAt: now,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
      triggerTagName: 'v0.1.0',
      triggerGateReady: false,
      triggerGateFailures: ['origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'],
    });

    expect(result.readiness).toBe('待收口');
    expect(result.buildReadyToTrigger).toBe(true);
    expect(result.triggerGateReady).toBe(false);
    expect(result.triggerGateLabel).toContain('仓库触发门禁未过');
    expect(result.triggerGateSummary).toContain('仓库触发门禁未过（v0.1.0）');
    expect(result.triggerGateSummary).toContain('阻塞 1 项');
    expect(result.triggerGatePendingCount).toBe(1);
    expect(result.triggerGateFailures).toEqual(['origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build']);
    expect(result.blockers.some(item => item.includes('trigger:testflight 仓库态仍未收口'))).toBe(true);
    expect(result.testFlightTriggerPlanLabel).toContain('先处理仓库触发门禁');
    expect(result.testFlightTriggerCommand).toBe('npm run preflight:testflight');
    expect(result.triggerGateChecklist[0].ready).toBe(false);
    expect(result.triggerGateSummary).toBe('仓库触发门禁未过（v0.1.0） · 阻塞 1 项');
    expect(result.triggerGatePendingCount).toBe(1);
    expect(result.triggerGatePrimaryGap).toContain('仓库触发门禁');
    expect(result.triggerGateResponsibilitySummary).toBe('仓库触发责任：封版 / 改版本 1 项');
    expect(result.triggerGateVersionFailures).toEqual(['origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build']);
    expect(result.triggerGateUserInputFailures).toEqual([]);
  });

  it('still blocks trigger gate when failure details exist but triggerGateReady flag is missing', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-live-done-with-implicit-trigger-fail',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '真实回流样本.png',
        dispatchId: 'dispatch-upload-live-done-with-implicit-trigger-fail',
        agent: '黑金',
        completedAt: now,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
      triggerTagName: 'v0.1.0',
      triggerGateReady: undefined,
      triggerGateFailures: ['工作区仍有未提交改动，当前不会安全触发 v0.1.0'],
    });

    expect(result.buildReadyToTrigger).toBe(true);
    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('trigger:testflight 仓库态仍未收口'))).toBe(true);
    expect(result.triggerGateReady).toBe(false);
    expect(result.triggerGateLabel).toContain('仓库触发门禁未过');
    expect(result.testFlightTriggerCommand).toBe('npm run preflight:testflight');
    expect(result.testFlightTriggerPlanLabel).toContain('先处理仓库触发门禁');
    expect(result.triggerGateChecklist[0].ready).toBe(false);
    expect(result.triggerGateResponsibilitySummary).toBe('仓库触发责任：仓库封版清理 1 项');
    expect(result.triggerGateRepoCleanupFailures).toEqual(['工作区仍有未提交改动，当前不会安全触发 v0.1.0']);
  });

  it('does not treat upload dispatch history alone as LIVE release truth before runtime evidence is backfilled', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-history-live-done',
          userText: '真机上传 PDF 并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 0,
      latestLiveUploadCompletedAt: undefined,
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('上传闭环'))).toBe(true);
    expect(result.uploadValidationReady).toBe(false);
    expect(result.uploadValidationFresh).toBe(false);
    expect(result.uploadBuildGateLabel).toBe('缺 LIVE done 样本');
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.ready).toBe(false);
    expect(result.buildGatePrimaryGap).toContain('上传门禁');
    expect(result.buildGateReady).toBe(false);
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('accepts explicit LIVE runtime evidence when latest completedAt has been written back', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-history-live-done',
          userText: '真机上传 PDF 并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '真机上传 PDF',
        dispatchId: 'dispatch-live-upload-1',
        agent: '智联',
        completedAt: now,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('可提测');
    expect(result.blockers.some(item => item.includes('上传闭环'))).toBe(false);
    expect(result.uploadValidationReady).toBe(true);
    expect(result.uploadValidationFresh).toBe(true);
    expect(result.uploadBuildGateLabel).toBe('LIVE done 有效（1 条）');
    expect(result.latestLiveUploadLabel).toContain('真机上传 PDF');
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.ready).toBe(true);
    expect(result.buildGatePrimaryGap).toBeUndefined();
    expect(result.buildGateReady).toBe(true);
    expect(result.buildReadyToTrigger).toBe(true);
  });

  it('still lets explicit simulated upload counters override dispatch history so demo samples cannot become release truth', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-simulated-history',
          userText: '模拟上传完成',
          reply: '模拟附件已完成，但未经过 LIVE Gateway。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 0,
      latestLiveUploadCompletedAt: undefined,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('上传闭环'))).toBe(true);
    expect(result.uploadValidationReady).toBe(false);
    expect(result.uploadBuildGateLabel).toBe('只有模拟完成，缺 LIVE done');
    expect(result.uploadEvidenceSummary).toBe('LIVE完成 0 · LIVE仅分派 0 · 模拟完成 1 · 处理中 0 · 提测真值 仍是模拟样本');
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.ready).toBe(false);
    expect(result.buildGatePrimaryGap).toContain('上传门禁');
    expect(result.buildGateReady).toBe(false);
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('does not treat simulated upload completion as real upload evidence', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-simulated',
          userText: '模拟上传完成',
          reply: '模拟附件已完成，但未经过 LIVE Gateway。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 0,
      latestLiveUploadCompletedAt: undefined,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('上传闭环'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实附件上传回流验证'))?.done).toBe(false);
    expect(result.uploadValidationReady).toBe(false);
    expect(result.uploadValidationFresh).toBe(false);
    expect(result.uploadStateLabel).toBe('上传闭环未验证');
    expect(result.uploadValidationLabel).toBe('还没有首个真实回流样本');
    expect(result.latestLiveUploadLabel).toBe('暂无 LIVE 真回流样本');
  });

  it('flags LIVE dispatched-only uploads as not-yet-valid release evidence', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 0,
      liveCompletedUploads: 0,
      liveDispatchedOnlyUploads: 2,
      latestLiveUploadCompletedAt: undefined,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: Date.now(),
      appleValidatedAt: Date.now(),
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: Date.now(),
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('2 条 LIVE 附件只到已分派'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('不存在仅分派但未 done 的 LIVE 上传样本'))?.done).toBe(false);
    expect(result.uploadValidationLabel).toContain('2 条 LIVE 仅分派样本');
    expect(result.latestLiveUploadLabel).toContain('2 条 LIVE 仍停在已分派');
    expect(result.liveDispatchedOnlyUploads).toBe(2);
  });

  it('marks release as ready only when runtime and Apple prerequisites are both ready', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [
        {
          id: 'task-1',
          title: '闭环验证完成',
          owner: '黑金',
          state: 'done',
          eta: '0m',
          next: '触发 TestFlight',
          priority: 'P0',
          sourceType: 'chat',
        },
      ],
      dispatches: [
        {
          id: 'dispatch-1',
          userText: '触发 TestFlight',
          reply: 'Apple 侧配置已齐。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'chat',
        },
        {
          id: 'dispatch-upload-1',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '闭环真回流样本.png',
        dispatchId: 'dispatch-upload-1',
        agent: '黑金',
        completedAt: now,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
    });

    expect(result.readiness).toBe('可提测');
    expect(result.blockers).toHaveLength(0);
    expect(result.topBlocker).toBeUndefined();
    expect(result.primaryNextAction).toContain('继续推进 TestFlight 分发');
    expect(result.appleMaterials.every(item => item.done)).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实附件上传回流验证'))?.done).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实上传回流样本最近 72 小时内仍有效'))?.done).toBe(true);
    expect(result.appleAssetsValidationFresh).toBe(true);
    expect(result.appleAssetsStateLabel).toBe('素材真值 72 小时内已校验');
  });

  it('keeps release blocked until a real upload return sample exists', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 0,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('上传闭环'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实附件上传回流验证'))?.done).toBe(false);
    expect(result.uploadValidationReady).toBe(false);
    expect(result.uploadValidationFresh).toBe(false);
    expect(result.uploadStateLabel).toBe('上传闭环未验证');
    expect(result.uploadValidationLabel).toBe('还没有首个真实回流样本');
  });

  it('keeps release blocked when Apple readiness is marked ready but validation timestamp is missing', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: Date.now(),
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('还缺最近一次校验时间'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('Apple / TestFlight 前置项最近 72 小时内已校验'))?.done).toBe(false);
  });

  it('keeps release blocked when Apple validation timestamp is stale', () => {
    const stale = Date.now() - 80 * 60 * 60 * 1000;
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: Date.now(),
      appleValidatedAt: stale,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('上次校验时间已经过旧'))).toBe(true);
    expect(result.appleMaterials.find(item => item.label.includes('最近 72 小时内已重跑 Apple / TestFlight 预检'))?.done).toBe(false);
  });

  it('keeps release blocked when App Store asset validation time is missing even if assets are marked ready', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {id: 'upload-dispatch-1', userText: '上传图片并回流', reply: '上传完成', status: 'completed', createdAt: now, updatedAt: now, source: 'upload'},
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appleValidatedAt: now,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('素材虽然已标记通过，但还缺最近一次素材校验时间'))).toBe(true);
    expect(result.appleAssetsValidationFresh).toBe(false);
    expect(result.appleAssetsStateLabel).toBe('素材已通过但缺校验时间');
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('keeps release blocked when App Store asset validation timestamp is stale', () => {
    const now = Date.now();
    const stale = now - 80 * 60 * 60 * 1000;
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {id: 'upload-dispatch-1', userText: '上传图片并回流', reply: '上传完成', status: 'completed', createdAt: now, updatedAt: now, source: 'upload'},
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: stale,
      appleValidatedAt: now,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('素材真值校验时间已经过旧'))).toBe(true);
    expect(result.appleAssetsValidationFresh).toBe(false);
    expect(result.appleAssetsStateLabel).toBe('素材真值校验已过期');
    expect(result.appleMaterials.find(item => item.label.includes('最近 72 小时内已重跑 App Store 素材真值校验'))?.done).toBe(false);
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('treats Apple prerequisites as readiness to trigger the first TestFlight build, not as proof the build was already uploaded', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-1',
          userText: '上传图片并回流',
          reply: '上传完成并已进入处理链路',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '上传图片样本.png',
        dispatchId: 'upload-dispatch-1',
        agent: '黑金',
        completedAt: now,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.appleMaterials.find(item => item.label.includes('已具备触发第一个 TestFlight Build 的前置条件'))?.done).toBe(true);
    expect(result.appleMaterials.find(item => item.label.includes('第一个 TestFlight Build 已上传并进入 App Store Connect 处理队列'))?.done).toBe(false);
    expect(result.primaryNextAction).toContain('npm run preflight:testflight');
    expect(result.primaryNextAction).toContain('触发第一个 v0.1.0 TestFlight Build');
    expect(result.appleStateLabel).toBe('Apple 前置 72 小时内已校验');
    expect(result.appleValidationLabel).toContain('校验');
    expect(result.appleAssetsStateLabel).toBe('素材真值 72 小时内已校验');
    expect(result.appleAssetsValidationLabel).toContain('校验');
    expect(result.testFlightBuildLabel).toBe('可触发首个 TestFlight Build');
    expect(result.appleValidationFresh).toBe(true);
    expect(result.appleAssetsValidationFresh).toBe(true);
    expect(result.uploadValidationReady).toBe(true);
    expect(result.uploadValidationFresh).toBe(true);
    expect(result.uploadStateLabel).toBe('上传闭环已验证');
    expect(result.uploadValidationLabel).toContain('校验');
    expect(result.buildReadyToTrigger).toBe(true);
    expect(result.primaryNextLabel).toBe('先跑提测总预检');
  });

  it('treats upload dispatch evidence as a valid real-upload sample even when completedUploads counter has not been backfilled yet', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-evidence-1',
          userText: '上传 PDF 并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 0,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '上传 PDF 样本.pdf',
        dispatchId: 'upload-dispatch-evidence-1',
        agent: '智联',
        completedAt: now,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('可提测');
    expect(result.blockers.some(item => item.includes('上传闭环'))).toBe(false);
    expect(result.checklist.find(item => item.text.includes('真实附件上传回流验证'))?.done).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实上传回流样本最近 72 小时内仍有效'))?.done).toBe(true);
    expect(result.uploadValidationReady).toBe(true);
    expect(result.uploadValidationFresh).toBe(true);
    expect(result.uploadStateLabel).toBe('上传闭环已验证');
    expect(result.latestLiveUploadLabel).toContain('最近一条 LIVE 真回流：');
    expect(result.latestLiveUploadTraceLabel).toContain('上传 PDF 样本.pdf');
    expect(result.buildReadyToTrigger).toBe(true);
  });

  it('keeps release blocked when upload validation time is missing even if completed uploads exist', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUpload: {
        name: '缺时间样本.pdf',
        dispatchId: 'dispatch-missing-time',
        agent: '智联',
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: Date.now(),
      appleValidatedAt: Date.now(),
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('上传链路虽然已有成功样本，但还没记录最近一次真实回流时间'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实附件上传回流验证'))?.done).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实上传回流样本最近 72 小时内仍有效'))?.done).toBe(false);
    expect(result.uploadValidationReady).toBe(true);
    expect(result.uploadValidationFresh).toBe(false);
    expect(result.uploadStateLabel).toBe('上传闭环做过，但缺最近验证时间');
    expect(result.uploadValidationLabel).toBe('未记录最近一次真实回流时间');
    expect(result.latestLiveUploadLabel).toContain('缺时间样本.pdf');
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('keeps release blocked when upload validation sample is stale', () => {
    const stale = Date.now() - 80 * 60 * 60 * 1000;
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-stale',
          userText: '上传文档',
          reply: '文档已回流',
          status: 'completed',
          createdAt: stale,
          updatedAt: stale,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: stale,
      latestLiveUpload: {
        name: '过期样本.pdf',
        dispatchId: 'upload-dispatch-stale',
        agent: '智联',
        completedAt: stale,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: Date.now(),
      appleValidatedAt: Date.now(),
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.uploadBuildGateLabel).toBe('LIVE done 已过期');
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.ready).toBe(false);
    expect(result.checklist.find(item => item.text.includes('真实附件上传回流验证'))?.done).toBe(true);
    expect(result.checklist.find(item => item.text.includes('真实上传回流样本最近 72 小时内仍有效'))?.done).toBe(false);
    expect(result.uploadValidationReady).toBe(true);
    expect(result.uploadValidationFresh).toBe(false);
    expect(result.uploadStateLabel).toBe('上传回流样本已过期');
    expect(result.uploadValidationLabel).toContain('已过期');
    expect(result.latestLiveUploadLabel).toContain('最近一条 LIVE 真回流：');
    expect(result.latestLiveUploadTraceLabel).toContain('过期样本.pdf');
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('keeps the first TestFlight build blocked until App Store assets truth check passes', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-1',
          userText: '上传图片并回流',
          reply: '上传完成并已进入处理链路',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: false,
      appleValidatedAt: now,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.readiness).toBe('待收口');
    expect(result.blockers.some(item => item.includes('App Store 素材真值'))).toBe(true);
    expect(result.checklist.find(item => item.text.includes('App Store 素材真值最近 72 小时内已校验'))?.done).toBe(false);
    expect(result.appleMaterials.find(item => item.label.includes('1024×1024 App Icon'))?.done).toBe(false);
    expect(result.appleAssetsStateLabel).toBe('App Store 素材真值未通过');
    expect(result.buildReadyToTrigger).toBe(false);
    expect(result.primaryNextAction).toContain('npm run preflight:testflight');
  });

  it('surfaces the first TestFlight build action state separately from generic readiness', () => {
    const now = Date.now();
    const readyToTrigger = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-1',
          userText: '上传图片并回流',
          reply: '上传完成并已进入处理链路',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(readyToTrigger.launchStepLabel).toBe('距离首个 TestFlight Build 还差最后几步');
    expect(readyToTrigger.launchStepDetail).toContain('npm run preflight:testflight');

    const uploaded = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'upload-dispatch-1',
          userText: '上传图片并回流',
          reply: '上传完成并已进入处理链路',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(uploaded.launchStepLabel).toBe('首个 TestFlight Build 已经在路上');
    expect(uploaded.launchStepDetail).toContain('安装验证、测试分发和提测反馈');
    expect(uploaded.buildReadyToTrigger).toBe(false);
  });

  it('exposes structured build-gate checklist details for gateway/upload/preflight', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-gate-checklist',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '上传图片样本.png',
        dispatchId: 'dispatch-upload-1',
        agent: '黑金',
        completedAt: now,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.buildGateChecklist.map(item => item.id)).toEqual(['gateway', 'upload', 'preflight']);
    expect(result.buildGateChecklist.every(item => item.ready)).toBe(true);
    expect(result.buildGatePendingCount).toBe(0);
    expect(result.buildGatePrimaryGap).toBeUndefined();
    expect(result.buildGatePrimaryGapDetail).toBeUndefined();
    expect(result.buildGateChecklist[0].label).toBe('Gateway 门禁');
    expect(result.buildGateChecklist[1].label).toBe('上传门禁');
    expect(result.buildGateChecklist[2].label).toBe('预检门禁');
    expect(result.buildGateChecklist[1].detail).toContain('LIVE');
    expect(result.buildGateChecklist[2].detail).toContain('72 小时');
  });

  it('marks stale upload and failed preflight in the structured build-gate checklist', () => {
    const now = Date.now();
    const stale = now - 80 * 60 * 60 * 1000;
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [
        {
          id: 'dispatch-upload-gate-stale',
          userText: '上传图片并回流',
          reply: '上传链路已完成真实回流。',
          status: 'completed',
          createdAt: stale,
          updatedAt: stale,
          source: 'upload',
        },
      ],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: stale,
      latestLiveUpload: {
        name: '过期样本.png',
        dispatchId: 'dispatch-upload-gate-stale',
        agent: '黑金',
        completedAt: stale,
        source: 'runtime',
      },
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'FAIL',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 1,
      preflightFailedChecks: ['TestFlight 输入预检'],
      gatewayConfigValid: false,
      gatewayWarningCount: 1,
    });

    expect(result.buildGateChecklist.find(item => item.id === 'gateway')?.ready).toBe(false);
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.ready).toBe(false);
    expect(result.buildGateChecklist.find(item => item.id === 'preflight')?.ready).toBe(false);
    expect(result.buildGatePendingCount).toBe(3);
    expect(result.buildGatePrimaryGap).toBe('Gateway 门禁：Gateway 配置未通过');
    expect(result.buildGatePrimaryGapDetail).toContain('真机不再停留在 fallback');
    expect(result.buildGateChecklist.find(item => item.id === 'preflight')?.detail).toContain('TestFlight 输入预检');
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.detail).toContain('72 小时');
  });

  it('keeps upload build gate open when fresh LIVE done still has dispatched-only tail', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 2,
      liveCompletedUploads: 1,
      liveDispatchedOnlyUploads: 1,
      latestLiveUploadCompletedAt: now,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.uploadValidationReady).toBe(true);
    expect(result.uploadValidationFresh).toBe(true);
    expect(result.uploadBuildGateLabel).toBe('LIVE done 有效但仍有 1 条仅分派');
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.ready).toBe(false);
    expect(result.buildGatePendingCount).toBe(1);
    expect(result.buildGatePrimaryGap).toBe('上传门禁：LIVE done 有效但仍有 1 条仅分派');
    expect(result.buildGatePrimaryGapDetail).toContain('等它们 done 或明确清理队列');
    expect(result.buildGateChecklist.find(item => item.id === 'upload')?.detail).toContain('等它们 done 或明确清理队列');
    expect(result.buildGateReady).toBe(false);
    expect(result.buildReadyToTrigger).toBe(false);
  });

  it('prioritizes pending checklist items ahead of completed ones', () => {
    const prioritized = prioritizeReleaseChecklist([
      {done: true, text: '已完成 A'},
      {done: false, text: '待完成 B'},
      {done: true, text: '已完成 C'},
      {done: false, text: '待完成 D'},
    ]);

    expect(prioritized.map(item => item.text)).toEqual([
      '待完成 B',
      '待完成 D',
      '已完成 A',
      '已完成 C',
    ]);
  });

  it('keeps TestFlight trigger command safe until all build gates and Apple truth are closed', () => {
    const result = computeReleaseReadiness({
      runtimeMode: 'fallback',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 0,
      applePrerequisitesReady: false,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: Date.now(),
      gatewayConfigValid: false,
      gatewayWarningCount: 1,
      preflightOverallStatus: 'FAIL',
      preflightBlockingCount: 1,
      preflightFailedChecks: ['TestFlight 输入预检'],
    });

    expect(result.testFlightTriggerCommand).toBe('npm run preflight:testflight');
    expect(result.testFlightTriggerPlanLabel).toContain('暂不触发 Build');
    expect(result.testFlightTriggerPlanLabel).toContain('Gateway 门禁');
    expect(result.testFlightTriggerPlanDetail).toContain('不建议打 tag');
  });

  it('carries latest live upload trace into readiness output when release status already knows the sample name and dispatch', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      latestLiveUpload: {
        name: '真实回流样本.png',
        dispatchId: 'dispatch-live-trace',
        agent: '黑金',
        completedAt: now,
        source: 'release-status',
      },
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.latestLiveUploadLabel).toContain('最近一条 LIVE 真回流：');
    expect(result.latestLiveUploadTraceLabel).toContain('真实回流样本.png');
    expect(result.latestLiveUploadTraceLabel).toContain('调度 dispatch-live-trace');
    expect(result.latestLiveUploadTraceLabel).toContain('执行 黑金');
  });

  it('exposes final tag push command only when the first build is ready to trigger', () => {
    const now = Date.now();
    const result = computeReleaseReadiness({
      runtimeMode: 'live',
      pendingConfirmations: 0,
      tasks: [],
      dispatches: [],
      activeUploads: 0,
      completedUploads: 1,
      liveCompletedUploads: 1,
      latestLiveUploadCompletedAt: now,
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      appStoreAssetsValidatedAt: now,
      appleValidatedAt: now,
      preflightOverallStatus: 'PASS',
      preflightReportGeneratedAt: now,
      preflightBlockingCount: 0,
      gatewayConfigValid: true,
      gatewayWarningCount: 0,
    });

    expect(result.buildReadyToTrigger).toBe(true);
    expect(result.testFlightTriggerPlanLabel).toBe('可以按最终命令触发首个 TestFlight Build');
    expect(result.testFlightTriggerCommand).toBe('npm run trigger:testflight');
  });

});
