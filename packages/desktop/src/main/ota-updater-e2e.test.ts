import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApp = vi.hoisted(() => ({
  version: '2.4.0',
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
  mockApp.version = '2.4.0';
  mockApp.isPackaged = true;
  mockUpdater.handlers.clear();
  vi.clearAllMocks();
  process.env.FLOWSTATE_UPDATE_FEED_URL = 'https://updates.flowstate.test';
  delete process.env.FLOWSTATE_UPDATE_CHANNEL;
});

describe('ota update e2e flow', () => {
  it('covers check, defer, download, and apply update lifecycle', async () => {
    const stateSnapshots: string[] = [];
    const updater = createOtaUpdater((state) => {
      stateSnapshots.push(state.stage);
    });

    updater.initialize();
    await updater.checkForUpdates();

    emit('checking-for-update');
    emit('update-available', { version: '2.5.0' });

    expect(updater.getState()).toMatchObject({
      stage: 'available',
      currentVersion: '2.4.0',
      availableVersion: '2.5.0',
      updateAvailable: true,
    });

    updater.deferUpdate();
    expect(updater.getState().stage).toBe('deferred');

    await updater.downloadUpdate();
    emit('download-progress', { percent: 63.2 });
    emit('update-downloaded', { version: '2.5.0' });

    expect(updater.getState()).toMatchObject({
      stage: 'downloaded',
      currentVersion: '2.4.0',
      availableVersion: '2.5.0',
      downloadedVersion: '2.5.0',
      downloadProgressPercent: 100,
    });

    updater.applyUpdateNow();
    expect(mockUpdater.autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    expect(stateSnapshots).toEqual(expect.arrayContaining(['available', 'deferred', 'downloading', 'downloaded']));
  });

  it('keeps the current version active when download fails', async () => {
    mockUpdater.autoUpdater.downloadUpdate.mockRejectedValueOnce(new Error('failed to download patch'));

    const updater = createOtaUpdater(() => {});
    updater.initialize();
    emit('update-available', { version: '2.5.0' });

    const result = await updater.downloadUpdate();

    expect(result).toMatchObject({
      stage: 'error',
      currentVersion: '2.4.0',
      availableVersion: '2.5.0',
      errorMessage: 'failed to download patch',
    });
    expect(mockUpdater.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
});
