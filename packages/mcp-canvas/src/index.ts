/**
 * @flowstate/mcp-canvas
 * 
 * Canvas LMS MCP server for FlowState productivity orchestration.
 * Provides tools for accessing courses, assignments, grades, and announcements.
 * 
 * Authentication is done via a user-generated Canvas API token.
 * Students can generate their own token from Canvas Settings > Approved Integrations.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

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
    console.error('[mcp-canvas] Incoming message:', JSON.stringify(message));
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
