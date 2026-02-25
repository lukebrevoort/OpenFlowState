#!/usr/bin/env node
/**
 * FlowState MCP Server Test Script
 * 
 * Verifies that all MCP servers can be loaded and registered.
 * Run with: node scripts/test-mcp.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const MCP_SERVERS = [
  { name: 'mcp-notion', entrypoint: 'packages/mcp-notion/dist/index.js' },
  { name: 'mcp-gmail', entrypoint: 'packages/mcp-gmail/dist/index.js' },
  { name: 'mcp-gcal', entrypoint: 'packages/mcp-gcal/dist/index.js' },
  { name: 'mcp-system', entrypoint: 'packages/mcp-system/dist/index.js' },
  { name: 'mcp-canvas', entrypoint: 'packages/mcp-canvas/dist/index.js' },
];

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

async function testServer(server) {
  return new Promise((resolve) => {
    const entryPath = join(rootDir, server.entrypoint);
    
    log(colors.blue, '●', `Testing ${server.name}...`);
    
    const proc = spawn('node', [entryPath], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FLOWSTATE_TEST: '1' },
    });
    
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    // MCP servers run indefinitely, so we test if they start without crashing
    // We give them 2 seconds to initialize
    setTimeout(() => {
      proc.kill('SIGTERM');
    }, 2000);
    
    proc.on('close', (code) => {
      // SIGTERM causes exit code 143 (128 + 15) or null on some systems
      // Exit code 0 or SIGTERM is considered success for this test
      if (code === null || code === 0 || code === 143) {
        log(colors.green, '✓', `${server.name} started successfully`);
        resolve({ name: server.name, success: true });
      } else {
        log(colors.red, '✗', `${server.name} failed with code ${code}`);
        if (error) {
          console.log(`  ${colors.yellow}Error:${colors.reset} ${error.substring(0, 200)}`);
        }
        resolve({ name: server.name, success: false, error });
      }
    });
    
    proc.on('error', (err) => {
      log(colors.red, '✗', `${server.name} failed to start: ${err.message}`);
      resolve({ name: server.name, success: false, error: err.message });
    });
  });
}

async function main() {
  console.log(`\n${colors.bold}FlowState MCP Server Test${colors.reset}\n`);
  console.log('Testing all MCP servers can initialize...\n');
  
  const results = [];
  
  for (const server of MCP_SERVERS) {
    const result = await testServer(server);
    results.push(result);
  }
  
  console.log('\n─────────────────────────────────────');
  console.log(`${colors.bold}Results:${colors.reset}\n`);
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    const symbol = r.success ? `${colors.green}✓` : `${colors.red}✗`;
    console.log(`  ${symbol}${colors.reset} ${r.name}`);
  });
  
  console.log('\n─────────────────────────────────────');
  console.log(`${colors.bold}Summary:${colors.reset} ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
