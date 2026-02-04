/**
 * FlowState User Profile Store
 *
 * Local JSON file for durable, user-editable preferences that should
 * persist across sessions and be available to the agent.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export type UserTimeWindow = {
  start?: string;
  end?: string;
  days?: string[];
};

export interface UserProfile {
  preferredName?: string;
  timezone?: string;
  location?: string;
  studyHours?: UserTimeWindow;
  workingHours?: UserTimeWindow;
  notes?: string;
  updatedAt?: string;
}

export type UserProfileStoreConfig = {
  dataDir?: string;
  profilePath?: string;
};

const DEFAULT_PROFILE: UserProfile = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

const mergeTimeWindow = (
  current?: UserTimeWindow,
  updates?: UserTimeWindow
): UserTimeWindow | undefined => {
  if (!current && !updates) return undefined;
  return {
    ...(current ?? {}),
    ...(updates ?? {}),
    ...(updates?.days ? { days: [...updates.days] } : {}),
  };
};

const mergeProfile = (
  current: UserProfile,
  updates: Partial<UserProfile>
): UserProfile => ({
  ...current,
  ...updates,
  studyHours: mergeTimeWindow(current.studyHours, updates.studyHours),
  workingHours: mergeTimeWindow(current.workingHours, updates.workingHours),
});

export class UserProfileStore {
  private dataDir?: string;
  private profilePath?: string;

  configure(config: UserProfileStoreConfig): void {
    if (config.dataDir) {
      this.dataDir = config.dataDir;
    }
    if (config.profilePath) {
      this.profilePath = config.profilePath;
    }
  }

  getProfilePath(): string {
    if (this.profilePath) return this.profilePath;

    const baseDir =
      this.dataDir ||
      process.env.FLOWSTATE_DATA_DIR ||
      path.join(os.homedir(), '.flowstate');

    return path.join(baseDir, 'user-profile.json');
  }

  private async ensureDir(): Promise<void> {
    const profilePath = this.getProfilePath();
    const dir = path.dirname(profilePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async getProfile(): Promise<UserProfile> {
    const profilePath = this.getProfilePath();

    try {
      const raw = await fs.readFile(profilePath, 'utf8');
      const parsed = JSON.parse(raw) as UserProfile;
      return { ...DEFAULT_PROFILE, ...parsed };
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        return { ...DEFAULT_PROFILE };
      }
      console.error('[UserProfile] Failed to load profile, using defaults:', error);
      return { ...DEFAULT_PROFILE };
    }
  }

  async setProfile(profile: UserProfile): Promise<void> {
    await this.ensureDir();
    const payload: UserProfile = {
      ...DEFAULT_PROFILE,
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.getProfilePath(), JSON.stringify(payload, null, 2));
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const merged = mergeProfile(current, updates);
    const payload: UserProfile = {
      ...merged,
      updatedAt: new Date().toISOString(),
    };
    await this.ensureDir();
    await fs.writeFile(this.getProfilePath(), JSON.stringify(payload, null, 2));
    return payload;
  }
}

export const userProfile = new UserProfileStore();
