/**
 * @flowstate/mcp-gcal
 * 
 * Google Calendar MCP server for FlowState productivity orchestration.
 * Provides tools for events, scheduling, and conflict detection.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

const server = new Server(
  {
    name: '@flowstate/mcp-gcal',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register all GCal tools
registerTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();

  transport.onmessage = (message) => {
    console.error('[mcp-gcal] Incoming message:', JSON.stringify(message));
  };

  transport.onerror = (error) => {
    console.error('[mcp-gcal] Transport error:', error);
  };

  await server.connect(transport);
  console.error('[mcp-gcal] Server started');
}

main().catch((error) => {
  console.error('[mcp-gcal] Fatal error:', error);
});
