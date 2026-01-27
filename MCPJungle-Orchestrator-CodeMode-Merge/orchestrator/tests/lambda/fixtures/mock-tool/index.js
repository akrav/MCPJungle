#!/usr/bin/env node
/**
 * Mock MCP Tool
 *
 * A simple MCP tool for testing the Lambda adapter.
 * Responds to JSON-RPC requests via stdin/stdout.
 */

const readline = require('readline');

// Tool definitions
const TOOLS = [
  {
    name: 'echo',
    description: 'Echoes back the input',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' },
      },
      required: ['message'],
    },
  },
  {
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
];

// Handle JSON-RPC requests
function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'mock-mcp-tool', version: '1.0.0' },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call':
      const { name, arguments: args } = params || {};
      
      if (name === 'echo') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: args.message }],
          },
        };
      }
      
      if (name === 'add') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: String(args.a + args.b) }],
          },
        };
      }
      
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown method: ${method}` },
      };
  }
}

// Main loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    const response = handleRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    }));
  }
});

// Log startup to stderr
console.error('mock-mcp-tool started');
