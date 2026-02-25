const SERVER_IMPORTS: Record<string, string> = {
  'mcp-gmail': '@flowstate/mcp-gmail/dist/index.js',
  'mcp-gcal': '@flowstate/mcp-gcal/dist/index.js',
  'mcp-system': '@flowstate/mcp-system/dist/index.js',
  'mcp-canvas': '@flowstate/mcp-canvas/dist/index.js',
  'mcp-notion': '@flowstate/mcp-notion/dist/index.js',
};

async function main(): Promise<void> {
  const serverName = process.argv[2]?.trim();
  if (!serverName || !(serverName in SERVER_IMPORTS)) {
    const supported = Object.keys(SERVER_IMPORTS).join(', ');
    throw new Error(`Unsupported MCP server "${serverName ?? ''}". Expected one of: ${supported}`);
  }

  const moduleSpecifier = SERVER_IMPORTS[serverName];
  await import(moduleSpecifier);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error('[flowstate-mcp-runner] Fatal error:', message);
  process.exit(1);
});
