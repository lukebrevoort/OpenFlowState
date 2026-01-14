/**
 * FlowState Desktop App - Process Manager & OpenCode Bridge
 *
 * This module is responsible for:
 * 1. Managing the OpenCode server lifecycle (start/stop)
 * 2. Creating and maintaining the OpenCode SDK client
 * 3. Handling session state and communication
 * 4. Streaming events to the renderer process
 * 5. Configuring MCP servers with auth tokens
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { createOpencode, McpLocalConfig } from '@opencode-ai/sdk';
import { authManager } from './auth-manager.js';

// Use the return type of createOpencode for proper typing
type OpenCodeInstance = Awaited<ReturnType<typeof createOpencode>>;

class ProcessManager {
  private instance: OpenCodeInstance | null = null;
  private isRunning: boolean = false;
  private activeSessionId: string | null = null;
  private eventStreamAbortController: AbortController | null = null;

  constructor() {
    // Handle app shutdown
    app.on('before-quit', async () => {
      await this.stop();
    });
  }

  /**
   * Get the OpenCode client
   */
  get client() {
    return this.instance?.client ?? null;
  }

  /**
   * Check if OpenCode is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the active session ID
   */
  get sessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get the path to MCP server packages
   */
  private getMcpPackagesDir(): string {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = app.getAppPath();
    
    let packagesDir: string;
    if (isDev) {
      // In development, go up from packages/desktop to packages/
      // app.getAppPath() may be packages/desktop or packages/desktop/dist/main
      const isDistMain = appPath.endsWith(`${path.sep}dist${path.sep}main`);
      packagesDir = isDistMain
        ? path.resolve(appPath, '../../..')
        : path.resolve(appPath, '..');
    } else {
      packagesDir = path.join(appPath, 'mcp-servers');
    }
    
    console.log('[ProcessManager] App path:', appPath);
    console.log('[ProcessManager] isDev:', isDev);
    console.log('[ProcessManager] MCP packages dir:', packagesDir);
    
    return packagesDir;
  }

  /**
   * Verify an MCP server script exists
   */
  private verifyMcpServer(packagesDir: string, serverName: string): string | null {
    const serverPath = path.join(packagesDir, serverName, 'dist/index.js');
    const exists = fs.existsSync(serverPath);
    
    console.log(`[ProcessManager] MCP server ${serverName}: ${serverPath} (exists: ${exists})`);
    
    return exists ? serverPath : null;
  }

  /**
   * Build MCP configuration with auth tokens from auth-manager
   */
  private async buildMcpConfig(): Promise<Record<string, McpLocalConfig>> {
    const mcpConfig: Record<string, McpLocalConfig> = {};
    const packagesDir = this.getMcpPackagesDir();

    // Gmail MCP
    const gmailToken = await authManager.getToken('gmail');
    const gmailCreds = await authManager.getClientCredentials('gmail');
    const gmailPath = this.verifyMcpServer(packagesDir, 'mcp-gmail');
    if (gmailToken && gmailPath) {
      mcpConfig['flowstate-gmail'] = {
        type: 'local',
        command: ['node', gmailPath],
        environment: {
          GMAIL_ACCESS_TOKEN: gmailToken.accessToken,
          GMAIL_REFRESH_TOKEN: gmailToken.refreshToken || '',
          GOOGLE_CLIENT_ID: gmailCreds?.clientId || '',
          GOOGLE_CLIENT_SECRET: gmailCreds?.clientSecret || '',
        },
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] Gmail MCP configured with token and credentials');
    } else if (gmailToken && !gmailPath) {
      console.error('[ProcessManager] Gmail token found but MCP server not built!');
    }

    // Google Calendar MCP
    const gcalToken = await authManager.getToken('gcal');
    const gcalCreds = await authManager.getClientCredentials('gcal');
    const gcalPath = this.verifyMcpServer(packagesDir, 'mcp-gcal');
    if (gcalToken && gcalPath) {
      mcpConfig['flowstate-gcal'] = {
        type: 'local',
        command: ['node', gcalPath],
        environment: {
          GCAL_ACCESS_TOKEN: gcalToken.accessToken,
          GCAL_REFRESH_TOKEN: gcalToken.refreshToken || '',
          GOOGLE_CLIENT_ID: gcalCreds?.clientId || '',
          GOOGLE_CLIENT_SECRET: gcalCreds?.clientSecret || '',
        },
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] Google Calendar MCP configured with token and credentials');
    } else if (gcalToken && !gcalPath) {
      console.error('[ProcessManager] GCal token found but MCP server not built!');
    }

    // Notion MCP
    const notionToken = await authManager.getToken('notion');
    const notionPath = this.verifyMcpServer(packagesDir, 'mcp-notion');
    if (notionToken && notionPath) {
      mcpConfig['flowstate-notion'] = {
        type: 'local',
        command: ['node', notionPath],
        environment: {
          NOTION_ACCESS_TOKEN: notionToken.accessToken,
        },
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] Notion MCP configured with token');
    } else if (notionToken && !notionPath) {
      console.error('[ProcessManager] Notion token found but MCP server not built!');
    }

    // System MCP (no auth needed)
    const systemPath = this.verifyMcpServer(packagesDir, 'mcp-system');
    if (systemPath) {
      mcpConfig['flowstate-system'] = {
        type: 'local',
        command: ['node', systemPath],
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] System MCP configured');
    }

    console.log('[ProcessManager] Final MCP config keys:', Object.keys(mcpConfig));
    return mcpConfig;
  }

  /**
   * Start the OpenCode server and client
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('OpenCode already running');
      return;
    }

    console.log('Starting OpenCode server...');

    try {
      // Build MCP configuration with auth tokens
      const mcpConfig = await this.buildMcpConfig();
      console.log('[ProcessManager] MCP servers configured:', Object.keys(mcpConfig));
      console.log('[ProcessManager] Full MCP config:', JSON.stringify(mcpConfig, null, 2));

      // Start OpenCode (both server and client)
      // Using port 0 lets the OS assign an available port
      this.instance = await createOpencode({
        hostname: '127.0.0.1',
        port: 0,
        timeout: 30000, // 30 second timeout for server start
        config: {
          // Use opencode/grok-code as the default model
          model: 'opencode/grok-code',
          // Configure MCP servers with tokens
          mcp: mcpConfig,
        },
      });

      this.isRunning = true;
      console.log(`OpenCode server started at ${this.instance.server.url}`);

      // Create an initial session
      await this.createSession('FlowState Chat');

      // Check MCP status after a short delay to let servers connect
      setTimeout(() => this.logMcpStatus(), 2000);

    } catch (error) {
      console.error('Failed to start OpenCode:', error);
      this.isRunning = false;
      this.instance = null;
      throw error;
    }
  }

  /**
   * Log MCP server status (for debugging)
   */
  async logMcpStatus(): Promise<void> {
    if (!this.instance?.client) {
      console.warn('[ProcessManager] Cannot check MCP status: client not available');
      return;
    }

    try {
      const result = await this.instance.client.mcp.status({});
      console.log('[ProcessManager] MCP Status:', JSON.stringify(result.data, null, 2));
      
      // Log any failed servers
      if (result.data) {
        for (const [name, status] of Object.entries(result.data)) {
          if (status.status === 'failed') {
            console.error(`[ProcessManager] MCP server ${name} FAILED:`, (status as { error?: string }).error);
          } else if (status.status === 'connected') {
            console.log(`[ProcessManager] MCP server ${name} connected successfully`);
          }
        }
      }
    } catch (error) {
      console.error('[ProcessManager] Error checking MCP status:', error);
    }
  }

  /**
   * Get MCP server status
   */
  async getMcpStatus(): Promise<Record<string, unknown> | null> {
    if (!this.instance?.client) {
      return null;
    }

    try {
      const result = await this.instance.client.mcp.status({});
      return result.data || null;
    } catch (error) {
      console.error('[ProcessManager] Error getting MCP status:', error);
      return null;
    }
  }

  /**
   * Reload MCP configuration (call after connecting/disconnecting integrations)
   * Uses the mcp.add() API for dynamic server management
   */
  async reloadMcpConfig(): Promise<void> {
    if (!this.instance?.client) {
      console.warn('[ProcessManager] Cannot reload MCP config: OpenCode not running');
      return;
    }

    try {
      console.log('[ProcessManager] Reloading MCP configuration...');
      
      const mcpConfig = await this.buildMcpConfig();
      
      // Add each MCP server individually using the mcp.add() API
      for (const [name, config] of Object.entries(mcpConfig)) {
        try {
          console.log(`[ProcessManager] Adding MCP server: ${name}`);
          const result = await this.instance.client.mcp.add({
            body: {
              name,
              config,
            },
          });
          console.log(`[ProcessManager] MCP server ${name} add result:`, JSON.stringify(result.data, null, 2));
        } catch (addError) {
          console.error(`[ProcessManager] Failed to add MCP server ${name}:`, addError);
        }
      }
      
      // Log final status
      await this.logMcpStatus();
      
      console.log('[ProcessManager] MCP config reload complete');
    } catch (error) {
      console.error('[ProcessManager] Failed to reload MCP config:', error);
    }
  }

  /**
   * Stop the OpenCode server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.instance) {
      return;
    }

    console.log('Stopping OpenCode server...');

    // Stop event stream
    if (this.eventStreamAbortController) {
      this.eventStreamAbortController.abort();
      this.eventStreamAbortController = null;
    }

    try {
      this.instance.server.close();
      console.log('OpenCode server stopped');
    } catch (error) {
      console.error('Error stopping OpenCode:', error);
    } finally {
      this.instance = null;
      this.isRunning = false;
      this.activeSessionId = null;
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(title?: string): Promise<string> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    try {
      const result = await this.instance.client.session.create({
        body: {
          title: title || 'FlowState Session',
        },
      });

      if (result.error) {
        throw new Error(`Failed to create session: ${JSON.stringify(result.error)}`);
      }

      this.activeSessionId = result.data?.id ?? null;
      console.log(`Created new session: ${this.activeSessionId}`);
      return this.activeSessionId!;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Send a message to the active session and get a response
   */
  async sendMessage(content: string, webContents?: Electron.WebContents): Promise<{
    content: string;
    parts: Array<{ type: string; text?: string }>;
  }> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    // Ensure we have a session
    if (!this.activeSessionId) {
      await this.createSession();
    }

    // Notify renderer that we're processing
    if (webContents) {
      webContents.send('opencode:progress', { status: 'thinking', sessionId: this.activeSessionId });
    }

    try {
      const result = await this.instance.client.session.prompt({
        path: { id: this.activeSessionId! },
        body: {
          parts: [{ type: 'text', text: content }],
        },
      });

      if (result.error) {
        throw new Error(`Prompt failed: ${JSON.stringify(result.error)}`);
      }

      // Extract text content from parts
      const parts = result.data?.parts ?? [];
      const textContent = parts
        .filter((p: { type: string }) => p.type === 'text')
        .map((p: { type: string; text?: string }) => p.text || '')
        .join('') || '';

      // Notify renderer of completion
      if (webContents) {
        webContents.send('opencode:progress', { status: 'idle', sessionId: this.activeSessionId });
      }

      return {
        content: textContent,
        parts: parts,
      };
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (webContents) {
        webContents.send('opencode:progress', { status: 'error', sessionId: this.activeSessionId });
        webContents.send('opencode:error', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      throw error;
    }
  }

  /**
   * Send a message and stream the response to the renderer
   */
  async streamMessage(content: string, webContents: Electron.WebContents): Promise<void> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    // Ensure we have a session
    if (!this.activeSessionId) {
      await this.createSession();
    }

    // Notify renderer that we're processing
    webContents.send('opencode:progress', { status: 'thinking', sessionId: this.activeSessionId });

    try {
      // Send the prompt
      const result = await this.instance.client.session.prompt({
        path: { id: this.activeSessionId! },
        body: {
          parts: [{ type: 'text', text: content }],
        },
      });

      if (result.error) {
        throw new Error(`Prompt failed: ${JSON.stringify(result.error)}`);
      }

      // Extract text content from parts
      const parts = result.data?.parts ?? [];
      const textContent = parts
        .filter((p: { type: string }) => p.type === 'text')
        .map((p: { type: string; text?: string }) => p.text || '')
        .join('') || '';

      // Send the complete message to renderer
      const assistantMessage = {
        id: (result.data as { info?: { id?: string } })?.info?.id || Date.now().toString(),
        role: 'assistant' as const,
        content: textContent,
        timestamp: new Date().toISOString(),
        parts: parts,
      };

      webContents.send('opencode:message', assistantMessage);
      webContents.send('opencode:progress', { status: 'idle', sessionId: this.activeSessionId });

    } catch (error) {
      console.error('Error in streamMessage:', error);
      webContents.send('opencode:error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      webContents.send('opencode:progress', { status: 'error', sessionId: this.activeSessionId });
      throw error;
    }
  }

  /**
   * Start the global event stream from OpenCode
   * This forwards relevant events to the renderer process
   */
  async startEventStream(webContents: Electron.WebContents): Promise<void> {
    if (!this.instance?.client) {
      console.warn('Cannot start event stream: OpenCode not running');
      return;
    }

    // Abort any existing stream
    if (this.eventStreamAbortController) {
      this.eventStreamAbortController.abort();
    }

    this.eventStreamAbortController = new AbortController();

    console.log('Starting OpenCode event stream...');

    // Run event stream in background
    (async () => {
      try {
        // Use the event.subscribe() method which returns a ServerSentEventsResult
        const sseResult = await this.instance!.client.event.subscribe();

        // The result has a 'stream' property which is an AsyncGenerator
        for await (const event of sseResult.stream) {
          // Check if we should stop
          if (this.eventStreamAbortController?.signal.aborted) {
            break;
          }

          // Type the event
          const typedEvent = event as { type?: string; properties?: unknown };

          // Forward relevant events to renderer
          if (typedEvent.type) {
            switch (typedEvent.type) {
              case 'message.created':
              case 'message.updated':
                webContents.send('opencode:event', {
                  type: typedEvent.type,
                  data: typedEvent.properties,
                });
                break;

              case 'session.updated':
                webContents.send('opencode:event', {
                  type: typedEvent.type,
                  data: typedEvent.properties,
                });
                break;

              default:
                // Log other events for debugging
                console.log('OpenCode event:', typedEvent.type);
            }
          }
        }
      } catch (error) {
        if (!this.eventStreamAbortController?.signal.aborted) {
          console.error('Event stream error:', error);
        }
      }
    })();
  }

  /**
   * Get session history
   */
  async getSessionMessages(): Promise<Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
  }>> {
    if (!this.instance?.client || !this.activeSessionId) {
      return [];
    }

    try {
      const result = await this.instance.client.session.messages({
        path: { id: this.activeSessionId },
      });

      if (result.error || !result.data) {
        return [];
      }

      return (result.data as Array<{ info: { id: string; role: string; createdAt?: string }; parts: Array<{ type: string; text?: string }> }>).map((msg) => ({
        id: msg.info.id,
        role: msg.info.role,
        content: msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text || '')
          .join(''),
        timestamp: msg.info.createdAt || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error getting session messages:', error);
      return [];
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Array<{ id: string; title: string }>> {
    if (!this.instance?.client) {
      return [];
    }

    try {
      const result = await this.instance.client.session.list();
      
      if (result.error || !result.data) {
        return [];
      }

      return (result.data as Array<{ id: string; title?: string }>).map((s) => ({
        id: s.id,
        title: s.title || 'Untitled Session',
      }));
    } catch (error) {
      console.error('Error listing sessions:', error);
      return [];
    }
  }

  /**
   * Switch to a different session
   */
  async switchSession(sessionId: string): Promise<void> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    // Verify session exists
    const result = await this.instance.client.session.get({
      path: { id: sessionId },
    });

    if (result.error) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.activeSessionId = sessionId;
    console.log(`Switched to session: ${sessionId}`);
  }

  /**
   * Health check - verify the server is responding
   */
  async healthCheck(): Promise<{ healthy: boolean; version?: string }> {
    if (!this.instance?.client) {
      return { healthy: false };
    }

    try {
      // Use session.list as a health check since there's no dedicated health endpoint
      const result = await this.instance.client.session.list();
      return {
        healthy: !result.error,
        version: 'unknown', // SDK doesn't expose version
      };
    } catch {
      return { healthy: false };
    }
  }
}

export const processManager = new ProcessManager();
export default processManager;
