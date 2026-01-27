/**
 * E2E Tests - Full Lambda Pipeline
 *
 * End-to-end tests that verify the complete flow from
 * tool discovery → provisioning → invocation → response.
 *
 * Uses a local mock server to simulate Lambda without AWS credentials.
 *
 * @module tests/lambda/e2e/full_pipeline.spec
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';

// Mock the log module
vi.mock('../../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

// ==============================================================================
// Full Mock Lambda Server with Tool Registry
// ==============================================================================

interface ToolRegistry {
  [toolName: string]: {
    version: string;
    tools: Array<{ name: string; description: string }>;
    handlers: { [method: string]: (args: any) => any };
  };
}

const toolRegistry: ToolRegistry = {
  'context7': {
    version: '1.0.0',
    tools: [
      { name: 'resolve-library-id', description: 'Resolves a library name to its ID' },
      { name: 'get-library-docs', description: 'Gets documentation for a library' },
    ],
    handlers: {
      'resolve-library-id': (args: { libraryName: string }) => ({
        content: [{ type: 'text', text: JSON.stringify({ libraryId: `/mock/${args.libraryName}` }) }],
      }),
      'get-library-docs': (args: { context7CompatibleLibraryID: string }) => ({
        content: [{ type: 'text', text: `Documentation for ${args.context7CompatibleLibraryID}` }],
      }),
    },
  },
  'calculator': {
    version: '2.0.0',
    tools: [
      { name: 'add', description: 'Adds two numbers' },
      { name: 'multiply', description: 'Multiplies two numbers' },
    ],
    handlers: {
      'add': (args: { a: number; b: number }) => ({
        content: [{ type: 'text', text: String(args.a + args.b) }],
      }),
      'multiply': (args: { a: number; b: number }) => ({
        content: [{ type: 'text', text: String(args.a * args.b) }],
      }),
    },
  },
  'echo': {
    version: '1.0.0',
    tools: [{ name: 'echo', description: 'Echoes the input message' }],
    handlers: {
      'echo': (args: { message: string }) => ({
        content: [{ type: 'text', text: args.message }],
      }),
    },
  },
};

let mockLambdaServer: Server;
let serverUrl: string;
let metrics = {
  requests: 0,
  coldStarts: 0,
  errors: 0,
};

function createMockLambdaServer(): Promise<string> {
  return new Promise((resolve) => {
    let isWarm = false;

    mockLambdaServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        metrics.requests++;

        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const toolName = url.searchParams.get('tool');
        const version = url.searchParams.get('version') || 'latest';

        // Simulate cold start on first request
        const isColdStart = !isWarm;
        isWarm = true;
        if (isColdStart) metrics.coldStarts++;

        if (!toolName) {
          metrics.errors++;
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Missing 'tool' query parameter" }));
          return;
        }

        const tool = toolRegistry[toolName];
        if (!tool) {
          metrics.errors++;
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Tool '${toolName}' not found` }));
          return;
        }

        let jsonRpc: { id: string; method: string; params?: any };
        try {
          jsonRpc = JSON.parse(body);
        } catch {
          jsonRpc = { id: '0', method: 'unknown' };
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Cold-Start': String(isColdStart),
          'X-Tool-Name': toolName,
          'X-Tool-Version': tool.version,
        });

        let response: object;
        switch (jsonRpc.method) {
          case 'initialize':
            response = {
              jsonrpc: '2.0',
              id: jsonRpc.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: toolName, version: tool.version },
              },
            };
            break;

          case 'tools/list':
            response = {
              jsonrpc: '2.0',
              id: jsonRpc.id,
              result: { tools: tool.tools },
            };
            break;

          case 'tools/call':
            const methodName = jsonRpc.params?.name;
            const args = jsonRpc.params?.arguments || {};
            const handler = tool.handlers[methodName];
            
            if (handler) {
              response = {
                jsonrpc: '2.0',
                id: jsonRpc.id,
                result: handler(args),
              };
            } else {
              response = {
                jsonrpc: '2.0',
                id: jsonRpc.id,
                error: { code: -32601, message: `Unknown method: ${methodName}` },
              };
            }
            break;

          default:
            response = {
              jsonrpc: '2.0',
              id: jsonRpc.id,
              error: { code: -32601, message: `Unknown method: ${jsonRpc.method}` },
            };
        }

        res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        res.end();
      });
    });

    mockLambdaServer.listen(0, '127.0.0.1', () => {
      const addr = mockLambdaServer.address() as AddressInfo;
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

// ==============================================================================
// E2E Tests
// ==============================================================================

describe('E2E: Full Lambda Pipeline', () => {
  beforeAll(async () => {
    serverUrl = await createMockLambdaServer();
    metrics = { requests: 0, coldStarts: 0, errors: 0 };
  });

  afterAll(() => {
    mockLambdaServer?.close();
  });

  describe('Tool Discovery Flow', () => {
    it('should discover tools from multiple registered tools', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      // Discover context7 tools
      const context7Client = new LambdaMcpClient(serverUrl, 'context7', 'latest');
      const context7Tools = await context7Client.listTools();
      expect(context7Tools.success).toBe(true);
      expect((context7Tools.response?.result as any).tools).toHaveLength(2);

      // Discover calculator tools
      const calcClient = new LambdaMcpClient(serverUrl, 'calculator', 'latest');
      const calcTools = await calcClient.listTools();
      expect(calcTools.success).toBe(true);
      expect((calcTools.response?.result as any).tools).toHaveLength(2);
    });

    it('should return 404 for unknown tools', async () => {
      const response = await fetch(`${serverUrl}?tool=nonexistent`, {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'tools/list' }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('not found');
    });
  });

  describe('Tool Invocation Flow', () => {
    it('should execute context7 resolve-library-id', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'context7', 'latest');
      const result = await client.callTool('resolve-library-id', { libraryName: 'react' });

      expect(result.success).toBe(true);
      const text = (result.response?.result as any).content[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.libraryId).toBe('/mock/react');
    });

    it('should execute calculator add', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'calculator', 'latest');
      const result = await client.callTool('add', { a: 10, b: 20 });

      expect(result.success).toBe(true);
      expect((result.response?.result as any).content[0].text).toBe('30');
    });

    it('should execute calculator multiply', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'calculator', 'latest');
      const result = await client.callTool('multiply', { a: 7, b: 8 });

      expect(result.success).toBe(true);
      expect((result.response?.result as any).content[0].text).toBe('56');
    });

    it('should execute echo tool', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'echo', 'latest');
      const result = await client.callTool('echo', { message: 'Hello, World!' });

      expect(result.success).toBe(true);
      expect((result.response?.result as any).content[0].text).toBe('Hello, World!');
    });
  });

  describe('Cold Start Behavior', () => {
    it('should track cold start in metrics', () => {
      expect(metrics.coldStarts).toBeGreaterThanOrEqual(1);
      expect(metrics.requests).toBeGreaterThan(metrics.coldStarts);
    });
  });

  describe('Full Agent Workflow Simulation', () => {
    it('should complete a full agent workflow: discover → list → call', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      // Step 1: Initialize connection
      const client = new LambdaMcpClient(serverUrl, 'context7', 'latest');
      const initResult = await client.initialize();
      expect(initResult.success).toBe(true);
      expect(initResult.response?.result).toHaveProperty('serverInfo');

      // Step 2: List available tools
      const listResult = await client.listTools();
      expect(listResult.success).toBe(true);
      const tools = (listResult.response?.result as any).tools;
      expect(tools.length).toBeGreaterThan(0);

      // Step 3: Call a discovered tool
      const toolToCall = tools[0].name;
      let callResult;
      if (toolToCall === 'resolve-library-id') {
        callResult = await client.callTool(toolToCall, { libraryName: 'next.js' });
      } else {
        callResult = await client.callTool(toolToCall, { context7CompatibleLibraryID: '/vercel/next.js' });
      }
      expect(callResult.success).toBe(true);
      expect(callResult.response?.result).toHaveProperty('content');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tool parameter gracefully', async () => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'tools/list' }),
      });

      expect(response.status).toBe(400);
      expect(metrics.errors).toBeGreaterThan(0);
    });

    it('should handle unknown method gracefully', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'calculator', 'latest');
      const result = await client.callTool('unknown-method', {});

      expect(result.success).toBe(false);
      expect(result.response?.error).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should complete requests within acceptable time', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'echo', 'latest');
      const result = await client.callTool('echo', { message: 'perf test' });

      expect(result.durationMs).toBeLessThan(1000); // Should be well under 1s locally
    });

    it('should have processed multiple requests successfully', () => {
      // After all tests, verify metrics
      expect(metrics.requests).toBeGreaterThan(5);
      // Most requests should succeed
      const successRate = (metrics.requests - metrics.errors) / metrics.requests;
      expect(successRate).toBeGreaterThan(0.8);
    });
  });
});
