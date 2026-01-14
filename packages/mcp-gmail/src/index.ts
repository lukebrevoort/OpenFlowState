/**
 * @flowstate/mcp-gmail
 * 
 * Gmail MCP server for FlowState productivity orchestration.
 * Provides tools for email reading, drafting, and sending.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

const server = new Server(
  {
    name: '@flowstate/mcp-gmail',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register all Gmail tools
registerTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp-gmail] Server started');
}

main().catch(console.error);
