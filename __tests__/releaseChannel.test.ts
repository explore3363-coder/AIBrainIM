import {getAppleReleaseStatus} from '../src/services/releaseChannel';

describe('releaseChannel', () => {
  const originalOverride = globalThis.__AIBRAINIM_RELEASE_CHANNEL__;
  const originalEnv = process.env;

  beforeEach(() => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = undefined;
    process.env = {...originalEnv};
    delete process.env.AIBRAINIM_APPLE_PREREQUISITES_READY;
    delete process.env.APPLE_PREREQUISITES_READY;
    delete process.env.REACT_NATIVE_APPLE_PREREQUISITES_READY;
  });

  afterAll(() => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = originalOverride;
    process.env = originalEnv;
  });

  it('defaults to not ready when no override or env is present', () => {
    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.source).toBe('default');
    expect(result.summary).toContain('Apple Developer / App Store Connect / GitHub CI 变量仍待补齐');
  });

  it('reads readiness from runtime override first', () => {
    globalThis.__AIBRAINIM_RELEASE_CHANNEL__ = {
      applePrerequisitesReady: true,
      validatedAt: 1746800000000,
    };
    process.env.AIBRAINIM_APPLE_PREREQUISITES_READY = 'false';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.source).toBe('global-override');
    expect(result.validatedAt).toBe(1746800000000);
    expect(result.summary).toContain('运行态覆盖');
  });

  it('falls back to env readiness when runtime override is absent', () => {
    process.env.AIBRAINIM_APPLE_PREREQUISITES_READY = 'true';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.source).toBe('env');
    expect(result.summary).toContain('环境标记为通过');
  });

  it('supports alternative env keys for readiness detection', () => {
    process.env.REACT_NATIVE_APPLE_PREREQUISITES_READY = 'ok';

    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.source).toBe('env');
  });
});
