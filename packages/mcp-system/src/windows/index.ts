/**
 * Windows System Operations (Placeholder)
 * 
 * Implementation of system tools for Windows.
 * To be implemented post-MVP.
 */

export async function sendNotification(
  title: string,
  message: string,
  _sound: boolean = true
): Promise<void> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function openApp(_appName: string): Promise<void> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function openUrl(_url: string): Promise<void> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function openFile(_path: string): Promise<void> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function readClipboard(): Promise<string> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function focusApp(_appName: string): Promise<void> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function arrangeWindows(
  _layout: string,
  _apps?: string[]
): Promise<void> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function executeShell(
  _command: string,
  _cwd?: string
): Promise<string> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}

export async function setDoNotDisturb(_enabled: boolean): Promise<void> {
  throw new Error('Windows support not yet implemented. Please use macOS for MVP.');
}
