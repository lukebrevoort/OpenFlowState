/**
 * @flowstate/mcp-notion
 * 
 * Notion MCP server for FlowState productivity orchestration.
 * Provides tools for pages, databases, and task management.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

const server = new Server(
  {
    name: '@flowstate/mcp-notion',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register all Notion tools
registerTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp-notion] Server started');
}

main().catch(console.error);
