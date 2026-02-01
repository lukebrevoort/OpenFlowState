/**
 * @flowstate/mcp-canvas
 * 
 * Canvas LMS MCP server for FlowState productivity orchestration.
 * Provides tools for accessing courses, assignments, grades, and announcements.
 * 
 * Authentication supports:
 * - Token auth via a user-generated Canvas API token (CANVAS_API_TOKEN)
 * - Browser-session auth via Playwright login + saved storage state (CANVAS_AUTH_MODE=browser)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

const redactSecretsFromString = (input: string): string => {
  return input
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(canvas_session|_csrf_token|csrf_token|session)=[^;\s]+/gi, '$1=[REDACTED]');
};

const safeJson = (value: unknown): string => {
  try {
    return redactSecretsFromString(JSON.stringify(value));
  } catch {
    return '[Unserializable]';
  }
};

const server = new Server(
  {
    name: '@flowstate/mcp-canvas',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register all Canvas tools
registerTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();

  transport.onmessage = (message) => {
    console.error('[mcp-canvas] Incoming message:', safeJson(message));
  };

  transport.onerror = (error) => {
    console.error('[mcp-canvas] Transport error:', error);
  };

  await server.connect(transport);
  console.error('[mcp-canvas] Server started');
}

main().catch((error) => {
  console.error('[mcp-canvas] Fatal error:', error);
});
