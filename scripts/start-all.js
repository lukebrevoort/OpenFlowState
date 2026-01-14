/**
 * FlowState Startup Script
 * 
 * Launches both the Web Dashboard (background) and OpenCode TUI (foreground).
 * Ensures proper cleanup on exit.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(PROJECT_ROOT, 'dashboard.log');
const logStream = fs.createWriteStream(LOG_FILE);

// 1. Start Web Dashboard (Background)
console.log('🚀 Starting FlowState Dashboard...');
console.log(`📝 Logs being written to ${LOG_FILE}`);

const dashboard = spawn('pnpm', ['--filter', '@flowstate/web-config', 'dev'], {
  cwd: PROJECT_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'], // Pipe stdout/stderr
  shell: true,
  detached: false, 
});

// Redirect output to log file
dashboard.stdout.pipe(logStream);
dashboard.stderr.pipe(logStream);

// Optional: Log dashboard errors if startup fails
dashboard.stderr.on('data', (data) => {
  // Only log critical errors if needed, otherwise keep silent for TUI
  // console.error(`[Dashboard Error]: ${data}`);
});

// Wait a moment for Dashboard to spin up
setTimeout(() => {
  console.log('✅ Dashboard running at http://localhost:3847');
  console.log('💻 Launching FlowState TUI...');

  // 2. Start OpenCode TUI (Foreground)
  const opencode = spawn('opencode', ['.', '--agent', 'flowstate'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit', // Take over the terminal
    shell: true
  });

  opencode.on('close', (code) => {
    console.log('\n👋 FlowState shutting down...');
    cleanup();
    process.exit(code || 0);
  });

}, 2000); // 2 second startup delay

function cleanup() {
  if (dashboard) {
    dashboard.kill(); // This might not kill children (vite/node) on Windows, but works on Mac/Linux usually
    // Force kill group if needed
    try {
      process.kill(-dashboard.pid); 
    } catch (e) {
      // Ignore
    }
  }
}

// Handle unexpected exits
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
