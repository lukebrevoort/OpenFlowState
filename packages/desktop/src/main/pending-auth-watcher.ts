/**
 * Pending Auth Watcher
 *
 * Watches for pending auth files written by integration auth flows
 * and processes them to persist auth tokens and reload MCPs.
 *
 * This enables MCP tools to trigger auth persistence without direct IPC to the desktop.
 */

import fs from 'fs/promises';
import { watch as watchFs, type FSWatcher as NodeFSWatcher } from 'node:fs';
import path from 'path';
import { authManager } from './auth-manager.js';
import { processManager } from './process-manager.js';

interface PendingCanvasAuth {
  service: 'canvas';
  canvasApiUrl: string;
  canvasAuthMode: 'browser' | 'token';
  canvasStorageStatePath?: string;
  canvasApiToken?: string;
  timestamp: string;
  userId?: number;
  userName?: string;
}

type PendingAuth = PendingCanvasAuth;

let watcher: NodeFSWatcher | null = null;
let pendingAuthDir: string | null = null;
const queuedFiles = new Set<string>();

/**
 * Process a pending auth file
 */
async function processPendingAuthFile(filePath: string): Promise<void> {
  console.log(`[PendingAuth] Processing: ${filePath}`);

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const pending: PendingAuth = JSON.parse(content);

    if (pending.service === 'canvas') {
      await processCanvasAuth(pending);
    } else {
      console.warn(`[PendingAuth] Unknown service: ${(pending as any).service}`);
    }

    // Delete the processed file
    await fs.unlink(filePath);
    console.log(`[PendingAuth] Processed and removed: ${filePath}`);
  } catch (error) {
    console.error(`[PendingAuth] Failed to process ${filePath}:`, error);
    // Move to failed directory instead of deleting
    try {
      const failedDir = path.join(path.dirname(filePath), 'failed');
      await fs.mkdir(failedDir, { recursive: true });
      const failedPath = path.join(failedDir, path.basename(filePath));
      await fs.rename(filePath, failedPath);
    } catch {
      // If we can't move it, just leave it
    }
  }
}

/**
 * Process Canvas browser auth
 */
async function processCanvasAuth(pending: PendingCanvasAuth): Promise<void> {
  console.log(`[PendingAuth] Storing Canvas auth (mode: ${pending.canvasAuthMode})`);

  const additionalData: Record<string, string> = {
    canvasApiUrl: pending.canvasApiUrl,
    canvasAuthMode: pending.canvasAuthMode,
  };

  if (pending.canvasAuthMode === 'browser' && pending.canvasStorageStatePath) {
    additionalData.canvasStorageStatePath = pending.canvasStorageStatePath;
  }

  // Store the auth token
  // For browser auth, accessToken is empty but we store the mode/path in additionalData
  await authManager.storeApiToken(
    'canvas',
    pending.canvasAuthMode === 'token' ? (pending.canvasApiToken || '') : '',
    additionalData
  );

  console.log('[PendingAuth] Canvas auth stored, reloading MCPs...');

  // Reload MCP config to start Canvas MCP with new credentials
  await processManager.reloadMcpConfig();

  console.log('[PendingAuth] MCPs reloaded');
}

/**
 * Start watching for pending auth files
 */
export async function startPendingAuthWatcher(dataDir: string): Promise<void> {
  if (watcher) {
    console.log('[PendingAuth] Watcher already running');
    return;
  }

  pendingAuthDir = path.join(dataDir, 'pending-auth');

  // Ensure directory exists
  await fs.mkdir(pendingAuthDir, { recursive: true });

  console.log(`[PendingAuth] Starting watcher on: ${pendingAuthDir}`);

  // Process any existing files first
  try {
    const existingFiles = await fs.readdir(pendingAuthDir);
    for (const file of existingFiles) {
      if (file.endsWith('.json') && !file.startsWith('.')) {
        await processPendingAuthFile(path.join(pendingAuthDir, file));
      }
    }
  } catch (error) {
    console.error('[PendingAuth] Error processing existing files:', error);
  }

  // Start watching for new/changed files
  watcher = watchFs(pendingAuthDir, { persistent: true }, (_eventType, filename) => {
    if (!filename) {
      return;
    }

    const fileName = filename.toString();
    if (!fileName.endsWith('.json') || fileName.startsWith('.')) {
      return;
    }

    const fullPath = path.join(pendingAuthDir!, fileName);
    if (queuedFiles.has(fullPath)) {
      return;
    }

    queuedFiles.add(fullPath);
    setTimeout(async () => {
      try {
        await processPendingAuthFile(fullPath);
      } catch (error) {
        console.error('[PendingAuth] Watcher processing error:', error);
      } finally {
        queuedFiles.delete(fullPath);
      }
    }, 150);
  });

  watcher.on('error', (error) => {
    console.error('[PendingAuth] Watcher error:', error);
  });

  console.log('[PendingAuth] Watcher started');
}

/**
 * Stop the pending auth watcher
 */
export async function stopPendingAuthWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    console.log('[PendingAuth] Watcher stopped');
  }
}
