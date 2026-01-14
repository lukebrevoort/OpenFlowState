/**
 * FlowState Desktop App - Process Manager & OpenCode Bridge
 *
 * This module is responsible for:
 * 1. Managing the OpenCode server lifecycle (start/stop)
 * 2. Creating and maintaining the OpenCode SDK client
 * 3. Handling session state and communication
 * 4. Managing child processes for MCP servers (via OpenCode)
 */

import { app } from 'electron';
import path from 'path';
import { createOpencode } from '@opencode-ai/sdk';
import configStore from './config-store.js';

// Types for OpenCode components
// Note: using 'any' for now as we don't have the full SDK types installed in this environment
type OpenCodeClient = any;
type OpenCodeServer = any;

class ProcessManager {
  private client: OpenCodeClient | null = null;
  private server: OpenCodeServer | null = null;
  private isRunning: boolean = false;
  private activeSessionId: string | null = null;

  constructor() {
    // Handle app shutdown
    app.on('before-quit', async () => {
      await this.stop();
    });
  }

  /**
   * Start the OpenCode server and client
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('Starting OpenCode server...');
    
    try {
      // Get configuration from store
      const flowStateConfig = configStore.get();
      
      // Convert to OpenCode format
      const openCodeConfig = configStore.toOpenCodeConfig();

      // Determine paths
      const userDataPath = app.getPath('userData');
      const logsPath = path.join(userDataPath, 'logs');

      // Start OpenCode (both server and client)
      // We run on a random port or specific port for internal comms
      const { client, server } = await createOpencode({
        hostname: '127.0.0.1',
        port: 0, // Random available port
        config: openCodeConfig,
        // In a real app, we might want to redirect logs
      });

      this.client = client;
      this.server = server;
      this.isRunning = true;
      
      console.log('OpenCode server started successfully');

      // Initialize a default session
      await this.createSession();

    } catch (error) {
      console.error('Failed to start OpenCode:', error);
      throw error;
    }
  }

  /**
   * Stop the OpenCode server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) return;

    console.log('Stopping OpenCode server...');
    try {
      await this.server.close();
      this.client = null;
      this.server = null;
      this.isRunning = false;
      this.activeSessionId = null;
      console.log('OpenCode server stopped');
    } catch (error) {
      console.error('Error stopping OpenCode:', error);
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(): Promise<string> {
    if (!this.client) throw new Error('OpenCode not started');

    try {
      const session = await this.client.session.create();
      this.activeSessionId = session.id;
      console.log(`Created new session: ${session.id}`);
      return session.id;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Send a message to the active session and return the response
   * Note: This is a unary call. For streaming, use streamMessage.
   */
  async sendMessage(content: string): Promise<any> {
    if (!this.client) throw new Error('OpenCode not started');
    
    // Ensure we have a session
    let sessionId = this.activeSessionId;
    if (!sessionId) {
      sessionId = await this.createSession();
    }

    try {
      const response = await this.client.session.chat(sessionId, {
        parts: [{ type: 'text', text: content }]
      });
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send a message and setup streaming for the response
   * This communicates back to the renderer via the provided WebContents
   */
  async streamMessage(content: string, webContents: Electron.WebContents): Promise<void> {
    if (!this.client) throw new Error('OpenCode not started');

    let sessionId = this.activeSessionId;
    if (!sessionId) {
      sessionId = await this.createSession();
    }

    // 1. Send the user message to the session
    // We don't await the full result here if we want to stream events globally
    // But typically SDKs have a specific stream endpoint or return a stream
    
    // Based on SDK docs: 
    // const stream = await client.event.list();
    // for await (const event of stream) { ... }
    
    // We need to start listening to events BEFORE or concurrently with sending the message
    // to capture the streaming response.
    
    // Send the message
    const messagePromise = this.client.session.chat(sessionId, {
      parts: [{ type: 'text', text: content }]
    });

    // Handle global events (this might need to be set up once, not per message)
    // For this implementation, we'll assume we can listen to session-specific events
    // or we tap into the global event stream.
    
    // NOTE: In a real implementation, we'd likely set up the event listener in start()
    // and route events based on session ID. 
    // Here is a simplified version sending "progress" updates.

    // Notify renderer that we are thinking
    webContents.send('opencode:progress', { status: 'thinking' });

    try {
      const response = await messagePromise;
      
      // Send the final response to renderer
      // In a real stream, we'd send chunks. 
      // Since the SDK example for streaming shows `client.event.list()`, 
      // we would implement a background loop in `start()` to forward those events.
      
      // For now, send the full response as a single "message" event
      // Map SDK response format to UI format
      const assistantMessage = {
        role: 'assistant',
        content: response.parts.map((p: any) => p.text).join(''),
        timestamp: new Date()
      };
      
      webContents.send('opencode:message', assistantMessage);
      webContents.send('opencode:progress', { status: 'idle' });
      
    } catch (error) {
      console.error('Error in streamMessage:', error);
      webContents.send('opencode:error', { error: String(error) });
      webContents.send('opencode:progress', { status: 'error' });
    }
  }
  
  /**
   * Setup global event streaming from OpenCode to Renderer
   * Should be called after start()
   */
  async startEventStream(webContents: Electron.WebContents): Promise<void> {
    if (!this.client) return;
    
    // Run in background
    (async () => {
        try {
            const stream = await this.client.event.list();
            for await (const event of stream) {
                // Forward relevant events to renderer
                if (event.type === 'session.updated' || event.type === 'message.created') {
                    webContents.send('opencode:event', event);
                }
                
                // If we have token streaming events (hypothetical), forward them
                // if (event.type === 'token') webContents.send('opencode:token', event);
            }
        } catch (err) {
            console.error('Event stream ended or failed:', err);
        }
    })();
  }
}

export const processManager = new ProcessManager();
export default processManager;
