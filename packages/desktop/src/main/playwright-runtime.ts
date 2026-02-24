import fs from 'node:fs';
import { createRequire } from 'node:module';

type ChromiumRuntime = {
  launch: (options: { headless: boolean }) => Promise<any>;
  executablePath?: () => string;
};

const ensureChromiumExecutable = (chromium: ChromiumRuntime, feature: string): void => {
  const executablePath = chromium.executablePath?.();
  if (!executablePath) {
    return;
  }

  try {
    fs.accessSync(executablePath, fs.constants.X_OK);
  } catch {
    throw new Error(
      `${feature} requires Playwright Chromium binaries, but they are not installed. Run \`npx playwright install chromium\` and retry.`
    );
  }
};

export const loadChromiumRuntime = (feature: string): ChromiumRuntime => {
  const require = createRequire(import.meta.url);

  let playwright: unknown;
  try {
    playwright = require('playwright');
  } catch {
    throw new Error(
      `${feature} requires Playwright, but it is unavailable in this build. Reinstall the latest FlowState DMG or install Playwright manually.`
    );
  }

  const chromium = (playwright as { chromium?: ChromiumRuntime } | null)?.chromium;
  if (!chromium || typeof chromium.launch !== 'function') {
    throw new Error(`${feature} could not load Playwright Chromium runtime.`);
  }

  ensureChromiumExecutable(chromium, feature);
  return chromium;
};
