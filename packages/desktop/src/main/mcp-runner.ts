import fs from 'node:fs';
import path from 'node:path';

const SERVER_IMPORTS: Record<string, string> = {
  'mcp-gmail': '@flowstate/mcp-gmail/dist/index.js',
  'mcp-gcal': '@flowstate/mcp-gcal/dist/index.js',
  'mcp-system': '@flowstate/mcp-system/dist/index.js',
  'mcp-canvas': '@flowstate/mcp-canvas/dist/index.js',
  'mcp-notion': '@flowstate/mcp-notion/dist/index.js',
};

function getRunnerLogPath(serverName: string | undefined): string | null {
  const baseDir =
    typeof process.env.FLOWSTATE_DATA_DIR === 'string' && process.env.FLOWSTATE_DATA_DIR.trim() !== ''
      ? process.env.FLOWSTATE_DATA_DIR
      : null;

  if (!baseDir) return null;
  const safeName = (serverName ?? 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(baseDir, `mcp-${safeName}.log`);
}

function appendRunnerLog(logPath: string | null, line: string): void {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {
    // Ignore logging failures; never block MCP startup.
  }
}

async function main(): Promise<void> {
  const serverName = process.argv[2]?.trim();
  const logPath = getRunnerLogPath(serverName);

  appendRunnerLog(logPath, `[${new Date().toISOString()}] start ${serverName ?? ''}\n`);
  process.on('uncaughtException', (error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    appendRunnerLog(logPath, `[${new Date().toISOString()}] uncaughtException ${message}\n`);
  });
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
    appendRunnerLog(logPath, `[${new Date().toISOString()}] unhandledRejection ${message}\n`);
  });
  process.on('exit', (code) => {
    appendRunnerLog(logPath, `[${new Date().toISOString()}] exit ${code}\n`);
  });

  if (!serverName || !(serverName in SERVER_IMPORTS)) {
    const supported = Object.keys(SERVER_IMPORTS).join(', ');
    throw new Error(`Unsupported MCP server "${serverName ?? ''}". Expected one of: ${supported}`);
  }

  const moduleSpecifier = SERVER_IMPORTS[serverName];
  appendRunnerLog(logPath, `[${new Date().toISOString()}] import ${moduleSpecifier}\n`);
  await import(moduleSpecifier);
}

main().catch((error) => {
  const serverName = process.argv[2]?.trim();
  const logPath = getRunnerLogPath(serverName);
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  appendRunnerLog(logPath, `[${new Date().toISOString()}] fatal ${message}\n`);
  console.error('[flowstate-mcp-runner] Fatal error:', message);
  process.exit(1);
});
