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
  command: string[];
  enabled: boolean;
  env?: Record<string, string>;
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
      this.config = {
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
        },
      };
      return this.config;
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
      if (config.enabled) {
        mcpConfig[name] = {
          type: 'local',
          command: config.command,
          env: config.env,
        };
      }
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
