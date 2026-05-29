import {getAppleReleaseStatus} from '../src/services/releaseChannel';

const runtimeProcess = globalThis as typeof globalThis & {
  process?: {env?: Record<string, string | undefined>};
};
const testProcess = runtimeProcess.process ?? (runtimeProcess.process = {env: {}});

describe('releaseChannel', () => {
  const originalOverride = globalThis.__AIBRAINIM_RELEASE_CHANNEL__;
  const originalEnv = {...(testProcess.env ?? {})};

  beforeEach(() => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = undefined;
    testProcess.env = {...originalEnv};
    delete testProcess.env.AIBRAINIM_RELEASE_CHANNEL_JSON;
    delete testProcess.env.RELEASE_CHANNEL_JSON;
    delete testProcess.env.REACT_NATIVE_RELEASE_CHANNEL_JSON;
    delete testProcess.env.AIBRAINIM_ENV_RELEASE_CHANNEL_JSON;
    delete testProcess.env.ENV_RELEASE_CHANNEL_JSON;
    delete testProcess.env.REACT_NATIVE_ENV_RELEASE_CHANNEL_JSON;
    delete testProcess.env.AIBRAINIM_APPLE_PREREQUISITES_READY;
    delete testProcess.env.APPLE_PREREQUISITES_READY;
    delete testProcess.env.REACT_NATIVE_APPLE_PREREQUISITES_READY;
    delete testProcess.env.AIBRAINIM_APPLE_RELEASE_SUMMARY;
    delete testProcess.env.APPLE_RELEASE_SUMMARY;
    delete testProcess.env.REACT_NATIVE_APPLE_RELEASE_SUMMARY;
    delete testProcess.env.AIBRAINIM_APPLE_RELEASE_VALIDATED_AT;
    delete testProcess.env.APPLE_RELEASE_VALIDATED_AT;
    delete testProcess.env.REACT_NATIVE_APPLE_RELEASE_VALIDATED_AT;
    delete testProcess.env.AIBRAINIM_TESTFLIGHT_BUILD_UPLOADED;
    delete testProcess.env.TESTFLIGHT_BUILD_UPLOADED;
    delete testProcess.env.REACT_NATIVE_TESTFLIGHT_BUILD_UPLOADED;
    delete testProcess.env.AIBRAINIM_APPSTORE_ASSETS_READY;
    delete testProcess.env.APPSTORE_ASSETS_READY;
    delete testProcess.env.REACT_NATIVE_APPSTORE_ASSETS_READY;
    delete testProcess.env.AIBRAINIM_APPSTORE_ASSETS_VALIDATED_AT;
    delete testProcess.env.APPSTORE_ASSETS_VALIDATED_AT;
    delete testProcess.env.REACT_NATIVE_APPSTORE_ASSETS_VALIDATED_AT;
  });

  afterAll(() => {
    testProcess.env = originalEnv;
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = originalOverride;
  });

  it('falls back to repo-generated release status when no runtime override or env is present', () => {
    // With Apple CI credentials now configured in CI, applePrerequisitesReady is true.
    // The summary reflects that Apple/TestFlight pre-checks passed but first build is pending.
    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(['generated', 'default']).toContain(result.source);
    expect(result.summary).toContain('Apple');
  });

  it('does not treat generated ready booleans as fresh validation without validated timestamps', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: true,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: '仓库校验显示结构已齐，但完整预检时间戳未沉淀',
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.validatedAt).toBeUndefined();
    expect(result.assetsValidatedAt).toBeUndefined();

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('reads readiness from runtime override first', () => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = {
      applePrerequisitesReady: true,
      appStoreAssetsReady: true,
      validatedAt: 1746800000000,
      assetsValidatedAt: 1746801234567,
      triggerTagName: 'v0.1.0',
      triggerGateReady: false,
      triggerGateFailures: ['origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build'],
    };
    testProcess.env!.AIBRAINIM_APPLE_PREREQUISITES_READY = 'false';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.source).toBe('global-override');
    expect(result.validatedAt).toBe(1746800000000);
    expect(result.assetsValidatedAt).toBe(1746801234567);
    expect(result.triggerTagName).toBe('v0.1.0');
    expect(result.triggerGateReady).toBe(false);
    expect(result.triggerGateFailures).toEqual(['origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build']);
    expect(result.summary).toContain('运行态覆盖');
  });

  it('prefers runtime override summary when provided', () => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = {
      applePrerequisitesReady: true,
      summary: 'Apple API Key、Team ID 与 TestFlight 首轮校验已通过',
      validatedAt: 1746800000000,
    };

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('global-override');
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.summary).toBe('Apple API Key、Team ID 与 TestFlight 首轮校验已通过');
    expect(result.validatedAt).toBe(1746800000000);
  });

  it('accepts runtime override even when only TestFlight build/upload metadata is present', () => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = {
      firstTestFlightBuildUploaded: true,
      validatedAt: 1746800000000,
    };

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('global-override');
    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.firstTestFlightBuildUploaded).toBe(true);
    expect(result.validatedAt).toBe(1746800000000);
    expect(result.summary).toContain('首个 TestFlight Build 已上传');
  });

  it('accepts runtime override when only summary text is present', () => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = {
      summary: 'Apple 侧已完成一次人工校验，等待补布尔真值',
    };

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('global-override');
    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.summary).toBe('Apple 侧已完成一次人工校验，等待补布尔真值');
  });

  it('falls back to generated release status when no runtime override is present', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: true,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: '仓库预检产物显示 Apple 与素材都已校验',
        validatedAt: 1746800000000,
        assetsValidatedAt: 1746801234567,
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.source).toBe('generated');
    expect(result.summary).toBe('仓库预检产物显示 Apple 与素材都已校验');
    expect(result.validatedAt).toBe(1746800000000);
    expect(result.assetsValidatedAt).toBe(1746801234567);

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('surfaces normalized missing Apple input names from generated validation details', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: 'Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets 仍待补齐；App Store 素材真值已通过仓库校验；首个 TestFlight Build 仍待真实触发',
        assetsValidatedAt: 1746801234567,
        preflightReportGeneratedAt: '2026-05-10T03:07:42.408Z',
        preflightOverallStatus: 'FAIL',
        preflightBlockingCount: 1,
        preflightFailedChecks: ['TestFlight 输入预检'],
        preflightNextActions: ['先补齐 APPLE_API_KEY_ID、APPLE_API_ISSUER_ID、APPLE_TEAM_ID、APPLE_API_KEY_CONTENT，再重跑 npm run preflight:testflight'],
        validationDetails: {
          apple: 'Missing Apple inputs: ASC_KEY_ID/APPLE_API_KEY_ID, ASC_ISSUER_ID/APPLE_API_ISSUER_ID, APPLE_TEAM_ID, APPLE_API_KEY_CONTENT',
          assets: 'ok',
          preflight: '仍有 1 个提测阻塞：TestFlight 输入预检。',
        },
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.summary).toContain('当前缺口：APPLE_API_KEY_ID、APPLE_API_ISSUER_ID、APPLE_TEAM_ID、APPLE_API_KEY_CONTENT');
    expect(result.missingAppleInputs).toEqual([
      'APPLE_API_KEY_ID',
      'APPLE_API_ISSUER_ID',
      'APPLE_TEAM_ID',
      'APPLE_API_KEY_CONTENT',
    ]);
    expect(result.preflightOverallStatus).toBe('FAIL');
    expect(result.preflightBlockingCount).toBe(1);
    expect(result.preflightFailedChecks).toEqual(['TestFlight 输入预检']);
    expect(result.preflightNextActions).toEqual([
      '先补齐 APPLE_API_KEY_ID、APPLE_API_ISSUER_ID、APPLE_TEAM_ID、APPLE_API_KEY_CONTENT，再重跑 npm run preflight:testflight',
    ]);
    expect(result.preflightReportGeneratedAt).toBe(Date.parse('2026-05-10T03:07:42.408Z'));
    expect(result.preflightValidationDetail).toBe('仍有 1 个提测阻塞：TestFlight 输入预检。');
    expect(result.appleValidationDetail).toBe('Missing Apple inputs: ASC_KEY_ID/APPLE_API_KEY_ID, ASC_ISSUER_ID/APPLE_API_ISSUER_ID, APPLE_TEAM_ID, APPLE_API_KEY_CONTENT');
    expect(result.triggerGateFailures).toEqual([]);

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('prefers structured missing Apple inputs over validation-detail string parsing', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: 'Apple 前置项仍待补齐',
        missingAppleInputs: ['ASC_KEY_ID/APPLE_API_KEY_ID', 'APPLE_TEAM_ID'],
        validationDetails: {
          apple: 'Missing Apple inputs: APPLE_API_KEY_CONTENT',
          assets: 'ok',
        },
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.missingAppleInputs).toEqual(['APPLE_API_KEY_ID', 'APPLE_TEAM_ID']);
    expect(result.summary).toContain('当前缺口：APPLE_API_KEY_ID、APPLE_TEAM_ID');

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('parses structured latest LIVE upload trace from generated release status', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: '上传提测真值已沉淀到仓库产物',
        latestLiveUploadCompletedAt: '2026-05-11T04:42:44.936Z',
        latestLiveUpload: {
          id: 'live-generated-1',
          name: '现场真回流样本.zip',
          dispatchId: 'dispatch-live-generated-1',
          agent: '黑金',
          completedAt: '2026-05-11T04:42:44.936Z',
          source: 'release-status',
        },
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.latestLiveUploadCompletedAt).toBe(Date.parse('2026-05-11T04:42:44.936Z'));
    expect(result.latestLiveUpload).toEqual({
      id: 'live-generated-1',
      name: '现场真回流样本.zip',
      dispatchId: 'dispatch-live-generated-1',
      agent: '黑金',
      completedAt: Date.parse('2026-05-11T04:42:44.936Z'),
      source: 'release-status',
    });

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('rebuilds upload evidence summary from structured counters when summary text is missing', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: '上传提测真值仍待补齐',
        activeUploads: 2,
        liveCompletedUploads: 1,
        simulatedCompletedUploads: 3,
        liveDispatchedOnlyUploads: 4,
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.uploadEvidenceSummary).toBe('LIVE完成 1 · LIVE仅分派 4 · 模拟完成 3 · 处理中 2 · 提测真值 LIVE done 仍有 dispatched-only 尾巴');

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('keeps generated upload evidence summary aligned with runtime wording when LIVE done still has dispatched-only tail', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: '生成产物里已有上传真值结构化计数',
        activeUploads: 0,
        completedUploads: 1,
        liveCompletedUploads: 1,
        simulatedCompletedUploads: 0,
        liveDispatchedOnlyUploads: 1,
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.uploadEvidenceSummary).toBe('LIVE完成 1 · LIVE仅分派 1 · 模拟完成 0 · 处理中 0 · 提测真值 LIVE done 仍有 dispatched-only 尾巴');

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('surfaces structured trigger gate status from generated release status', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: '存在仓库态触发阻塞',
        triggerTagName: 'v0.1.0',
        triggerGateReady: false,
        triggerGateFailures: [
          '工作区仍有未提交改动，当前不会安全触发 v0.1.0',
          'origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build',
        ],
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.triggerTagName).toBe('v0.1.0');
    expect(result.triggerGateReady).toBe(false);
    expect(result.triggerGateFailures).toEqual([
      '工作区仍有未提交改动，当前不会安全触发 v0.1.0',
      'origin 远端已存在 v0.1.0 tag，当前不会重复触发首个 Build',
    ]);

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('surfaces structured preflight step details from generated release status', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: '总预检仍有结构化失败步骤',
        preflightOverallStatus: 'FAIL',
        preflightBlockingCount: 1,
        preflightSteps: [
          {label: 'TypeScript 校验', ok: true, status: 0, durationMs: 100, stdoutTail: ['tsc ok']},
          {label: 'TestFlight 输入预检', ok: false, status: 1, durationMs: 80, stdoutTail: ['ERROR: APPLE_TEAM_ID is empty']},
        ],
        validationDetails: {
          apple: 'Missing Apple inputs: APPLE_TEAM_ID',
          assets: 'ok',
          preflight: '仍有 1 个提测阻塞：TestFlight 输入预检。',
        },
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.preflightSteps).toEqual([
      {
        label: 'TypeScript 校验',
        ok: true,
        status: 0,
        durationMs: 100,
        stdoutTail: ['tsc ok'],
        stderrTail: [],
      },
      {
        label: 'TestFlight 输入预检',
        ok: false,
        status: 1,
        durationMs: 80,
        stdoutTail: ['ERROR: APPLE_TEAM_ID is empty'],
        stderrTail: [],
      },
    ]);

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('uses generated not-ready status when it only carries explicit false values and validation detail', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: false,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: false,
        summary: '仓库预检产物明确显示 Apple 与素材都未就绪',
        updatedAt: 1746800000000,
        validationDetails: {
          apple: 'Missing Apple inputs: APPLE_TEAM_ID, APPLE_API_KEY_CONTENT',
          assets: 'Missing asset: AppIcon.appiconset',
        },
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.appStoreAssetsReady).toBe(false);
    expect(result.summary).toContain('仓库预检产物明确显示 Apple 与素材都未就绪');
    expect(result.summary).toContain('当前缺口：APPLE_TEAM_ID、APPLE_API_KEY_CONTENT');
    expect(result.missingAppleInputs).toEqual(['APPLE_TEAM_ID', 'APPLE_API_KEY_CONTENT']);
    expect(result.appleValidationDetail).toBe('Missing Apple inputs: APPLE_TEAM_ID, APPLE_API_KEY_CONTENT');
    expect(result.assetsValidationDetail).toBe('Missing asset: AppIcon.appiconset');

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('surfaces structured preflight blockers from generated release status', () => {
    jest.resetModules();
    jest.doMock('../src/data/releaseStatus.generated', () => ({
      generatedReleaseStatus: {
        applePrerequisitesReady: true,
        firstTestFlightBuildUploaded: false,
        appStoreAssetsReady: true,
        summary: 'Apple 与素材已通过，但总预检仍有结构化阻塞',
        validatedAt: 1746800000000,
        assetsValidatedAt: 1746801234567,
        preflightOverallStatus: 'FAIL',
        preflightBlockingCount: 2,
        preflightFailedChecks: ['TestFlight 输入预检', 'Release archive 预检'],
        validationDetails: {
          apple: 'ok',
          assets: 'ok',
          preflight: '仍有 2 个提测阻塞。',
        },
      },
    }));
    const {getAppleReleaseStatus: getAppleReleaseStatusWithGenerated} = require('../src/services/releaseChannel');

    const result = getAppleReleaseStatusWithGenerated();

    expect(result.source).toBe('generated');
    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.preflightOverallStatus).toBe('FAIL');
    expect(result.preflightBlockingCount).toBe(2);
    expect(result.preflightFailedChecks).toEqual(['TestFlight 输入预检', 'Release archive 预检']);
    expect(result.preflightValidationDetail).toBe('仍有 2 个提测阻塞。');

    jest.dontMock('../src/data/releaseStatus.generated');
    jest.resetModules();
  });

  it('falls back to env readiness when runtime override is absent', () => {
    testProcess.env!.AIBRAINIM_APPLE_PREREQUISITES_READY = 'true';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.source).toBe('env');
    expect(result.summary).toContain('环境标记为通过');
  });

  it('supports alternative env keys for readiness detection', () => {
    testProcess.env!.REACT_NATIVE_APPLE_PREREQUISITES_READY = 'ok';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.source).toBe('env');
  });

  it('reads env summary and validated time when provided', () => {
    testProcess.env!.AIBRAINIM_APPLE_PREREQUISITES_READY = 'true';
    testProcess.env!.AIBRAINIM_APPLE_RELEASE_SUMMARY = 'Apple 账号、App Store Connect 与 CI 变量已补齐';
    testProcess.env!.AIBRAINIM_APPLE_RELEASE_VALIDATED_AT = '1746801234567';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.source).toBe('env');
    expect(result.summary).toBe('Apple 账号、App Store Connect 与 CI 变量已补齐');
    expect(result.validatedAt).toBe(1746801234567);
  });

  it('keeps custom env summary even when readiness flag is absent', () => {
    testProcess.env!.APPLE_RELEASE_SUMMARY = 'Apple 侧仍待补 Team ID 与 API Key';
    testProcess.env!.APPLE_RELEASE_VALIDATED_AT = '2026-05-09T23:40:00.000Z';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.source).toBe('env');
    expect(result.summary).toBe('Apple 侧仍待补 Team ID 与 API Key');
    expect(typeof result.validatedAt).toBe('number');
  });

  it('reads TestFlight build uploaded flag independently from Apple prerequisites', () => {
    testProcess.env!.AIBRAINIM_TESTFLIGHT_BUILD_UPLOADED = 'true';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.firstTestFlightBuildUploaded).toBe(true);
    expect(result.source).toBe('env');
    expect(result.summary).toContain('首个 TestFlight Build 已上传');
  });

  it('treats App Store asset truth as an explicit env signal even without Apple ready flag', () => {
    testProcess.env!.AIBRAINIM_APPSTORE_ASSETS_READY = 'true';
    testProcess.env!.AIBRAINIM_APPSTORE_ASSETS_VALIDATED_AT = '2026-05-10T06:10:00.000+08:00';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.assetsValidatedAt).toBe(Date.parse('2026-05-10T06:10:00.000+08:00'));
    expect(result.source).toBe('env');
    expect(result.summary).toContain('App Store 素材真值已通过');
  });

  it('includes uploaded-build status in env-generated summary when prerequisites are ready', () => {
    testProcess.env!.AIBRAINIM_APPLE_PREREQUISITES_READY = 'true';
    testProcess.env!.AIBRAINIM_TESTFLIGHT_BUILD_UPLOADED = 'true';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(true);
    expect(result.source).toBe('env');
    expect(result.summary).toContain('首个 TestFlight Build 已上传');
  });


  it('keeps asset validation timestamp from runtime override even without Apple ready flag', () => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = {
      appStoreAssetsReady: true,
      assetsValidatedAt: Date.parse('2026-05-10T06:10:00.000+08:00'),
    };

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('global-override');
    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.assetsValidatedAt).toBe(Date.parse('2026-05-10T06:10:00.000+08:00'));
    expect(result.summary).toContain('App Store 素材真值已通过');
  });

  it('includes App Store asset truth in env-generated ready summary', () => {
    testProcess.env!.AIBRAINIM_APPLE_PREREQUISITES_READY = 'true';
    testProcess.env!.AIBRAINIM_APPSTORE_ASSETS_READY = 'true';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.source).toBe('env');
    expect(result.summary).toContain('App Store 素材真值也已通过');
  });

  it('parses ISO validated time from env aliases when readiness flag is absent', () => {
    testProcess.env!.APPLE_RELEASE_VALIDATED_AT = '2026-05-09T23:40:00.000Z';

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('env');
    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.firstTestFlightBuildUploaded).toBe(false);
    expect(typeof result.validatedAt).toBe('number');
    expect(result.validatedAt).toBe(Date.parse('2026-05-09T23:40:00.000Z'));
  });

  it('supports runtime JSON override payload from env for release status hydration', () => {
    testProcess.env!.AIBRAINIM_RELEASE_CHANNEL_JSON = JSON.stringify({
      applePrerequisitesReady: true,
      firstTestFlightBuildUploaded: true,
      appStoreAssetsReady: true,
      validatedAt: 1746800000,
      assetsValidatedAt: 1746801234,
      summary: '运行态 JSON 已同步 Apple 与素材真值',
    });

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('global-override');
    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.firstTestFlightBuildUploaded).toBe(true);
    expect(result.appStoreAssetsReady).toBe(true);
    expect(result.validatedAt).toBe(1746800000 * 1000);
    expect(result.assetsValidatedAt).toBe(1746801234 * 1000);
    expect(result.summary).toBe('运行态 JSON 已同步 Apple 与素材真值');
  });

  it('surfaces missing Apple inputs from runtime JSON even when only validation detail is present', () => {
    testProcess.env!.AIBRAINIM_RELEASE_CHANNEL_JSON = JSON.stringify({
      preflightOverallStatus: 'FAIL',
      preflightBlockingCount: 1,
      preflightFailedChecks: ['TestFlight 输入预检'],
      validationDetails: {
        apple: 'Missing Apple inputs: ASC_KEY_ID/APPLE_API_KEY_ID, APPLE_TEAM_ID',
        preflight: 'FAIL',
      },
    });

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('global-override');
    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.summary).toContain('当前缺口：APPLE_API_KEY_ID、APPLE_TEAM_ID');
    expect(result.missingAppleInputs).toEqual(['APPLE_API_KEY_ID', 'APPLE_TEAM_ID']);
    expect(result.preflightOverallStatus).toBe('FAIL');
    expect(result.preflightBlockingCount).toBe(1);
    expect(result.preflightFailedChecks).toEqual(['TestFlight 输入预检']);
    expect(result.appleValidationDetail).toContain('Missing Apple inputs');
  });

  it('surfaces missing Apple inputs from env JSON even when readiness booleans are absent', () => {
    testProcess.env!.AIBRAINIM_ENV_RELEASE_CHANNEL_JSON = JSON.stringify({
      preflightOverallStatus: 'FAIL',
      preflightBlockingCount: 1,
      preflightFailedChecks: ['TestFlight 输入预检'],
      validationDetails: {
        apple: 'Missing Apple inputs: ASC_ISSUER_ID/APPLE_API_ISSUER_ID, APPLE_API_KEY_CONTENT',
        assets: 'ok',
        preflight: 'FAIL',
      },
    });

    const result = getAppleReleaseStatus();

    expect(result.source).toBe('env');
    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.summary).toContain('当前缺口：APPLE_API_ISSUER_ID、APPLE_API_KEY_CONTENT');
    expect(result.missingAppleInputs).toEqual(['APPLE_API_ISSUER_ID', 'APPLE_API_KEY_CONTENT']);
    expect(result.assetsValidationDetail).toBe('ok');
    expect(result.preflightOverallStatus).toBe('FAIL');
    expect(result.preflightBlockingCount).toBe(1);
    expect(result.preflightFailedChecks).toEqual(['TestFlight 输入预检']);
    expect(result.preflightValidationDetail).toBe('FAIL');
  });
});
