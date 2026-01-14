/**
 * FlowState Notifications
 * 
 * Desktop notification system for approvals, completions, and alerts.
 */

import notifier from 'node-notifier';
import crypto from 'crypto';
import path from 'path';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'approval';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actions?: NotificationAction[];
  createdAt: Date;
}

export interface NotificationAction {
  label: string;
  action: 'approve' | 'deny' | 'dismiss' | 'custom';
  data?: unknown;
}

export class NotificationService {
  async send(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    
    // Log to console for audit
    console.log(`[Notification] ${notification.type}: ${notification.title} - ${notification.message}`);
    
    // Send desktop notification
    notifier.notify({
      title: `FlowState: ${notification.title}`,
      message: notification.message,
      sound: notification.type === 'error' || notification.type === 'approval',
      wait: notification.type === 'approval', // Wait for interaction if it's an approval
      timeout: notification.type === 'approval' ? 30 : 5, // 30s for approval, 5s for others
    });

    return id;
  }

  async requestApproval(title: string, message: string): Promise<boolean> {
    // For MVP CLI/Daemon, true interactive approval is hard via node-notifier alone
    // (it supports clicks but return values vary by OS).
    // For now, we will notify and expect the user to go to the Dashboard/TUI to approve.
    // Or we can use 'wait: true' and listen for click vs close.
    
    return new Promise((resolve) => {
      console.log(`[Approval Required] ${title}: ${message}`);
      
      notifier.notify({
        title: `APPROVAL NEEDED: ${title}`,
        message: message,
        sound: true,
        wait: true,
        actions: ['Approve', 'Deny'],
        closeLabel: 'Dismiss',
      }, (err: Error | null, response: string, metadata: unknown) => {
        // macOS notification center actions support varies.
        // For MVP, we assume interaction via Dashboard if this is complex.
        // But let's try to capture basic click.
        
        if (response === 'activate' || response === 'Approve') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  async notify(title: string, message: string): Promise<void> {
    await this.send({ type: 'info', title, message });
  }

  async success(title: string, message: string): Promise<void> {
    await this.send({ type: 'success', title, message });
  }

  async error(title: string, message: string): Promise<void> {
    await this.send({ type: 'error', title, message });
  }
}

export const notifications = new NotificationService();
