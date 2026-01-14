/**
 * FlowState Daemon
 * 
 * Background process management for long-running tasks,
 * monitoring, and notification delivery.
 */

import { memory } from '../memory/index.js';
import { auth } from '../auth/index.js';
import { notifications } from '../notifications/index.js';

export type DaemonState = 'idle' | 'monitoring' | 'executing' | 'waiting';

export interface DaemonStatus {
  state: DaemonState;
  startedAt: Date | null;
  currentTask: string | null;
  mcpConnections: number;
}

export class FlowStateDaemon {
  private state: DaemonState = 'idle';
  private startedAt: Date | null = null;
  private interval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.state !== 'idle') return;

    try {
      console.log('[Daemon] Starting...');
      
      // Initialize subsystems
      await auth.initialize();
      memory.initialize();
      
      // Load preferences
      const prefs = await memory.getPreferences();
      console.log(`[Daemon] Loaded preferences (Timezone: ${prefs.timezone})`);

      this.state = 'monitoring';
      this.startedAt = new Date();
      
      await notifications.notify('FlowState Started', 'Daemon is running in background');
      
      this.startLoop();
      
    } catch (error: any) {
      console.error('[Daemon] Failed to start:', error);
      this.state = 'idle';
      await notifications.error('Startup Failed', error.message || 'Unknown error');
      throw error;
    }
  }

  private startLoop() {
    // Main event loop - check for scheduled tasks, etc.
    // For MVP, just a heartbeat
    this.interval = setInterval(() => {
      if (this.state === 'monitoring') {
        // TODO: Check scheduled tasks
      }
    }, 60000); // Check every minute
  }

  async stop(): Promise<void> {
    if (this.state === 'idle') return;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.state = 'idle';
    this.startedAt = null;
    console.log('[Daemon] Stopped');
    
    await notifications.notify('FlowState Stopped', 'Daemon execution halted');
  }

  getStatus(): DaemonStatus {
    return {
      state: this.state,
      startedAt: this.startedAt,
      currentTask: null,
      mcpConnections: 0, // TODO: Track connected MCPs
    };
  }
}

export const daemon = new FlowStateDaemon();
