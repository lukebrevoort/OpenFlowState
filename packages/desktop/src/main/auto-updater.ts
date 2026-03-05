import { app, dialog, type BrowserWindow, type MessageBoxOptions } from 'electron';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import type { FlowStateConfig } from './config-store.js';

const DEFAULT_CHECK_INTERVAL_MINUTES = 60;
const INITIAL_CHECK_DELAY_MS = 15_000;
const NETWORK_RETRY_DELAY_MS = 120_000;

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateStatusEvent {
  phase: UpdatePhase;
  message: string;
  progressPercent?: number;
  version?: string;
  retryAt?: number;
}

type UpdaterLike = EventEmitter & {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: () => void;
};

type StatusPublisher = (status: UpdateStatusEvent) => void;

const toFiniteInteger = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
};

const clampIntervalMinutes = (value: unknown): number => {
  const parsed = toFiniteInteger(value);
  if (parsed === null) {
    return DEFAULT_CHECK_INTERVAL_MINUTES;
  }
  return Math.min(Math.max(parsed, 5), 24 * 60);
};

const hasNetworkErrorShape = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const markers = [
    'net::',
    'network',
    'timed out',
    'timeout',
    'econn',
    'enotfound',
    'eai_again',
    'socket',
    'offline',
    'failed to fetch',
  ];
  return markers.some((marker) => normalized.includes(marker));
};

interface DesktopAutoUpdaterOptions {
  updater?: UpdaterLike;
  isPackaged?: boolean;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  showRestartPrompt?: (version?: string) => Promise<boolean>;
  statusPublisher?: StatusPublisher;
  scheduleTimer?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  clearTimer?: (handle: NodeJS.Timeout) => void;
}

const require = createRequire(import.meta.url);

let cachedDefaultUpdater: UpdaterLike | null = null;

const resolveDefaultUpdater = (): UpdaterLike => {
  if (cachedDefaultUpdater) {
    return cachedDefaultUpdater;
  }

  const updaterModule = require('electron-updater') as { autoUpdater: UpdaterLike };
  cachedDefaultUpdater = updaterModule.autoUpdater;
  return cachedDefaultUpdater;
};

export class DesktopAutoUpdater {
  private readonly updater: UpdaterLike;

  private readonly isPackaged: boolean;

  private readonly platform: NodeJS.Platform;

  private readonly env: NodeJS.ProcessEnv;

  private readonly scheduleTimer: (callback: () => void, delayMs: number) => NodeJS.Timeout;

  private readonly clearTimer: (handle: NodeJS.Timeout) => void;

  private readonly showRestartPrompt: (version?: string) => Promise<boolean>;

  private readonly additionalPublisher: StatusPublisher;

  private mainWindow: BrowserWindow | null = null;

  private retryTimer: NodeJS.Timeout | null = null;

  private checkInFlight = false;

  private started = false;

  private checkIntervalMs = DEFAULT_CHECK_INTERVAL_MINUTES * 60_000;

  private currentStatus: UpdateStatusEvent = {
    phase: 'idle',
    message: 'Automatic updates idle.',
  };

  constructor(options: DesktopAutoUpdaterOptions = {}) {
    this.updater = options.updater ?? resolveDefaultUpdater();
    this.isPackaged = options.isPackaged ?? app.isPackaged;
    this.platform = options.platform ?? process.platform;
    this.env = options.env ?? process.env;
    this.additionalPublisher = options.statusPublisher ?? (() => {});
    this.scheduleTimer = options.scheduleTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
    this.showRestartPrompt =
      options.showRestartPrompt ??
      (async (version?: string) => {
        const options: MessageBoxOptions = {
          type: 'info',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
          title: 'Update ready to install',
          message: version
            ? `FlowState ${version} is downloaded and ready.`
            : 'A FlowState update has finished downloading.',
          detail: 'Restart now to apply the update.',
        };
        const result = this.mainWindow
          ? await dialog.showMessageBox(this.mainWindow, options)
          : await dialog.showMessageBox(options);
        return result.response === 0;
      });
  }

  configure(config: FlowStateConfig): void {
    const configInterval = config.preferences?.updates?.checkIntervalMinutes;
    const envInterval = this.env.FLOWSTATE_UPDATER_INTERVAL_MINUTES;
    const intervalMinutes = clampIntervalMinutes(
      envInterval === undefined ? configInterval : Number(envInterval),
    );
    this.checkIntervalMs = intervalMinutes * 60_000;
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    this.publishStatus(this.currentStatus);
  }

  getStatus(): UpdateStatusEvent {
    return this.currentStatus;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!this.isEnabled()) {
      this.publishStatus({
        phase: 'idle',
        message: 'Automatic updates are disabled in development builds.',
      });
      return;
    }

    this.updater.autoDownload = true;
    this.updater.autoInstallOnAppQuit = true;

    this.updater.on('checking-for-update', () => {
      this.publishStatus({
        phase: 'checking',
        message: 'Checking for updates...',
      });
    });

    this.updater.on('update-available', (info: { version?: string }) => {
      this.cancelRetry();
      this.publishStatus({
        phase: 'available',
        version: info?.version,
        message: info?.version
          ? `Update ${info.version} is available. Downloading now...`
          : 'An update is available. Downloading now...',
      });
    });

    this.updater.on('update-not-available', () => {
      this.cancelRetry();
      this.publishStatus({
        phase: 'idle',
        message: 'FlowState is up to date.',
      });
    });

    this.updater.on('download-progress', (progress: { percent?: number }) => {
      this.publishStatus({
        phase: 'downloading',
        message: 'Downloading update...',
        progressPercent: progress.percent,
      });
    });

    this.updater.on('update-downloaded', async (info: { version?: string }) => {
      this.cancelRetry();
      this.publishStatus({
        phase: 'ready',
        version: info?.version,
        message: info?.version
          ? `Update ${info.version} is ready to install.`
          : 'Update is ready to install.',
      });

      const shouldRestart = await this.showRestartPrompt(info?.version);
      if (shouldRestart) {
        this.installNow();
      }
    });

    this.updater.on('error', (error: unknown) => {
      const networkFailure = hasNetworkErrorShape(error);
      const retryAt = networkFailure ? Date.now() + NETWORK_RETRY_DELAY_MS : undefined;
      const message = error instanceof Error ? error.message : String(error);

      this.publishStatus({
        phase: 'error',
        retryAt,
        message: networkFailure
          ? `Update check failed due to a network issue. Retrying soon (${message}).`
          : `Update check failed: ${message}`,
      });

      if (networkFailure) {
        this.scheduleRetry();
      }
    });

    this.scheduleTimer(() => {
      void this.checkNow('launch');
    }, INITIAL_CHECK_DELAY_MS);

    this.scheduleTimer(() => {
      void this.runPeriodicChecks();
    }, this.checkIntervalMs);
  }

  async checkNow(_reason: 'launch' | 'manual' | 'retry' | 'interval' = 'manual'): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.checkInFlight) {
      return;
    }

    this.checkInFlight = true;
    try {
      await this.updater.checkForUpdates();
    } finally {
      this.checkInFlight = false;
    }
  }

  installNow(): void {
    if (!this.isEnabled()) {
      return;
    }
    this.updater.quitAndInstall();
  }

  private isEnabled(): boolean {
    return this.isPackaged && this.platform === 'darwin';
  }

  private async runPeriodicChecks(): Promise<void> {
    await this.checkNow('interval');
    this.scheduleTimer(() => {
      void this.runPeriodicChecks();
    }, this.checkIntervalMs);
  }

  private scheduleRetry(): void {
    this.cancelRetry();
    this.retryTimer = this.scheduleTimer(() => {
      this.retryTimer = null;
      void this.checkNow('retry');
    }, NETWORK_RETRY_DELAY_MS);
  }

  private cancelRetry(): void {
    if (!this.retryTimer) {
      return;
    }
    this.clearTimer(this.retryTimer);
    this.retryTimer = null;
  }

  private publishStatus(status: UpdateStatusEvent): void {
    this.currentStatus = status;
    this.additionalPublisher(status);

    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('updates:status', status);
    }
  }
}
