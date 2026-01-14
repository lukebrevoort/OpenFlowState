/**
 * macOS System Operations
 * 
 * Implementation of system tools for macOS.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Send a desktop notification using macOS notification center
 */
export async function sendNotification(
  title: string,
  message: string,
  sound: boolean = true
): Promise<void> {
  const soundArg = sound ? 'sound name "default"' : '';
  const script = `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}" ${soundArg}`;
  
  await execAsync(`osascript -e '${script}'`);
}

/**
 * Open an application by name
 */
export async function openApp(appName: string): Promise<void> {
  await execAsync(`open -a "${escapeShell(appName)}"`);
}

/**
 * Open a URL in the default browser
 */
export async function openUrl(url: string): Promise<void> {
  await execAsync(`open "${escapeShell(url)}"`);
}

/**
 * Open a file in its default application
 */
export async function openFile(path: string): Promise<void> {
  await execAsync(`open "${escapeShell(path)}"`);
}

/**
 * Read clipboard contents
 */
export async function readClipboard(): Promise<string> {
  const { stdout } = await execAsync('pbpaste');
  return stdout;
}

/**
 * Focus an application
 */
export async function focusApp(appName: string): Promise<void> {
  const script = `tell application "${escapeAppleScript(appName)}" to activate`;
  await execAsync(`osascript -e '${script}'`);
}

/**
 * Arrange windows in a layout
 */
export async function arrangeWindows(
  layout: string,
  apps?: string[]
): Promise<void> {
  // For MVP, implement basic arrangements using AppleScript
  // More sophisticated arrangements would require additional tooling
  
  switch (layout) {
    case 'maximize':
      if (apps && apps[0]) {
        await focusApp(apps[0]);
        // Use keyboard shortcut for maximize (if available)
        // This is a simplified implementation
      }
      break;
      
    case 'split-horizontal':
    case 'split-vertical':
      // Would require window management library for precise control
      // For now, just focus the apps in order
      if (apps) {
        for (const app of apps) {
          await focusApp(app);
        }
      }
      break;
      
    case 'center':
      if (apps && apps[0]) {
        await focusApp(apps[0]);
      }
      break;
  }
}

/**
 * Execute a shell command
 */
export async function executeShell(
  command: string,
  cwd?: string
): Promise<string> {
  const options = cwd ? { cwd } : {};
  const { stdout, stderr } = await execAsync(command, options);
  
  if (stderr) {
    return `stdout:\n${stdout}\n\nstderr:\n${stderr}`;
  }
  
  return stdout;
}

/**
 * Toggle Do Not Disturb mode
 */
export async function setDoNotDisturb(enabled: boolean): Promise<void> {
  // macOS Monterey+ uses Focus modes
  // This is a simplified implementation
  if (enabled) {
    // Turn on DND
    await execAsync(`
      defaults -currentHost write ~/Library/Preferences/ByHost/com.apple.notificationcenterui doNotDisturb -boolean true
      defaults -currentHost write ~/Library/Preferences/ByHost/com.apple.notificationcenterui doNotDisturbDate -date "$(date -u +"%Y-%m-%d %H:%M:%S +0000")"
      killall NotificationCenter 2>/dev/null || true
    `);
  } else {
    // Turn off DND
    await execAsync(`
      defaults -currentHost write ~/Library/Preferences/ByHost/com.apple.notificationcenterui doNotDisturb -boolean false
      killall NotificationCenter 2>/dev/null || true
    `);
  }
}

// Helper functions

function escapeShell(str: string): string {
  return str.replace(/"/g, '\\"');
}

function escapeAppleScript(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}
