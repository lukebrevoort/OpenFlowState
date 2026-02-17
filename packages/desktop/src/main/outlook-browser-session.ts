import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'node:module';

const DEFAULT_OUTLOOK_MAILBOX_URL = 'https://outlook.office.com/mail/';

export type OutlookInboxMessage = {
  subject: string;
  sender?: string;
  preview?: string;
  receivedAt?: string;
};

type BrowserRuntime = {
  chromium: {
    launch: (options: { headless: boolean }) => Promise<any>;
  };
};

const normalizeMailboxUrl = (input?: string): string => {
  const raw = (input ?? DEFAULT_OUTLOOK_MAILBOX_URL).trim();
  if (!raw) return DEFAULT_OUTLOOK_MAILBOX_URL;
  return raw.endsWith('/') ? raw : `${raw}/`;
};

const loadBrowserRuntime = (): BrowserRuntime => {
  const require = createRequire(import.meta.url);
  try {
    const playwright = require('playwright');
    const chromium = playwright?.chromium;
    if (!chromium) {
      throw new Error('Playwright chromium runtime is unavailable.');
    }
    return { chromium } as BrowserRuntime;
  } catch {
    throw new Error(
      "Playwright is required for Outlook browser session mode but isn't installed. Install it (e.g. `pnpm add -w playwright`) and re-run."
    );
  }
};

const isLikelyLoginUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return (
    lower.includes('login.live.com') ||
    lower.includes('login.microsoftonline.com') ||
    lower.includes('/common/oauth2')
  );
};

async function parseInboxWithOwaApi(context: any, maxItems: number): Promise<OutlookInboxMessage[]> {
  const endpoint =
    `https://outlook.office.com/api/v2.0/me/messages` +
    `?$top=${Math.max(1, Math.min(maxItems, 50))}` +
    '&$select=Subject,From,ReceivedDateTime,BodyPreview';

  const response = await context.request.get(endpoint, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok()) {
    return [];
  }

  const payload = await response.json().catch(() => null);
  const values = (payload as { value?: unknown[] } | null)?.value;
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => {
      const record = item as {
        Subject?: unknown;
        BodyPreview?: unknown;
        ReceivedDateTime?: unknown;
        From?: { EmailAddress?: { Name?: unknown; Address?: unknown } };
      };
      const senderName = record.From?.EmailAddress?.Name;
      const senderAddress = record.From?.EmailAddress?.Address;
      const sender =
        typeof senderName === 'string' && senderName.length > 0
          ? senderName
          : typeof senderAddress === 'string' && senderAddress.length > 0
            ? senderAddress
            : undefined;

      return {
        subject:
          typeof record.Subject === 'string' && record.Subject.trim().length > 0
            ? record.Subject.trim()
            : '(No subject)',
        sender,
        preview:
          typeof record.BodyPreview === 'string' && record.BodyPreview.trim().length > 0
            ? record.BodyPreview.trim()
            : undefined,
        receivedAt:
          typeof record.ReceivedDateTime === 'string' && record.ReceivedDateTime.length > 0
            ? record.ReceivedDateTime
            : undefined,
      } satisfies OutlookInboxMessage;
    })
    .filter((item) => item.subject.length > 0);
}

async function parseInboxFromDom(page: any, maxItems: number): Promise<OutlookInboxMessage[]> {
  return page.evaluate((limit: number) => {
    const rows = Array.from(
      document.querySelectorAll('[role="row"], [role="option"], [data-convid], [data-message-id]')
    ).slice(0, Math.max(1, Math.min(limit, 50)));

    const items = rows
      .map((row) => {
        const text = (row.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!text) return null;

        const subjectNode =
          row.querySelector('[data-testid="message-subject"]') ||
          row.querySelector('[title]') ||
          row.querySelector('span');
        const subject = (subjectNode?.textContent ?? '').replace(/\s+/g, ' ').trim() || text;

        return {
          subject,
          preview: text,
        };
      })
      .filter((item): item is { subject: string; preview: string } => Boolean(item));

    return items;
  }, maxItems);
}

export async function runOutlookBrowserLogin(options: {
  mailboxUrl?: string;
  storageStatePath: string;
  confirmationFilePath?: string;
  timeoutMs?: number;
}): Promise<{ storageStatePath: string; mailboxUrl: string }> {
  const mailboxUrl = normalizeMailboxUrl(options.mailboxUrl);
  const storageStatePath = options.storageStatePath;
  const timeoutMs = options.timeoutMs ?? 300000;
  const confirmationFilePath = options.confirmationFilePath;
  const { chromium } = loadBrowserRuntime();

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(mailboxUrl, { waitUntil: 'domcontentloaded' });

    if (confirmationFilePath) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        try {
          await fs.stat(confirmationFilePath);
          break;
        } catch {
          // keep waiting
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (Date.now() - started >= timeoutMs) {
        throw new Error(`Timed out waiting for user confirmation file: ${confirmationFilePath}`);
      }
    }

    await page.waitForLoadState('domcontentloaded');
    const currentUrl = page.url();
    if (isLikelyLoginUrl(currentUrl)) {
      throw new Error('Login appears incomplete. Please finish sign-in, then try again.');
    }

    await context.storageState({ path: storageStatePath });
    return { storageStatePath, mailboxUrl };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function checkOutlookBrowserSession(options: {
  storageStatePath: string;
  mailboxUrl?: string;
}): Promise<{ ok: boolean; message?: string; email?: string }> {
  const storageStatePath = options.storageStatePath;
  const mailboxUrl = normalizeMailboxUrl(options.mailboxUrl);

  try {
    await fs.access(storageStatePath);
  } catch {
    return {
      ok: false,
      message: 'Outlook browser session file is missing. Run browser login again.',
    };
  }

  try {
    const raw = await fs.readFile(storageStatePath, 'utf8');
    JSON.parse(raw);
  } catch {
    return {
      ok: false,
      message: 'Outlook browser session file is invalid. Run browser login again.',
    };
  }

  const { chromium } = loadBrowserRuntime();
  let browser: any | null = null;
  let context: any | null = null;
  let page: any | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: storageStatePath });
    page = await context.newPage();
    await page.goto(mailboxUrl, { waitUntil: 'domcontentloaded' });

    const currentUrl = page.url();
    if (isLikelyLoginUrl(currentUrl)) {
      return {
        ok: false,
        message: 'Outlook browser session expired. Reconnect with browser login.',
      };
    }

    const title = await page.title().catch(() => '');
    if (!title.toLowerCase().includes('outlook') && !currentUrl.toLowerCase().includes('outlook')) {
      return {
        ok: false,
        message: 'Could not verify Outlook mailbox session. Reconnect and try again.',
      };
    }

    return {
      ok: true,
      message: 'Outlook browser session is connected.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? `Outlook browser session check failed: ${error.message}` : 'Outlook browser session check failed.',
    };
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

export async function readOutlookInboxWithBrowserSession(options: {
  storageStatePath: string;
  mailboxUrl?: string;
  maxItems?: number;
}): Promise<{ ok: boolean; message?: string; messages: OutlookInboxMessage[] }> {
  const storageStatePath = options.storageStatePath;
  const mailboxUrl = normalizeMailboxUrl(options.mailboxUrl);
  const maxItems = options.maxItems ?? 10;

  try {
    await fs.access(storageStatePath);
  } catch {
    return {
      ok: false,
      message: 'Outlook browser session file is missing. Run browser login again.',
      messages: [],
    };
  }

  const { chromium } = loadBrowserRuntime();
  let browser: any | null = null;
  let context: any | null = null;
  let page: any | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: storageStatePath });
    page = await context.newPage();
    await page.goto(mailboxUrl, { waitUntil: 'domcontentloaded' });

    const currentUrl = page.url();
    if (isLikelyLoginUrl(currentUrl)) {
      return {
        ok: false,
        message: 'Outlook browser session expired. Reconnect with browser login.',
        messages: [],
      };
    }

    let messages = await parseInboxWithOwaApi(context, maxItems);
    if (messages.length === 0) {
      messages = await parseInboxFromDom(page, maxItems);
    }

    if (messages.length === 0) {
      return {
        ok: false,
        message: 'Connected, but no inbox messages were detected from Outlook Web.',
        messages: [],
      };
    }

    return {
      ok: true,
      messages,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? `Failed to read Outlook inbox: ${error.message}` : 'Failed to read Outlook inbox.',
      messages: [],
    };
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
