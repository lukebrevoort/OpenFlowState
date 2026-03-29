import { app } from 'electron';
import { autoUpdater, type UpdateDownloadedEvent, type UpdateInfo } from 'electron-updater';
import type { OtaUpdateState } from '../shared/ota-types';

export type { OtaUpdateStage, OtaUpdateState } from '../shared/ota-types';

type SendState = (state: OtaUpdateState) => void;

const DEFAULT_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;

const toIsoNow = (): string => new Date().toISOString();

const deriveChannel = (version: string): string => {
  const fromEnv = process.env.FLOWSTATE_UPDATE_CHANNEL?.trim();
  if (fromEnv) return fromEnv;

  if (version.includes('-beta')) {
    return 'beta';
  }
  if (version.includes('-alpha')) {
    return 'alpha';
  }

  return 'latest';
};

const normalizeUpdateVersion = (value: UpdateInfo | UpdateDownloadedEvent | null | undefined): string | null => {
  const version = value?.version;
  if (typeof version !== 'string') {
    return null;
  }

  const trimmed = version.trim();
  return trimmed.length ? trimmed : null;
};

class OtaUpdater {
  private initialized = false;
  private checkTimer: NodeJS.Timeout | null = null;
  private deferredVersion: string | null = null;

  private state: OtaUpdateState = {
    stage: 'idle',
    currentVersion: app.getVersion(),
    availableVersion: null,
    downloadedVersion: null,
    downloadProgressPercent: 0,
    channel: deriveChannel(app.getVersion()),
    canAutoUpdate: false,
    updateAvailable: false,
    errorMessage: null,
    lastCheckedAt: null,
    disabledReason: null,
  };

  constructor(private readonly sendState: SendState) {}

  initialize(): OtaUpdateState {
    if (this.initialized) {
      return this.getState();
    }
    this.initialized = true;

    const feedUrl = process.env.FLOWSTATE_UPDATE_FEED_URL?.trim();

    if (!app.isPackaged) {
      this.setState({
        stage: 'disabled',
        canAutoUpdate: false,
        updateAvailable: false,
        disabledReason: 'OTA updates are disabled in development builds.',
      });
      return this.getState();
    }

    if (!feedUrl) {
      this.setState({
        stage: 'disabled',
        canAutoUpdate: false,
        updateAvailable: false,
        disabledReason: 'Set FLOWSTATE_UPDATE_FEED_URL to enable OTA updates.',
      });
      return this.getState();
    }

    let validatedFeedUrl: string;
    try {
      const parsed = new URL(feedUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('FLOWSTATE_UPDATE_FEED_URL must use https protocol');
      }
      validatedFeedUrl = parsed.toString();
    } catch {
      this.setState({
        stage: 'disabled',
        canAutoUpdate: false,
        updateAvailable: false,
        disabledReason:
          'FLOWSTATE_UPDATE_FEED_URL must be a valid HTTPS URL to enable OTA updates.',
      });
      return this.getState();
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = this.state.channel !== 'latest';
    autoUpdater.allowDowngrade = false;
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: validatedFeedUrl,
      channel: this.state.channel,
    });

    autoUpdater.on('checking-for-update', () => {
      this.setState({
        stage: this.isCurrentUpdateDeferred() ? 'deferred' : 'checking',
        errorMessage: null,
      });
    });

    autoUpdater.on('update-available', (info) => {
      const version = normalizeUpdateVersion(info);
      const isDeferred = this.isDeferredVersion(version);
      if (!isDeferred) {
        this.deferredVersion = null;
      }

      this.setState({
        stage: isDeferred ? 'deferred' : 'available',
        availableVersion: version,
        downloadedVersion: isDeferred && this.state.downloadedVersion === version ? this.state.downloadedVersion : null,
        downloadProgressPercent: isDeferred ? this.state.downloadProgressPercent : 0,
        updateAvailable: true,
        errorMessage: null,
        lastCheckedAt: toIsoNow(),
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.deferredVersion = null;
      this.setState({
        stage: 'up-to-date',
        availableVersion: null,
        downloadedVersion: null,
        downloadProgressPercent: 0,
        updateAvailable: false,
        errorMessage: null,
        lastCheckedAt: toIsoNow(),
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        stage: this.isCurrentUpdateDeferred() ? 'deferred' : 'downloading',
        updateAvailable: true,
        errorMessage: null,
        downloadProgressPercent: Number.isFinite(progress.percent)
          ? Math.max(0, Math.min(100, Math.round(progress.percent)))
          : 0,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      const version = normalizeUpdateVersion(info);
      const isDeferred = this.isDeferredVersion(version);
      if (!isDeferred) {
        this.deferredVersion = null;
      }

      this.setState({
        stage: isDeferred ? 'deferred' : 'downloaded',
        downloadedVersion: version,
        availableVersion: version,
        updateAvailable: true,
        errorMessage: null,
        downloadProgressPercent: 100,
      });
    });

    autoUpdater.on('error', (error) => {
      this.setState({
        stage: 'error',
        errorMessage: error?.message ?? 'Failed to update. The current version remains in place.',
        downloadProgressPercent: 0,
        lastCheckedAt: toIsoNow(),
      });
    });

    this.setState({
      stage: 'idle',
      canAutoUpdate: true,
      updateAvailable: false,
      disabledReason: null,
    });

    this.scheduleBackgroundChecks();
    return this.getState();
  }

  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  getState(): OtaUpdateState {
    return {
      ...this.state,
    };
  }

  async checkForUpdates(): Promise<OtaUpdateState> {
    if (!this.state.canAutoUpdate) {
      return this.getState();
    }

    await autoUpdater.checkForUpdates();
    return this.getState();
  }

  async downloadUpdate(): Promise<OtaUpdateState> {
    if (!this.state.canAutoUpdate) {
      return this.getState();
    }

    if (this.state.stage === 'downloaded') {
      return this.getState();
    }

    this.deferredVersion = null;

    this.setState({
      stage: 'downloading',
      errorMessage: null,
      updateAvailable: true,
      downloadProgressPercent: this.state.downloadProgressPercent,
    });

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.setState({
        stage: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
        lastCheckedAt: toIsoNow(),
      });
    }
    return this.getState();
  }

  deferUpdate(): OtaUpdateState {
    if (!this.state.updateAvailable) {
      return this.getState();
    }

    this.deferredVersion = this.state.downloadedVersion ?? this.state.availableVersion;

    this.setState({
      stage: 'deferred',
    });
    return this.getState();
  }

  applyUpdateNow(): OtaUpdateState {
    if (!this.state.canAutoUpdate || this.state.stage !== 'downloaded') {
      return this.getState();
    }

    autoUpdater.quitAndInstall(false, true);
    return this.getState();
  }

  private scheduleBackgroundChecks(): void {
    if (this.checkTimer || !this.state.canAutoUpdate) {
      return;
    }

    const intervalMs = Number(process.env.FLOWSTATE_UPDATE_CHECK_INTERVAL_MS);
    const checkInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : DEFAULT_CHECK_INTERVAL_MS;

    this.checkTimer = setInterval(() => {
      void this.checkForUpdates().catch((error) => {
        this.setState({
          stage: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
          lastCheckedAt: toIsoNow(),
        });
      });
    }, checkInterval);
  }

  private isCurrentUpdateDeferred(): boolean {
    return this.isDeferredVersion(this.state.downloadedVersion ?? this.state.availableVersion);
  }

  private isDeferredVersion(version: string | null): boolean {
    return version !== null && version === this.deferredVersion;
  }

  private setState(patch: Partial<OtaUpdateState>): void {
    this.state = {
      ...this.state,
      ...patch,
      currentVersion: app.getVersion(),
    };
    this.sendState(this.getState());
  }
}

export const createOtaUpdater = (sendState: SendState): OtaUpdater => {
  return new OtaUpdater(sendState);
};
