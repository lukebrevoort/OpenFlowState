/**
 * FlowState Memory System
 * 
 * SQLite-backed storage for context, preferences, and entity linking.
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const FLOWSTATE_DIR = path.join(os.homedir(), '.flowstate');
const DB_FILE = path.join(FLOWSTATE_DIR, 'memory.db');

export interface UserPreferences {
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  defaultLLMProvider: string;
  notificationsEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  workingHoursStart: '09:00',
  workingHoursEnd: '17:00',
  defaultLLMProvider: 'opencode/zen',
  notificationsEnabled: true,
};

export class MemoryStore {
  private db: Database.Database | null = null;

  constructor() {}

  initialize(): void {
    if (this.db) return;

    // Ensure directory exists
    if (!fs.existsSync(FLOWSTATE_DIR)) {
      fs.mkdirSync(FLOWSTATE_DIR, { recursive: true });
    }

    try {
      this.db = new Database(DB_FILE);
      this.db.pragma('journal_mode = WAL');
      
      this.initSchema();
      console.log(`[Memory] Initialized at ${DB_FILE}`);
    } catch (error) {
      console.error('[Memory] Failed to initialize database:', error);
      throw error;
    }
  }

  private initSchema(): void {
    if (!this.db) throw new Error('DB not initialized');

    // Preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Context table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Initialize default preferences if empty
    const row = this.db.prepare('SELECT key FROM preferences LIMIT 1').get();
    if (!row) {
      this.setPreferencesSync(DEFAULT_PREFERENCES);
    }
  }

  private setPreferencesSync(prefs: UserPreferences): void {
    if (!this.db) throw new Error('DB not initialized');
    
    const stmt = this.db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)');
    
    const transaction = this.db.transaction((preferences: UserPreferences) => {
      for (const [key, value] of Object.entries(preferences)) {
        stmt.run(key, JSON.stringify(value));
      }
    });

    transaction(prefs);
  }

  async getPreferences(): Promise<UserPreferences> {
    this.initialize();
    if (!this.db) throw new Error('DB not initialized');

    const rows = this.db.prepare('SELECT key, value FROM preferences').all() as { key: string; value: string }[];
    
    const prefs: any = { ...DEFAULT_PREFERENCES };
    
    for (const row of rows) {
      try {
        prefs[row.key] = JSON.parse(row.value);
      } catch (e) {
        console.warn(`[Memory] Failed to parse preference ${row.key}`);
      }
    }

    return prefs as UserPreferences;
  }

  async setPreferences(prefs: Partial<UserPreferences>): Promise<void> {
    this.initialize();
    if (!this.db) throw new Error('DB not initialized');

    // Get current prefs to merge
    const current = await this.getPreferences();
    const newPrefs = { ...current, ...prefs };
    
    this.setPreferencesSync(newPrefs);
  }

  async addContext(key: string, value: unknown): Promise<void> {
    this.initialize();
    if (!this.db) throw new Error('DB not initialized');

    const stmt = this.db.prepare('INSERT OR REPLACE INTO context (key, value, updated_at) VALUES (?, ?, ?)');
    stmt.run(key, JSON.stringify(value), Date.now());
  }

  async getContext(key: string): Promise<unknown | null> {
    this.initialize();
    if (!this.db) throw new Error('DB not initialized');

    const row = this.db.prepare('SELECT value FROM context WHERE key = ?').get(key) as { value: string } | undefined;
    
    if (!row) return null;
    
    try {
      return JSON.parse(row.value);
    } catch (e) {
      return null;
    }
  }

  async removeContext(key: string): Promise<void> {
    this.initialize();
    if (!this.db) throw new Error('DB not initialized');

    this.db.prepare('DELETE FROM context WHERE key = ?').run(key);
  }
}

export const memory = new MemoryStore();
