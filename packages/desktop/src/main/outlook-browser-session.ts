import fs from 'fs/promises';
import path from 'path';
import { loadChromiumRuntime } from './playwright-runtime.js';

const DEFAULT_OUTLOOK_MAILBOX_URL = 'https://outlook.office.com/mail/';

export type OutlookInboxMessage = {
  subject: string;
  sender?: string;
  preview?: string;
  receivedAt?: string;
};

export type OutlookMessageBody = {
  subject?: string;
  sender?: string;
  receivedAt?: string;
  bodyText: string;
  bodyHtml?: string;
};

export type OutlookComposeResult = {
  ok: boolean;
  message?: string;
  draftOnly: boolean;
};

const normalizeMailboxUrl = (input?: string): string => {
  const raw = (input ?? DEFAULT_OUTLOOK_MAILBOX_URL).trim();
  if (!raw) return DEFAULT_OUTLOOK_MAILBOX_URL;
  return raw.endsWith('/') ? raw : `${raw}/`;
};

const deriveMailboxUrlFromCurrentPage = (currentUrl: string, fallback: string): string => {
  try {
    const parsed = new URL(currentUrl);
    return `${parsed.origin}/mail/`;
  } catch {
    return fallback;
  }
};

const mailboxOriginsForApi = (mailboxUrl: string): string[] => {
  const origins: string[] = [];

  try {
    origins.push(new URL(mailboxUrl).origin);
  } catch {
    // ignore malformed URL and use defaults below
  }

  for (const fallbackOrigin of ['https://outlook.office.com', 'https://outlook.cloud.microsoft']) {
    if (!origins.includes(fallbackOrigin)) {
      origins.push(fallbackOrigin);
    }
  }

  return origins;
};

const OUTLOOK_ROW_SELECTORS = [
  '[aria-label*="Message list" i] [role="option"]',
  '[aria-label*="Message list" i] [data-convid]',
  '[role="main"] [role="option"]',
  '[role="main"] [data-convid]',
  '[role="main"] [data-message-id]',
  '[role="main"] [role="row"]',
] as const;

const OUTLOOK_READING_PANE_SELECTORS = [
  '[aria-label*="Reading pane" i]',
  '[data-app-section*="read" i]',
  '[role="main"]',
] as const;

const OUTLOOK_MESSAGE_BODY_SELECTORS = [
  '[role="document"][aria-label*="Message body" i]',
  '[aria-label*="Message body" i][role="document"]',
  '[role="document"]',
] as const;

const MAX_BODY_HTML_LENGTH = 200_000;

const isLikelyLoginUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return (
    lower.includes('login.live.com') ||
    lower.includes('login.microsoftonline.com') ||
    lower.includes('/common/oauth2')
  );
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

async function waitForMailboxReady(page: any): Promise<void> {
  const selectors = ['[aria-label*="Message list" i]', ...OUTLOOK_ROW_SELECTORS];

  await page.waitForLoadState('domcontentloaded');

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 4000 });
      return;
    } catch {
      // try next selector
    }
  }

  await sleep(1500);
}

async function resolveInboxRowSelector(page: any): Promise<string | null> {
  for (const selector of OUTLOOK_ROW_SELECTORS) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) {
        return selector;
      }
    } catch {
      // try next selector
    }
  }
  return null;
}

async function pickInboxRowIndex(page: any, selector: string, options: {
  messageIndex?: number;
  subjectContains?: string;
}): Promise<number> {
  const count = await page.locator(selector).count();
  if (count <= 0) {
    throw new Error('Outlook message rows were not detected.');
  }

  const wantedSubject = options.subjectContains?.trim().toLowerCase();
  if (wantedSubject) {
    const maxScan = Math.min(count, 50);
    for (let i = 0; i < maxScan; i += 1) {
      const row = page.locator(selector).nth(i);
      const ariaLabel = (await row.getAttribute('aria-label').catch(() => null)) ?? '';
      const rowText = await row.innerText().catch(() => '');
      const haystack = `${ariaLabel} ${rowText}`.toLowerCase();
      if (haystack.includes(wantedSubject)) {
        return i;
      }
    }

    throw new Error(`No Outlook message matched: "${options.subjectContains}"`);
  }

  const requestedIndex = options.messageIndex ?? 1;
  const normalized = Number.isFinite(requestedIndex)
    ? Math.max(1, Math.trunc(requestedIndex))
    : 1;
  return Math.min(normalized - 1, count - 1);
}

async function extractSelectedMessageBody(page: any, includeHtml: boolean): Promise<OutlookMessageBody | null> {
  const selectedPaneSelector = OUTLOOK_READING_PANE_SELECTORS.join(', ');
  try {
    await page.waitForSelector(selectedPaneSelector, { timeout: 10000 });
  } catch {
    // continue and attempt extraction anyway
  }

  const bodySelectors = OUTLOOK_MESSAGE_BODY_SELECTORS;
  const paneSelectors = OUTLOOK_READING_PANE_SELECTORS;

  return page.evaluate(
    (payload: {
      includeHtmlValue: boolean;
      bodySelectorList: string[];
      paneSelectorList: string[];
      maxHtmlLength: number;
    }) => {
      const { includeHtmlValue, bodySelectorList, paneSelectorList, maxHtmlLength } = payload;
      const normalize = (value: string | null | undefined): string =>
        (value ?? '').replace(/\s+/g, ' ').trim();

      const pickFirst = (selectors: readonly string[]): Element | null => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) return element;
        }
        return null;
      };

      const readingPane = pickFirst(paneSelectorList) ?? document.body;
      const messageBody = pickFirst(bodySelectorList) ?? readingPane;

      const subjectNode =
        readingPane.querySelector('h1') ||
        readingPane.querySelector('[role="heading"]') ||
        readingPane.querySelector('[data-testid*="subject" i]') ||
        messageBody?.querySelector('[data-testid*="subject" i]');

      const senderNode =
        readingPane.querySelector('[aria-label^="From" i] [title]') ||
        readingPane.querySelector('[data-testid*="sender" i]') ||
        readingPane.querySelector('[data-testid*="from" i]') ||
        readingPane.querySelector('[title*="@"]');

      const receivedNode =
        readingPane.querySelector('time') ||
        readingPane.querySelector('[data-testid*="received" i]') ||
        readingPane.querySelector('[aria-label*="sent" i]');

      const bodyText = normalize(messageBody?.textContent ?? '');
      if (!bodyText) {
        return null;
      }

      const htmlRaw = includeHtmlValue ? messageBody?.innerHTML ?? '' : '';

      return {
        subject: normalize(subjectNode?.textContent),
        sender: normalize(senderNode?.textContent),
        receivedAt: normalize(receivedNode?.textContent),
        bodyText,
        bodyHtml:
          includeHtmlValue && htmlRaw.length > 0
            ? htmlRaw.slice(0, maxHtmlLength)
            : undefined,
      };
    },
    {
      includeHtmlValue: includeHtml,
      bodySelectorList: bodySelectors,
      paneSelectorList: paneSelectors,
      maxHtmlLength: MAX_BODY_HTML_LENGTH,
    }
  );
}

async function parseInboxWithOwaApi(
  context: any,
  maxItems: number,
  mailboxUrl: string
): Promise<OutlookInboxMessage[]> {
  const top = Math.max(1, Math.min(maxItems, 50));
  const endpoints: string[] = [];
  for (const origin of mailboxOriginsForApi(mailboxUrl)) {
    endpoints.push(
      `${origin}/api/v2.0/me/messages?$top=${top}&$select=Subject,From,ReceivedDateTime,BodyPreview`
    );
    endpoints.push(
      `${origin}/mail/api/v2.0/me/messages?$top=${top}&$select=Subject,From,ReceivedDateTime,BodyPreview`
    );
    endpoints.push(
      `${origin}/mail/0/api/v2.0/me/messages?$top=${top}&$select=Subject,From,ReceivedDateTime,BodyPreview`
    );
  }

  let values: unknown[] = [];
  for (const endpoint of endpoints) {
    const response = await context.request.get(endpoint, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok()) {
      continue;
    }

    const payload = await response.json().catch(() => null);
    const candidateValues = (payload as { value?: unknown[] } | null)?.value;
    if (Array.isArray(candidateValues) && candidateValues.length > 0) {
      values = candidateValues;
      break;
    }
  }

  if (values.length === 0) {
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

async function parseInboxFromDomFrame(frame: any, maxItems: number): Promise<OutlookInboxMessage[]> {
  return frame.evaluate((limit: number) => {
    const selectors = [
      '[aria-label*="Message list" i] [role="option"]',
      '[aria-label*="Message list" i] [role="row"]',
      '[role="main"] [data-convid]',
      '[role="main"] [data-message-id]',
      '[role="main"] [role="option"]',
      '[role="main"] [role="row"]',
    ];

    const collected: Element[] = [];
    for (const selector of selectors) {
      const found = Array.from(document.querySelectorAll(selector));
      for (const item of found) {
        if (!collected.includes(item)) {
          collected.push(item);
        }
      }
    }

    const toSubject = (el: Element): string => {
      const aria = (el.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
      if (aria.length > 0) {
        return aria.split(',')[0]?.trim() || aria;
      }

      const subjectNode =
        el.querySelector('[data-testid*="subject" i]') ||
        el.querySelector('[title][role="heading"]') ||
        el.querySelector('[title]') ||
        el.querySelector('span');

      const subject = (subjectNode?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return subject;
    };

    const toSender = (el: Element): string | undefined => {
      const senderNode =
        el.querySelector('[data-testid*="sender" i]') ||
        el.querySelector('[data-testid*="from" i]') ||
        el.querySelector('[title*="@"]');
      const sender = (senderNode?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return sender.length > 0 ? sender : undefined;
    };

    const normalizedLimit = Math.max(1, Math.min(limit, 50));
    const out: Array<{ subject: string; sender?: string; preview?: string }> = [];
    const seen = new Set<string>();

    for (const row of collected) {
      const text = (row.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;

      const subject = toSubject(row) || text;
      if (!subject || subject.length < 2) continue;

      if (/^(inbox|focused|other|search|settings)$/i.test(subject)) {
        continue;
      }

      const sender = toSender(row);
      const key = `${subject}::${sender ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        subject,
        sender,
        preview: text,
      });

      if (out.length >= normalizedLimit) {
        break;
      }
    }

    return out;
  }, maxItems);
}

async function parseInboxFromDom(page: any, maxItems: number): Promise<OutlookInboxMessage[]> {
  const frameCandidates = [page.mainFrame(), ...page.frames()];
  for (const frame of frameCandidates) {
    try {
      const items = await parseInboxFromDomFrame(frame, maxItems);
      if (items.length > 0) {
        return items;
      }
    } catch {
      // try next frame
    }
  }

  return [];
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
  const chromium = loadChromiumRuntime('Outlook browser session');

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

    await waitForMailboxReady(page);

    const resolvedMailboxUrl = deriveMailboxUrlFromCurrentPage(currentUrl, mailboxUrl);

    await context.storageState({ path: storageStatePath });
    return { storageStatePath, mailboxUrl: resolvedMailboxUrl };
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

  const chromium = loadChromiumRuntime('Outlook browser session');
  let browser: any | null = null;
  let context: any | null = null;
  let page: any | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: storageStatePath });
    page = await context.newPage();
    await page.goto(mailboxUrl, { waitUntil: 'domcontentloaded' });
    await waitForMailboxReady(page);
    await waitForMailboxReady(page);

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

  const chromium = loadChromiumRuntime('Outlook browser session');
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

    let messages = await parseInboxWithOwaApi(context, maxItems, page.url());
    if (messages.length === 0) {
      messages = await parseInboxFromDom(page, maxItems);
    }

    if (messages.length === 0) {
      await sleep(1200);
      messages = await parseInboxFromDom(page, maxItems);
    }

    if (messages.length === 0) {
      return {
        ok: true,
        message:
          'Outlook session is connected, but message rows were not detected yet. Open your inbox in Outlook Web, then reconnect browser session.',
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

export async function readOutlookMessageBodyWithBrowserSession(options: {
  storageStatePath: string;
  mailboxUrl?: string;
  messageIndex?: number;
  subjectContains?: string;
  includeHtml?: boolean;
}): Promise<{ ok: boolean; message?: string; messageData?: OutlookMessageBody }> {
  const storageStatePath = options.storageStatePath;
  const mailboxUrl = normalizeMailboxUrl(options.mailboxUrl);
  const includeHtml = options.includeHtml === true;

  try {
    await fs.access(storageStatePath);
  } catch {
    return {
      ok: false,
      message: 'Outlook browser session file is missing. Run browser login again.',
    };
  }

  const chromium = loadChromiumRuntime('Outlook browser session');
  let browser: any | null = null;
  let context: any | null = null;
  let page: any | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: storageStatePath });
    page = await context.newPage();
    await page.goto(mailboxUrl, { waitUntil: 'domcontentloaded' });
    await waitForMailboxReady(page);

    const currentUrl = page.url();
    if (isLikelyLoginUrl(currentUrl)) {
      return {
        ok: false,
        message: 'Outlook browser session expired. Reconnect with browser login.',
      };
    }

    const rowSelector = await resolveInboxRowSelector(page);
    if (!rowSelector) {
      return {
        ok: false,
        message: 'Outlook inbox rows were not detected. Open inbox and reconnect browser session.',
      };
    }

    const targetIndex = await pickInboxRowIndex(page, rowSelector, {
      messageIndex: options.messageIndex,
      subjectContains: options.subjectContains,
    });

    const targetRow = page.locator(rowSelector).nth(targetIndex);
    const targetRowSummary =
      ((await targetRow.getAttribute('aria-label').catch(() => null)) ?? '').trim() ||
      (await targetRow.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

    await targetRow.scrollIntoViewIfNeeded().catch(() => undefined);
    await targetRow.click({ timeout: 15000, force: true });
    await sleep(700);

    const selectedAfterClick = await targetRow.getAttribute('aria-selected').catch(() => null);
    if (selectedAfterClick !== 'true') {
      await targetRow.dblclick({ timeout: 15000, force: true }).catch(() => undefined);
      await sleep(900);
    }

    let messageData: OutlookMessageBody | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      messageData = await extractSelectedMessageBody(page, includeHtml);
      if (messageData && messageData.bodyText.length > 0) {
        break;
      }
      await sleep(700);
    }

    if (!messageData) {
      return {
        ok: false,
        message:
          'Message was selected, but body content could not be extracted. Try again or reconnect browser session.',
      };
    }

    if (!messageData.subject && targetRowSummary.length > 0) {
      messageData.subject = targetRowSummary.split(',')[0]?.trim() || targetRowSummary;
    }

    return {
      ok: true,
      messageData,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Failed to read Outlook message body: ${error.message}`
          : 'Failed to read Outlook message body.',
    };
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

const normalizeAddressList = (addresses: string[]): string[] =>
  addresses.map((value) => value.trim()).filter((value) => value.length > 0);

const buildComposeUrl = (mailboxUrl: string, payload: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}): string => {
  let origin = 'https://outlook.office.com';
  try {
    origin = new URL(mailboxUrl).origin;
  } catch {
    // keep default origin
  }

  const params = new URLSearchParams();
  const to = normalizeAddressList(payload.to);
  const cc = normalizeAddressList(payload.cc ?? []);
  const bcc = normalizeAddressList(payload.bcc ?? []);

  if (to.length > 0) {
    params.set('to', to.join(';'));
  }
  if (cc.length > 0) {
    params.set('cc', cc.join(';'));
  }
  if (bcc.length > 0) {
    params.set('bcc', bcc.join(';'));
  }
  if (payload.subject.trim().length > 0) {
    params.set('subject', payload.subject.trim());
  }
  if (payload.body.length > 0) {
    params.set('body', payload.body);
  }

  return `${origin}/mail/deeplink/compose?${params.toString()}`;
};

export async function composeOutlookMessageWithBrowserSession(options: {
  storageStatePath: string;
  mailboxUrl?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  sendNow?: boolean;
}): Promise<OutlookComposeResult> {
  const storageStatePath = options.storageStatePath;
  const mailboxUrl = normalizeMailboxUrl(options.mailboxUrl);
  const sendNow = options.sendNow === true;

  try {
    await fs.access(storageStatePath);
  } catch {
    return {
      ok: false,
      draftOnly: !sendNow,
      message: 'Outlook browser session file is missing. Run browser login again.',
    };
  }

  const to = normalizeAddressList(options.to ?? []);
  if (to.length === 0) {
    return {
      ok: false,
      draftOnly: !sendNow,
      message: 'At least one recipient is required.',
    };
  }

  const chromium = loadChromiumRuntime('Outlook browser session');
  let browser: any | null = null;
  let context: any | null = null;
  let page: any | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: storageStatePath });
    page = await context.newPage();

    const composeUrl = buildComposeUrl(mailboxUrl, {
      to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      body: options.body,
    });

    await page.goto(composeUrl, { waitUntil: 'domcontentloaded' });

    if (isLikelyLoginUrl(page.url())) {
      return {
        ok: false,
        draftOnly: !sendNow,
        message: 'Outlook browser session expired. Reconnect with browser login.',
      };
    }

    await page.waitForSelector(
      'input[aria-label="Subject"], input[placeholder*="subject" i], [aria-label="Send"], #splitButton-r6a__primaryActionButton',
      { timeout: 20000 }
    );

    if (!sendNow) {
      await sleep(2000);
      return {
        ok: true,
        draftOnly: true,
        message:
          'Outlook compose draft opened with prefilled content. Outlook Web autosave should persist this draft shortly.',
      };
    }

    const sendButton = page.locator(
      '#splitButton-r6a__primaryActionButton, button[aria-label="Send"], button[aria-label*="Send" i]'
    ).first();

    const sendCount = await sendButton.count();
    if (sendCount === 0) {
      return {
        ok: false,
        draftOnly: false,
        message: 'Send button was not found in Outlook compose window.',
      };
    }

    await sendButton.click({ timeout: 15000, force: true });
    await sleep(1500);

    return {
      ok: true,
      draftOnly: false,
      message: 'Outlook send action was triggered successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      draftOnly: !sendNow,
      message:
        error instanceof Error
          ? `Failed to compose Outlook message: ${error.message}`
          : 'Failed to compose Outlook message.',
    };
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
