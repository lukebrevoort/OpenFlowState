import fs from 'fs/promises';
import path from 'path';
import { loadChromiumRuntime } from './playwright-runtime.js';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/, '');

export async function runCanvasBrowserLogin(options: {
  canvasApiUrl: string;
  storageStatePath: string;
  confirmationFilePath?: string;
  timeoutMs?: number;
}): Promise<{ storageStatePath: string; userId?: number; userName?: string }> {
  const baseUrl = normalizeBaseUrl(options.canvasApiUrl);
  const storageStatePath = options.storageStatePath;
  const timeoutMs = options.timeoutMs ?? 300000;
  const confirmationFilePath = options.confirmationFilePath;

  const chromium = loadChromiumRuntime('Canvas browser login');

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    console.error(
      `[canvas-login] Browser login opened. Complete login in the browser window. Waiting up to ${Math.ceil(
        timeoutMs / 1000
      )}s...`
    );

    if (confirmationFilePath) {
      console.error(`[canvas-login] Waiting for confirmation file: ${confirmationFilePath}`);
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        try {
          await fs.stat(confirmationFilePath);
          break;
        } catch {
          // keep waiting
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (Date.now() - started >= timeoutMs) {
        throw new Error(`Timed out waiting for user confirmation file: ${confirmationFilePath}`);
      }
    }

    const started = Date.now();
    let lastStatus: number | undefined;
    const verificationTimeoutMs = 30000;

    while (Date.now() - started < verificationTimeoutMs) {
      try {
        const response = await context.request.get(`${baseUrl}/api/v1/users/self/profile`, {
          headers: { Accept: 'application/json' },
        });
        lastStatus = response.status();
        if (response.ok()) {
          const user = await response.json();
          await context.storageState({ path: storageStatePath });
          return {
            storageStatePath,
            userId: typeof user?.id === 'number' ? user.id : undefined,
            userName: typeof user?.name === 'string' ? user.name : undefined,
          };
        }
      } catch {
        // ignore transient errors while user is logging in
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    throw new Error(
      `Timed out verifying Canvas login. Last status: ${lastStatus ?? 'unknown'}. ` +
        'Try again, or ensure you are fully logged in to the Canvas dashboard.'
    );
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
