describe('getAppleReleaseStatus', () => {
  const originalProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}}).process;

  beforeEach(() => {
    jest.resetModules();
    delete (globalThis as {__AIBRAINIM_RELEASE_CHANNEL__?: unknown}).__AIBRAINIM_RELEASE_CHANNEL__;
    (globalThis as {process?: {env?: Record<string, string | undefined>}}).process = {
      env: {},
    };
  });

  afterAll(() => {
    (globalThis as {process?: {env?: Record<string, string | undefined>}}).process = originalProcess;
  });

  it('defaults to not ready when no signal exists', () => {
    const {getAppleReleaseStatus} = require('../src/services/releaseChannel');
    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(false);
    expect(result.source).toBe('default');
  });

  it('reads ready state from environment variables', () => {
    (globalThis as {process?: {env?: Record<string, string | undefined>}}).process = {
      env: {AIBRAINIM_APPLE_PREREQUISITES_READY: 'true'},
    };

    const {getAppleReleaseStatus} = require('../src/services/releaseChannel');
    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.source).toBe('env');
  });

  it('prefers runtime override over environment variables', () => {
    (globalThis as {process?: {env?: Record<string, string | undefined>}}).process = {
      env: {AIBRAINIM_APPLE_PREREQUISITES_READY: 'false'},
    };
    (globalThis as {__AIBRAINIM_RELEASE_CHANNEL__?: {applePrerequisitesReady?: boolean; validatedAt?: number}}).__AIBRAINIM_RELEASE_CHANNEL__ = {
      applePrerequisitesReady: true,
      validatedAt: 123456,
    };

    const {getAppleReleaseStatus} = require('../src/services/releaseChannel');
    const result = getAppleReleaseStatus();

    expect(result.applePrerequisitesReady).toBe(true);
    expect(result.source).toBe('global-override');
    expect(result.validatedAt).toBe(123456);
  });
});
