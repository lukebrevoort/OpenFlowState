import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApp = vi.hoisted(() => ({
  version: '1.0.0',
  isPackaged: true,
}));

const mockUpdater = vi.hoisted(() => {
  const handlers = new Map<string, (payload?: unknown) => void>();
  const autoUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
    allowDowngrade: false,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      handlers.set(event, handler);
      return autoUpdater;
    }),
  };

  return {
    handlers,
    autoUpdater,
  };
});

vi.mock('electron', () => ({
  app: {
    getVersion: () => mockApp.version,
    get isPackaged() {
      return mockApp.isPackaged;
    },
  },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: mockUpdater.autoUpdater,
}));

const { createOtaUpdater } = await import('./ota-updater.js');

const emit = (event: string, payload?: unknown): void => {
  const handler = mockUpdater.handlers.get(event);
  if (!handler) {
    throw new Error(`Missing handler for ${event}`);
  }

  handler(payload);
};

beforeEach(() => {
  mockApp.version = '1.0.0';
  mockApp.isPackaged = true;
  mockUpdater.handlers.clear();
  mockUpdater.autoUpdater.autoDownload = false;
  mockUpdater.autoUpdater.autoInstallOnAppQuit = true;
  mockUpdater.autoUpdater.allowPrerelease = false;
  mockUpdater.autoUpdater.allowDowngrade = false;
  vi.clearAllMocks();
  process.env.FLOWSTATE_UPDATE_FEED_URL = 'https://updates.flowstate.test';
  delete process.env.FLOWSTATE_UPDATE_CHANNEL;
});

describe('ota updater initialization', () => {
  it('derives the beta channel from prerelease versions', () => {
    mockApp.version = '1.0.0-beta.4';

    const updater = createOtaUpdater(() => {});
    const state = updater.initialize();

    expect(state).toMatchObject({
      channel: 'beta',
      canAutoUpdate: true,
      stage: 'idle',
    });
    expect(mockUpdater.autoUpdater.allowPrerelease).toBe(true);
    expect(mockUpdater.autoUpdater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://updates.flowstate.test/',
      channel: 'beta',
    });
  });

  it('prefers the configured update channel over the version suffix', () => {
    mockApp.version = '1.0.0';
    process.env.FLOWSTATE_UPDATE_CHANNEL = 'alpha';

    const updater = createOtaUpdater(() => {});
    const state = updater.initialize();

    expect(state.channel).toBe('alpha');
    expect(mockUpdater.autoUpdater.allowPrerelease).toBe(true);
    expect(mockUpdater.autoUpdater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://updates.flowstate.test/',
      channel: 'alpha',
    });
  });

  it('disables updates in development builds', () => {
    mockApp.isPackaged = false;

    const updater = createOtaUpdater(() => {});
    const state = updater.initialize();

    expect(state).toMatchObject({
      stage: 'disabled',
      canAutoUpdate: false,
      updateAvailable: false,
      disabledReason: 'OTA updates are disabled in development builds.',
    });
    expect(mockUpdater.autoUpdater.setFeedURL).not.toHaveBeenCalled();
  });

  it('disables updates when the feed URL is missing or invalid', () => {
    delete process.env.FLOWSTATE_UPDATE_FEED_URL;

    const missingFeedUpdater = createOtaUpdater(() => {});
    expect(missingFeedUpdater.initialize()).toMatchObject({
      stage: 'disabled',
      canAutoUpdate: false,
      disabledReason: 'Set FLOWSTATE_UPDATE_FEED_URL to enable OTA updates.',
    });

    process.env.FLOWSTATE_UPDATE_FEED_URL = 'http://updates.flowstate.test';

    const invalidFeedUpdater = createOtaUpdater(() => {});
    expect(invalidFeedUpdater.initialize()).toMatchObject({
      stage: 'disabled',
      canAutoUpdate: false,
      disabledReason:
        'FLOWSTATE_UPDATE_FEED_URL must be a valid HTTPS URL to enable OTA updates.',
    });
  });

  it('does not check for updates when auto-updates are disabled', async () => {
    delete process.env.FLOWSTATE_UPDATE_FEED_URL;

    const updater = createOtaUpdater(() => {});
    updater.initialize();
    await updater.checkForUpdates();

    expect(mockUpdater.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });
});

describe('ota updater errors', () => {
  it('surfaces updater errors in state', () => {
    const updater = createOtaUpdater(() => {});
    updater.initialize();

    emit('error', new Error('network unavailable'));

    expect(updater.getState()).toMatchObject({
      stage: 'error',
      errorMessage: 'network unavailable',
    });
    expect(updater.getState().lastCheckedAt).toEqual(expect.any(String));
  });

  it('captures download failures triggered by the manual update action', async () => {
    mockUpdater.autoUpdater.downloadUpdate.mockRejectedValueOnce(new Error('download failed'));

    const updater = createOtaUpdater(() => {});
    updater.initialize();
    emit('update-available', { version: '1.2.0' });

    const state = await updater.downloadUpdate();

    expect(mockUpdater.autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(state).toMatchObject({
      stage: 'error',
      errorMessage: 'download failed',
    });
  });
});

describe('ota updater deferral', () => {

  it('keeps a deferred update deferred when the same version is announced again', () => {
    const updater = createOtaUpdater(() => {});
    updater.initialize();

    emit('update-available', { version: '1.2.0' });
    expect(updater.deferUpdate().stage).toBe('deferred');

    emit('checking-for-update');
    expect(updater.getState().stage).toBe('deferred');

    emit('update-available', { version: '1.2.0' });
    expect(updater.getState()).toMatchObject({
      stage: 'deferred',
      availableVersion: '1.2.0',
      updateAvailable: true,
    });
  });

  it('keeps deferred state while a deferred download progresses and completes', () => {
    const updater = createOtaUpdater(() => {});
    updater.initialize();

    emit('update-available', { version: '1.2.0' });
    updater.deferUpdate();

    emit('download-progress', { percent: 42.4 });
    expect(updater.getState()).toMatchObject({
      stage: 'deferred',
      downloadProgressPercent: 42,
    });

    emit('update-downloaded', { version: '1.2.0' });
    expect(updater.getState()).toMatchObject({
      stage: 'deferred',
      availableVersion: '1.2.0',
      downloadedVersion: '1.2.0',
      downloadProgressPercent: 100,
    });
  });

  it('clears deferral when a newer version becomes available', () => {
    const updater = createOtaUpdater(() => {});
    updater.initialize();

    emit('update-available', { version: '1.2.0' });
    updater.deferUpdate();

    emit('update-available', { version: '1.3.0' });
    expect(updater.getState()).toMatchObject({
      stage: 'available',
      availableVersion: '1.3.0',
      downloadedVersion: null,
      downloadProgressPercent: 0,
      updateAvailable: true,
    });
  });
});
