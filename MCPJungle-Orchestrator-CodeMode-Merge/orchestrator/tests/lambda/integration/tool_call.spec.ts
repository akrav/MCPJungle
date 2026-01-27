/**
 * Integration Tests - Lambda Tool Call Flow
 *
 * Tests the complete Lambda tool call flow using a local HTTP server
 * to simulate Lambda responses. These are real integration tests without
 * heavy mocking.
 *
 * @module tests/lambda/integration/tool_call.spec
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';

// ==============================================================================
// Test Server Setup
// ==============================================================================

let mockLambdaServer: Server;
let serverUrl: string;
let requestLog: Array<{ method: string; url: string; body: string }> = [];

function createMockLambdaServer(): Promise<string> {
  return new Promise((resolve) => {
    mockLambdaServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        requestLog.push({ method: req.method || 'GET', url: req.url || '/', body });
        
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const toolName = url.searchParams.get('tool');
        const version = url.searchParams.get('version') || 'latest';

        // Handle missing tool parameter
        if (!toolName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Missing 'tool' query parameter" }));
          return;
        }

        // Parse JSON-RPC request
        let jsonRpc: { id: string; method: string; params?: any } = { id: '0', method: 'unknown' };
        try {
          jsonRpc = JSON.parse(body);
        } catch {
          // GET request or invalid JSON
        }

        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Cold-Start': 'false',
          'X-Tool-Name': toolName,
          'X-Tool-Version': version,
        });

        // Handle different methods
        let response: object;
        switch (jsonRpc.method) {
          case 'initialize':
            response = {
              jsonrpc: '2.0',
              id: jsonRpc.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: toolName, version: '1.0.0' },
              },
            };
            break;

          case 'tools/list':
            response = {
              jsonrpc: '2.0',
              id: jsonRpc.id,
              result: {
                tools: [
                  { name: 'echo', description: 'Echoes input', inputSchema: { type: 'object' } },
                  { name: 'add', description: 'Adds numbers', inputSchema: { type: 'object' } },
                ],
              },
            };
            break;

          case 'tools/call':
            const toolCall = jsonRpc.params?.name;
            const args = jsonRpc.params?.arguments || {};
            
            if (toolCall === 'echo') {
              response = {
                jsonrpc: '2.0',
                id: jsonRpc.id,
                result: { content: [{ type: 'text', text: args.message || '' }] },
              };
            } else if (toolCall === 'add') {
              response = {
                jsonrpc: '2.0',
                id: jsonRpc.id,
                result: { content: [{ type: 'text', text: String((args.a || 0) + (args.b || 0)) }] },
              };
            } else {
              response = {
                jsonrpc: '2.0',
                id: jsonRpc.id,
                error: { code: -32601, message: `Unknown tool: ${toolCall}` },
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

        // Send SSE response
        res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        res.end();
      });
    });

    mockLambdaServer.listen(0, '127.0.0.1', () => {
      const addr = mockLambdaServer.address() as AddressInfo;
      const url = `http://127.0.0.1:${addr.port}`;
      resolve(url);
    });
  });
}

// ==============================================================================
// Tests
// ==============================================================================

describe('Lambda Tool Call Integration', () => {
  beforeAll(async () => {
    serverUrl = await createMockLambdaServer();
  });

  afterAll(() => {
    mockLambdaServer?.close();
  });

  beforeEach(() => {
    requestLog = [];
  });

  describe('LambdaMcpClient with real HTTP', () => {
    it('should initialize connection successfully', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'test-tool', 'latest');
      const result = await client.initialize();

      expect(result.success).toBe(true);
      expect(result.response?.result).toHaveProperty('protocolVersion');
      expect(result.response?.result).toHaveProperty('serverInfo');
    });

    it('should list tools successfully', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'test-tool', 'latest');
      const result = await client.listTools();

      expect(result.success).toBe(true);
      expect(result.response?.result).toHaveProperty('tools');
      expect((result.response?.result as any).tools).toHaveLength(2);
    });

    it('should call echo tool successfully', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'test-tool', 'latest');
      const result = await client.callTool('echo', { message: 'Hello, Lambda!' });

      expect(result.success).toBe(true);
      expect((result.response?.result as any).content[0].text).toBe('Hello, Lambda!');
    });

    it('should call add tool successfully', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'test-tool', 'latest');
      const result = await client.callTool('add', { a: 5, b: 3 });

      expect(result.success).toBe(true);
      expect((result.response?.result as any).content[0].text).toBe('8');
    });

    it('should handle unknown tool error', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'test-tool', 'latest');
      const result = await client.callTool('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.response?.error).toBeDefined();
      expect(result.response?.error?.message).toContain('Unknown tool');
    });

    it('should include tool name and version in URL', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'my-tool', 'v1.2.3');
      await client.listTools();

      expect(requestLog.length).toBeGreaterThan(0);
      const lastRequest = requestLog[requestLog.length - 1];
      expect(lastRequest.url).toContain('tool=my-tool');
      expect(lastRequest.url).toContain('version=v1.2.3');
    });

    it('should detect cold start from headers', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'test-tool', 'latest');
      const result = await client.listTools();

      // Our mock server returns X-Cold-Start: false
      expect(result.isColdStart).toBe(false);
    });

    it('should measure duration', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const client = new LambdaMcpClient(serverUrl, 'test-tool', 'latest');
      const result = await client.listTools();

      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.durationMs).toBeLessThan(5000); // Should be fast locally
    });
  });

  describe('isLambdaHealthy with real HTTP', () => {
    it('should return true for healthy server', async () => {
      const { isLambdaHealthy } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const healthy = await isLambdaHealthy(serverUrl);
      expect(healthy).toBe(true);
    });

    it('should return false for non-existent server', async () => {
      const { isLambdaHealthy } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );

      const healthy = await isLambdaHealthy('http://127.0.0.1:59999');
      expect(healthy).toBe(false);
    });
  });

  describe('SSE parsing with real responses', () => {
    it('should parse SSE events from real HTTP response', async () => {
      // Make a raw fetch request to verify SSE format
      const response = await fetch(`${serverUrl}?tool=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'tools/list' }),
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      const body = await response.text();
      expect(body).toContain('event: message');
      expect(body).toContain('data:');
      expect(body).toContain('jsonrpc');
    });
  });
});
