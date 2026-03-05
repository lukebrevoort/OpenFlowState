import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { DesktopAutoUpdater, type UpdateStatusEvent } from './auto-updater.js';
import type { FlowStateConfig } from './config-store.js';

class FakeUpdater extends EventEmitter {
  autoDownload = false;

  autoInstallOnAppQuit = false;

  checkForUpdatesCalls = 0;

  quitAndInstallCalls = 0;

  async checkForUpdates(): Promise<void> {
    this.checkForUpdatesCalls += 1;
  }

  quitAndInstall(): void {
    this.quitAndInstallCalls += 1;
  }
}

const makeConfig = (checkIntervalMinutes: number): FlowStateConfig => ({
  provider: { default: 'opencode/grok-code', apiKeys: {} },
  mcpServers: {},
  preferences: {
    timezone: 'UTC',
    workingHours: { start: '09:00', end: '17:00' },
    notifications: { approvals: true, taskComplete: true },
    updates: { checkIntervalMinutes },
  },
});

describe('DesktopAutoUpdater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('surfaces lifecycle updates including download progress and ready state', async () => {
    const updater = new FakeUpdater();
    const events: UpdateStatusEvent[] = [];
    const service = new DesktopAutoUpdater({
      updater,
      isPackaged: true,
      platform: 'darwin',
      statusPublisher: (status) => events.push(status),
      showRestartPrompt: async () => false,
    });

    service.configure(makeConfig(10));
    service.start();

    updater.emit('checking-for-update');
    updater.emit('update-available', { version: '1.2.3' });
    updater.emit('download-progress', { percent: 42.7 });
    updater.emit('update-downloaded', { version: '1.2.3' });
    await Promise.resolve();

    expect(events.at(-4)?.phase).toBe('checking');
    expect(events.at(-3)?.phase).toBe('available');
    expect(events.at(-2)?.phase).toBe('downloading');
    expect(events.at(-2)?.progressPercent).toBeCloseTo(42.7, 3);
    expect(events.at(-1)?.phase).toBe('ready');
    expect(events.at(-1)?.version).toBe('1.2.3');
  });

  it('checks on launch and on configured interval', async () => {
    const updater = new FakeUpdater();
    const service = new DesktopAutoUpdater({
      updater,
      isPackaged: true,
      platform: 'darwin',
      showRestartPrompt: async () => false,
    });

    service.configure(makeConfig(5));
    service.start();

    await vi.advanceTimersByTimeAsync(15_000);
    expect(updater.checkForUpdatesCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(updater.checkForUpdatesCalls).toBe(2);
  });

  it('adds retry metadata for network errors', () => {
    const updater = new FakeUpdater();
    const events: UpdateStatusEvent[] = [];
    const service = new DesktopAutoUpdater({
      updater,
      isPackaged: true,
      platform: 'darwin',
      statusPublisher: (status) => events.push(status),
      showRestartPrompt: async () => false,
    });

    service.configure(makeConfig(10));
    service.start();

    const now = Date.now();
    updater.emit('error', new Error('network timeout while checking updates'));

    expect(events.at(-1)?.phase).toBe('error');
    expect(events.at(-1)?.retryAt).toBeTypeOf('number');
    expect((events.at(-1)?.retryAt ?? 0) - now).toBeGreaterThan(0);
  });

  it('installs downloaded updates when requested', () => {
    const updater = new FakeUpdater();
    const service = new DesktopAutoUpdater({
      updater,
      isPackaged: true,
      platform: 'darwin',
      showRestartPrompt: async () => false,
    });

    service.start();
    service.installNow();

    expect(updater.quitAndInstallCalls).toBe(1);
  });
});
