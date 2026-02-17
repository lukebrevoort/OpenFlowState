import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  checkOutlookBrowserSession,
  composeOutlookMessageWithBrowserSession,
  readOutlookMessageBodyWithBrowserSession,
  readOutlookInboxWithBrowserSession,
} from './outlook-browser-session.js';

type ToolTextResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const toolResult = (text: string, isError = false): ToolTextResult => ({
  content: [{ type: 'text', text }],
  ...(isError ? { isError: true } : {}),
});

const toSafeNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(1, Math.min(Math.trunc(value), 50));
};

const toSafeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value !== 'boolean') return fallback;
  return value;
};

const toSafeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toSafeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
};

function envFlagEnabled(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

const getConfiguredSession = (): { storageStatePath: string; mailboxUrl?: string } | null => {
  const storageStatePath = process.env.OUTLOOK_STORAGE_STATE_PATH?.trim();
  if (!storageStatePath) return null;

  const mailboxUrlRaw = process.env.OUTLOOK_MAILBOX_URL?.trim();
  return {
    storageStatePath,
    ...(mailboxUrlRaw ? { mailboxUrl: mailboxUrlRaw } : {}),
  };
};

const isWriteEnabled = envFlagEnabled('OUTLOOK_BROWSER_WRITE_ENABLED', false);

const OUTLOOK_BROWSER_TOOLS = [
  {
    name: 'outlook_browser_session_check',
    description:
      'Check whether Outlook browser-session auth is still valid for FlowState read-only inbox access.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'outlook_browser_list_inbox',
    description:
      'Read inbox messages from Outlook Web using the saved browser session (read-only).',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        maxItems: {
          type: 'number',
          description: 'Max number of messages to return (1-50, default 10).',
        },
      },
    },
  },
  {
    name: 'outlook_browser_get_message_body',
    description:
      'Read full body content for a selected Outlook inbox message using browser-session auth.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        messageIndex: {
          type: 'number',
          description: '1-based inbox row index from outlook_browser_list_inbox output (default: 1).',
        },
        subjectContains: {
          type: 'string',
          description: 'Optional subject text match (overrides messageIndex when provided).',
        },
        includeHtml: {
          type: 'boolean',
          description: 'Include HTML body (may be large).',
        },
      },
    },
  },
  {
    name: 'outlook_browser_compose_message',
    description: isWriteEnabled
      ? 'Compose a draft or send an Outlook message using browser-session auth. Requires user-enabled write mode in Integrations.'
      : 'Compose/send is currently disabled. Enable Outlook browser write mode in Integrations first.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipient email addresses.',
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional CC addresses.',
        },
        bcc: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional BCC addresses.',
        },
        subject: {
          type: 'string',
          description: 'Email subject line.',
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text).',
        },
        sendNow: {
          type: 'boolean',
          description: 'When true, trigger send. Otherwise compose draft-only.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
];

const server = new Server(
  {
    name: '@flowstate/mcp-outlook-browser',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: OUTLOOK_BROWSER_TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  const configured = getConfiguredSession();

  if (!configured) {
    return toolResult(
      'Outlook browser MCP is not configured. Set OUTLOOK_STORAGE_STATE_PATH and reconnect Outlook browser session.',
      true
    );
  }

  if (name === 'outlook_browser_session_check') {
    const result = await checkOutlookBrowserSession(configured);
    if (!result.ok) {
      return toolResult(result.message ?? 'Outlook browser session is not valid.', true);
    }

    return toolResult(
      JSON.stringify(
        {
          ok: true,
          message: result.message ?? 'Outlook browser session is connected.',
          email: result.email,
        },
        null,
        2
      )
    );
  }

  if (name === 'outlook_browser_list_inbox') {
    const maxItems = toSafeNumber(args.maxItems, 10);
    const result = await readOutlookInboxWithBrowserSession({
      ...configured,
      maxItems,
    });

    if (!result.ok) {
      return toolResult(result.message ?? 'Failed to read Outlook inbox.', true);
    }

    return toolResult(
      JSON.stringify(
        {
          ok: true,
          count: result.messages.length,
          message: result.message,
          messages: result.messages.map((item, index) => ({
            index: index + 1,
            ...item,
          })),
        },
        null,
        2
      )
    );
  }

  if (name === 'outlook_browser_get_message_body') {
    const result = await readOutlookMessageBodyWithBrowserSession({
      ...configured,
      messageIndex: toSafeNumber(args.messageIndex, 1),
      subjectContains: toSafeString(args.subjectContains) || undefined,
      includeHtml: toSafeBoolean(args.includeHtml, false),
    });

    if (!result.ok || !result.messageData) {
      return toolResult(result.message ?? 'Failed to read Outlook message body.', true);
    }

    return toolResult(
      JSON.stringify(
        {
          ok: true,
          message: result.message,
          messageData: result.messageData,
        },
        null,
        2
      )
    );
  }

  if (name === 'outlook_browser_compose_message') {
    if (!isWriteEnabled) {
      return toolResult(
        'Outlook browser write actions are disabled. Enable write/draft mode in Integrations before using compose tools.',
        true
      );
    }

    const result = await composeOutlookMessageWithBrowserSession({
      ...configured,
      to: toSafeStringArray(args.to),
      cc: toSafeStringArray(args.cc),
      bcc: toSafeStringArray(args.bcc),
      subject: toSafeString(args.subject),
      body: toSafeString(args.body),
      sendNow: toSafeBoolean(args.sendNow, false),
    });

    if (!result.ok) {
      return toolResult(result.message ?? 'Failed to compose Outlook message.', true);
    }

    return toolResult(
      JSON.stringify(
        {
          ok: true,
          draftOnly: result.draftOnly,
          message: result.message,
        },
        null,
        2
      )
    );
  }

  return toolResult(`Unknown tool: ${name}`, true);
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp-outlook-browser] Server started');
}

main().catch((error) => {
  console.error('[mcp-outlook-browser] Fatal error:', error);
});
