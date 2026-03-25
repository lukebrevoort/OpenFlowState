export type OtaUpdateStage =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'deferred'
  | 'up-to-date'
  | 'error';

export interface OtaUpdateState {
  stage: OtaUpdateStage;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadProgressPercent: number;
  channel: string;
  canAutoUpdate: boolean;
  updateAvailable: boolean;
  errorMessage: string | null;
  lastCheckedAt: string | null;
  disabledReason: string | null;
}
