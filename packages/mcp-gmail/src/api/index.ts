/**
 * Gmail API Wrapper
 * 
 * Wraps googleapis Gmail client with FlowState-specific functionality.
 * 
 * Tokens can be provided via:
 * 1. Environment variables (GMAIL_ACCESS_TOKEN, GMAIL_REFRESH_TOKEN) - preferred for desktop app
 * 2. @flowstate/core auth module - fallback for standalone usage
 */

import { google, gmail_v1 } from 'googleapis';

let gmailClient: gmail_v1.Gmail | null = null;

/**
 * Get OAuth tokens and credentials from environment variables or @flowstate/core
 */
async function getTokens(): Promise<{ 
  accessToken: string; 
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}> {
  // First, check environment variables (set by desktop app)
  const envAccessToken = process.env.GMAIL_ACCESS_TOKEN;
  const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (envAccessToken) {
    console.error('[mcp-gmail] Using tokens from environment variables');
    return {
      accessToken: envAccessToken,
      refreshToken: envRefreshToken,
      clientId: envClientId,
      clientSecret: envClientSecret,
    };
  }
  
  // Fallback to @flowstate/core auth (for standalone usage)
  try {
    const { auth } = await import('@flowstate/core');
    const token = await auth.getToken('gmail');
    if (token) {
      console.error('[mcp-gmail] Using tokens from @flowstate/core');
      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
      };
    }
  } catch (error) {
    // @flowstate/core not available or no token
    console.error('[mcp-gmail] @flowstate/core auth not available:', error);
  }
  
  throw new Error('Gmail not connected. Please connect via FlowState Integrations or set GMAIL_ACCESS_TOKEN environment variable.');
}

export async function getGmailClient(): Promise<gmail_v1.Gmail> {
  if (gmailClient) return gmailClient;

  const tokens = await getTokens();

  const oauth2Client = new google.auth.OAuth2(
    tokens.clientId,
    tokens.clientSecret
  );
  
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
  return gmailClient;
}

export async function listMessages(options: {
  maxResults?: number;
  labelIds?: string[];
  query?: string;
}) {
  const client = await getGmailClient();
  
  // Clean up parameters to avoid "invalid_request"
  const params: gmail_v1.Params$Resource$Users$Messages$List = {
    userId: 'me',
    maxResults: options.maxResults || 10,
  };

  if (options.labelIds && options.labelIds.length > 0) {
    params.labelIds = options.labelIds;
  }

  if (options.query && options.query.trim() !== '') {
    params.q = options.query;
  }

  const response = await client.users.messages.list(params);

  return response.data.messages || [];
}

export async function getMessage(messageId: string) {
  const client = await getGmailClient();
  
  const response = await client.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return response.data;
}

export async function createDraft(email: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}) {
  const client = await getGmailClient();
  
  const message = [
    `To: ${email.to}`,
    email.cc ? `Cc: ${email.cc}` : '',
    email.bcc ? `Bcc: ${email.bcc}` : '',
    `Subject: ${email.subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    email.body,
  ].filter(Boolean).join('\n');

  const encodedMessage = Buffer.from(message).toString('base64url');

  const response = await client.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedMessage,
      },
    },
  });

  return response.data;
}

export async function replyToMessage(
  threadId: string,
  body: string,
  replyAll: boolean = false
) {
  const client = await getGmailClient();

  // Get the last message in the thread to reply to
  const thread = await client.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full', // We need headers
  });

  const messages = thread.data.messages;
  if (!messages || messages.length === 0) {
    throw new Error('Thread not found or empty');
  }

  // Use the last message in the thread for context
  const lastMessage = messages[messages.length - 1];
  const headers = lastMessage.payload?.headers || [];

  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

  const subject = getHeader('Subject') || '';
  const messageId = getHeader('Message-ID');
  const references = getHeader('References');
  const from = getHeader('From');
  const to = getHeader('To');
  const cc = getHeader('Cc');

  if (!messageId) {
    throw new Error('Original message has no Message-ID');
  }

  const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
  // We reply to the sender of the last message
  const replyTo = from; 

  // Construct email
  const emailLines: string[] = [];
  emailLines.push(`To: ${replyTo}`);
  
  if (replyAll) {
    // Naive Reply All: include original To and Cc
    // Note: In production code, we should parse and remove our own email address
    const ccRecipients = [to, cc].filter(Boolean).join(', ');
    if (ccRecipients) {
      emailLines.push(`Cc: ${ccRecipients}`);
    }
  }

  emailLines.push(`Subject: ${replySubject}`);
  emailLines.push(`In-Reply-To: ${messageId}`);
  emailLines.push(`References: ${references ? references + ' ' + messageId : messageId}`);
  emailLines.push('Content-Type: text/html; charset=utf-8');
  emailLines.push('');
  emailLines.push(body);

  const rawMessage = emailLines.join('\n');
  const encodedMessage = Buffer.from(rawMessage).toString('base64url');

  const response = await client.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: threadId,
    },
  });

  return response.data;
}


export async function sendMessage(email: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}) {
  const client = await getGmailClient();
  
  const message = [
    `To: ${email.to}`,
    email.cc ? `Cc: ${email.cc}` : '',
    email.bcc ? `Bcc: ${email.bcc}` : '',
    `Subject: ${email.subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    email.body,
  ].filter(Boolean).join('\n');

  const encodedMessage = Buffer.from(message).toString('base64url');

  const response = await client.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return response.data;
}

export async function modifyLabels(
  messageId: string,
  addLabels: string[] = [],
  removeLabels: string[] = []
) {
  const client = await getGmailClient();
  
  const response = await client.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: addLabels,
      removeLabelIds: removeLabels,
    },
  });

  return response.data;
}

export async function trashMessage(messageId: string) {
  const client = await getGmailClient();
  
  const response = await client.users.messages.trash({
    userId: 'me',
    id: messageId,
  });

  return response.data;
}
