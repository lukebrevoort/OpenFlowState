import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { autoUpdater, type AppUpdater } from 'electron-updater';
import type { FlowStateConfig } from './config-store.js';

const DEFAULT_UPDATE_CHECK_INTERVAL_MINUTES = 60;
const MIN_UPDATE_CHECK_INTERVAL_MINUTES = 5;
const MAX_UPDATE_CHECK_INTERVAL_MINUTES = 24 * 60;
const MAX_NETWORK_RETRY_ATTEMPTS = 3;
const NETWORK_RETRY_BASE_DELAY_MS = 15_000;

const NETWORK_ERROR_PATTERN = /network|net::|econn|timed out|timeout|enotfound|eai_again|socket hang up/i;

export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'retrying'
  | 'not_available'
  | 'error';

export interface AppUpdateStatus {
  phase: AppUpdatePhase;
  message: string;
  timestamp: string;
  progressPercent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  bytesPerSecond?: number;
  version?: string;
  retryAttempt?: number;
  retryAtIso?: string;
  canRetry?: boolean;
}

type CheckReason = 'launch' | 'interval' | 'manual' | 'retry';

const nowIso = (): string => new Date().toISOString();

const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return String(error);
};

const isLikelyNetworkError = (message: string): boolean => {
  return NETWORK_ERROR_PATTERN.test(message);
};

const resolveConfiguredIntervalMinutes = (config: FlowStateConfig): number => {
  const configured = config.preferences?.updates?.checkIntervalMinutes;
  const fallback = DEFAULT_UPDATE_CHECK_INTERVAL_MINUTES;
  const value = typeof configured === 'number' && Number.isFinite(configured) ? Math.trunc(configured) : fallback;
  return Math.max(MIN_UPDATE_CHECK_INTERVAL_MINUTES, Math.min(MAX_UPDATE_CHECK_INTERVAL_MINUTES, value));
};

export class AppUpdaterManager {
  private readonly updater: AppUpdater;
  private eventsWired = false;
  private checkIntervalTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;
  private checkInFlight = false;
  private lastStatus: AppUpdateStatus = {
    phase: 'idle',
    message: 'Auto updates are idle.',
    timestamp: nowIso(),
  };

  constructor(
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly getConfig: () => FlowStateConfig,
    updater: AppUpdater = autoUpdater,
  ) {
    this.updater = updater;
  }

  start(): void {
    if (!this.isEnabled()) {
      this.emitStatus({
        phase: 'idle',
        message: 'Auto updates are only enabled for packaged macOS builds.',
      });
      return;
    }

    this.wireUpdaterEvents();
    this.updater.autoDownload = true;
    this.updater.autoInstallOnAppQuit = true;

    this.refreshIntervalFromConfig();
    void this.checkForUpdates('launch');
  }

  stop(): void {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  getStatus(): AppUpdateStatus {
    return this.lastStatus;
  }

  refreshIntervalFromConfig(): void {
    if (!this.isEnabled()) {
      return;
    }

    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }

    const intervalMinutes = resolveConfiguredIntervalMinutes(this.getConfig());
    const intervalMs = intervalMinutes * 60_000;

    this.checkIntervalTimer = setInterval(() => {
      void this.checkForUpdates('interval');
    }, intervalMs);
  }

  async checkForUpdates(reason: CheckReason): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    if (this.checkInFlight) {
      return false;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.checkInFlight = true;
    this.emitStatus({
      phase: 'checking',
      message: reason === 'manual' ? 'Checking for updates (manual)...' : 'Checking for updates...',
    });

    try {
      await this.updater.checkForUpdates();
      return true;
    } catch (error) {
      this.handleUpdaterError(error);
      return false;
    } finally {
      this.checkInFlight = false;
    }
  }

  installDownloadedUpdate(): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      this.updater.quitAndInstall();
      return true;
    } catch (error) {
      this.handleUpdaterError(error);
      return false;
    }
  }

  private isEnabled(): boolean {
    return app.isPackaged && process.platform === 'darwin';
  }

  private wireUpdaterEvents(): void {
    if (this.eventsWired) {
      return;
    }
    this.eventsWired = true;

    this.updater.on('checking-for-update', () => {
      this.emitStatus({
        phase: 'checking',
        message: 'Checking for updates...',
      });
    });

    this.updater.on('update-available', (info) => {
      this.retryAttempt = 0;
      this.emitStatus({
        phase: 'available',
        message: 'Update available. Downloading now...',
        version: info.version,
      });
    });

    this.updater.on('download-progress', (progress) => {
      this.emitStatus({
        phase: 'downloading',
        message: `Downloading update: ${Math.max(0, Math.min(100, progress.percent)).toFixed(1)}%`,
        progressPercent: progress.percent,
        downloadedBytes: progress.transferred,
        totalBytes: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    this.updater.on('update-downloaded', (info) => {
      this.retryAttempt = 0;
      this.emitStatus({
        phase: 'ready',
        message: 'Update ready to install. Restart FlowState to finish updating.',
        version: info.version,
      });
    });

    this.updater.on('update-not-available', (info) => {
      this.retryAttempt = 0;
      this.emitStatus({
        phase: 'not_available',
        message: 'FlowState is up to date.',
        version: info.version,
      });
    });

    this.updater.on('error', (error) => {
      this.handleUpdaterError(error);
    });
  }

  private handleUpdaterError(error: unknown): void {
    const message = parseErrorMessage(error);
    const shouldRetry = isLikelyNetworkError(message) && this.retryAttempt < MAX_NETWORK_RETRY_ATTEMPTS;

    if (shouldRetry) {
      this.retryAttempt += 1;
      const delayMs = NETWORK_RETRY_BASE_DELAY_MS * this.retryAttempt;
      const retryAt = new Date(Date.now() + delayMs);

      this.emitStatus({
        phase: 'retrying',
        message: `Update check failed due to network error. Retrying automatically in ${Math.ceil(delayMs / 1000)}s...`,
        retryAttempt: this.retryAttempt,
        retryAtIso: retryAt.toISOString(),
        canRetry: true,
      });

      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
      }

      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.checkForUpdates('retry');
      }, delayMs);
      return;
    }

    this.emitStatus({
      phase: 'error',
      message: `Update failed: ${message}`,
      canRetry: true,
    });
  }

  private emitStatus(update: Omit<AppUpdateStatus, 'timestamp'>): void {
    const next: AppUpdateStatus = {
      ...update,
      timestamp: nowIso(),
    };
    this.lastStatus = next;

    const window = this.getMainWindow();
    if (window?.webContents) {
      window.webContents.send('app:updateStatus', next);
    }
  }
}
