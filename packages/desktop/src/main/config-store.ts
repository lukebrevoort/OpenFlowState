/**
 * FlowState Desktop App - Config Store
 *
 * Manages the FlowState configuration file stored at:
 * ~/Library/Application Support/FlowState/config.json
 *
 * Uses a Claude Desktop-style configuration format for MCP servers,
 * provider settings, and user preferences.
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Local MCP server command (type=local). */
  command?: string[];

  /** Remote MCP server URL (type=remote). */
  url?: string;

  /** Remote MCP request headers (type=remote). */
  headers?: Record<string, string>;

  enabled: boolean;

  /** Local MCP env vars (type=local). */
  env?: Record<string, string>;

  /** Optional tool-fetch timeout (ms). */
  timeout?: number;
}

/**
 * Provider configuration for LLM settings
 */
export interface ProviderConfig {
  default: string;
  apiKeys: Record<string, string>;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  approvals: boolean;
  taskComplete: boolean;
}

/**
 * Working hours configuration
 */
export interface WorkingHours {
  start: string;
  end: string;
}

export interface StudyMaterialRetentionPreferences {
  globalRetentionDays: number;
  perCourseRetentionEnabled: boolean;
}

export interface StudyMaterialPreferences {
  externalKnowledgeAllowlistEnabled: boolean;
  defaultGenerationMode: 'conservative' | 'coaching';
  maxConcurrentRuns: number;
  retention: StudyMaterialRetentionPreferences;
}

export interface UpdatePreferences {
  checkIntervalMinutes: number;
}

/**
 * User preferences
 */
export interface UserPreferences {
  timezone: string;
  workingHours: WorkingHours;
  notifications: NotificationPreferences;

  /**
   * When true/false, overrides system prefers-reduced-motion.
   * When undefined, the renderer should follow the system preference.
   */
  reduceMotion?: boolean;

  /**
   * Controls decorative background motion.
   * When undefined, the renderer should default to 'animated'.
   */
  backgroundMotion?: 'animated' | 'static';

  studyMaterials?: StudyMaterialPreferences;
  updates?: UpdatePreferences;
}

export interface GoogleCalendarPreferences {
  /**
   * Calendars the agent should read/check for conflicts.
   * Defaults to ['primary'] when unset.
   */
  readCalendarIds?: string[];

  /**
   * Default calendar to create events in.
   * When unset, the MCP server will use 'primary' unless only one read calendar is selected.
   */
  writeCalendarId?: string;
}

export interface IntegrationPreferences {
  gcal?: GoogleCalendarPreferences;
}

/**
 * Complete FlowState configuration
 */
export interface FlowStateConfig {
  $schema?: string;
  provider: ProviderConfig;
  mcpServers: Record<string, MCPServerConfig>;
  preferences: UserPreferences;
  integrations?: IntegrationPreferences;
  onboardingComplete?: boolean;
}

/**
 * Default configuration for new installations
 */
const DEFAULT_CONFIG: FlowStateConfig = {
  $schema: 'https://flowstate.app/config.json',
  provider: {
    default: 'opencode/grok-code',
    apiKeys: {},
  },
  mcpServers: {
    // Built-in FlowState MCP servers (paths will be resolved at runtime)
    'flowstate-notion': {
      command: ['node', 'PLACEHOLDER_PATH'],
      enabled: true,
    },
    'flowstate-gmail': {
      command: ['node', 'PLACEHOLDER_PATH'],
      enabled: true,
    },
    'flowstate-gcal': {
      command: ['node', 'PLACEHOLDER_PATH'],
      enabled: true,
    },
    'flowstate-system': {
      command: ['node', 'PLACEHOLDER_PATH'],
      enabled: true,
    },
  },
  preferences: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    workingHours: { start: '09:00', end: '17:00' },
    notifications: {
      approvals: true,
      taskComplete: true,
    },
    studyMaterials: {
      externalKnowledgeAllowlistEnabled: false,
      defaultGenerationMode: 'conservative',
      maxConcurrentRuns: 2,
      retention: {
        globalRetentionDays: 30,
        perCourseRetentionEnabled: true,
      },
    },
    updates: {
      checkIntervalMinutes: 60,
    },
  },
  integrations: {},
  onboardingComplete: false,
};

/**
 * ConfigStore class for managing FlowState configuration
 */
class ConfigStore {
  private configPath: string;
  private dataDir: string;
  private config: FlowStateConfig | null = null;

  constructor() {
    // Determine the data directory based on platform
    this.dataDir = path.join(app.getPath('userData'));
    this.configPath = path.join(this.dataDir, 'config.json');
  }

  /**
   * Get the data directory path
   */
  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Ensure the data directory exists
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });

      // Also create subdirectories
      await fs.mkdir(path.join(this.dataDir, 'auth'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'workflows'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'logs'), { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<FlowStateConfig> {
    await this.ensureDataDir();

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(data) as FlowStateConfig;
      // Deep-merge with defaults so upgraded configs with missing nested
      // fields (e.g. notifications.taskComplete) inherit the correct defaults
      const merged: FlowStateConfig = {
        ...DEFAULT_CONFIG,
        ...loaded,
        preferences: {
          ...DEFAULT_CONFIG.preferences,
          ...loaded.preferences,
          notifications: {
            ...DEFAULT_CONFIG.preferences.notifications,
            ...loaded.preferences?.notifications,
          },
          workingHours: {
            ...DEFAULT_CONFIG.preferences.workingHours,
            ...loaded.preferences?.workingHours,
          },
          studyMaterials: {
            externalKnowledgeAllowlistEnabled:
              loaded.preferences?.studyMaterials?.externalKnowledgeAllowlistEnabled ??
              DEFAULT_CONFIG.preferences.studyMaterials!.externalKnowledgeAllowlistEnabled,
            defaultGenerationMode:
              loaded.preferences?.studyMaterials?.defaultGenerationMode ??
              DEFAULT_CONFIG.preferences.studyMaterials!.defaultGenerationMode,
            maxConcurrentRuns:
              loaded.preferences?.studyMaterials?.maxConcurrentRuns ??
              DEFAULT_CONFIG.preferences.studyMaterials!.maxConcurrentRuns,
            retention: {
              globalRetentionDays:
                loaded.preferences?.studyMaterials?.retention?.globalRetentionDays ??
                DEFAULT_CONFIG.preferences.studyMaterials!.retention.globalRetentionDays,
              perCourseRetentionEnabled:
                loaded.preferences?.studyMaterials?.retention?.perCourseRetentionEnabled ??
                DEFAULT_CONFIG.preferences.studyMaterials!.retention.perCourseRetentionEnabled,
            },
          },
          updates: {
            checkIntervalMinutes:
              loaded.preferences?.updates?.checkIntervalMinutes ??
              DEFAULT_CONFIG.preferences.updates!.checkIntervalMinutes,
          },
        },
      };
      this.config = merged;
      return merged;
    } catch (error) {
      // File doesn't exist or is invalid - create default config
      console.log('Config file not found, creating default configuration');
      this.config = { ...DEFAULT_CONFIG };
      await this.save();
      return this.config;
    }
  }

  /**
   * Save configuration to disk
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration loaded');
    }

    await this.ensureDataDir();
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Get the current configuration
   */
  get(): FlowStateConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Update configuration with partial values
   */
  async update(partial: Partial<FlowStateConfig>): Promise<FlowStateConfig> {
    if (!this.config) {
      await this.load();
    }

    this.config = {
      ...this.config!,
      ...partial,
    };

    await this.save();
    return this.config;
  }

  /**
   * Update a specific MCP server configuration
   */
  async updateMCPServer(
    name: string,
    config: Partial<MCPServerConfig>
  ): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    this.config!.mcpServers[name] = {
      ...this.config!.mcpServers[name],
      ...config,
    };

    await this.save();
  }

  /**
   * Add a new MCP server
   */
  async addMCPServer(name: string, config: MCPServerConfig): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    this.config!.mcpServers[name] = config;
    await this.save();
  }

  /**
   * Remove an MCP server
   */
  async removeMCPServer(name: string): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    delete this.config!.mcpServers[name];
    await this.save();
  }

  /**
   * Set the default LLM provider
   */
  async setProvider(provider: string, apiKey?: string): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    this.config!.provider.default = provider;
    if (apiKey) {
      // Extract provider name from provider string (e.g., "anthropic/claude-3-sonnet" -> "anthropic")
      const providerName = provider.split('/')[0];
      this.config!.provider.apiKeys[providerName] = apiKey;
    }

    await this.save();
  }

  /**
   * Get API key for a provider
   */
  getApiKey(provider: string): string | undefined {
    return this.config?.provider.apiKeys[provider];
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    this.config!.preferences = {
      ...this.config!.preferences,
      ...preferences,
    };

    await this.save();
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(): Promise<void> {
    await this.update({ onboardingComplete: true });
  }

  /**
   * Check if onboarding is complete
   */
  isOnboardingComplete(): boolean {
    return this.config?.onboardingComplete ?? false;
  }

  /**
   * Get enabled MCP servers
   */
  getEnabledMCPServers(): Record<string, MCPServerConfig> {
    if (!this.config) {
      return {};
    }

    const enabled: Record<string, MCPServerConfig> = {};
    for (const [name, config] of Object.entries(this.config.mcpServers)) {
      if (config.enabled) {
        enabled[name] = config;
      }
    }
    return enabled;
  }

  /**
   * Convert to OpenCode-compatible config format
   */
  toOpenCodeConfig(): Record<string, unknown> {
    if (!this.config) {
      return {};
    }

    const mcpConfig: Record<string, unknown> = {};
    for (const [name, config] of Object.entries(this.config.mcpServers)) {
      if (!config.enabled) continue;

      if (typeof config.url === 'string' && config.url.trim().length > 0) {
        mcpConfig[name] = {
          type: 'remote',
          url: config.url.trim(),
          headers: config.headers,
          enabled: true,
          timeout: config.timeout,
        };
        continue;
      }

      mcpConfig[name] = {
        type: 'local',
        command: config.command,
        environment: config.env,
        enabled: true,
        timeout: config.timeout,
      };
    }

    return {
      provider: {
        [this.config.provider.default.split('/')[0]]: {
          options: {},
        },
      },
      mcp: mcpConfig,
    };
  }
}

// Singleton instance
export const configStore = new ConfigStore();
export default configStore;
