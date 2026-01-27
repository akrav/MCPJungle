/**
 * Unit Tests - Lambda MCP Client
 *
 * Tests for the Lambda client wrapper and SSE parsing.
 *
 * @module tests/lambda/unit/lambdaClient.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockLambdaConfig,
  mockJsonRpcResponse,
  createMockLambdaResponse,
  createMockFetchResponse,
  setupFetchMock,
  mockFetchLambdaSuccess,
  mockFetchError,
  mockFetchNetworkError,
} from '../setup.js';

// Mock the config module
vi.mock('../../../src/config/aws.js', () => ({
  loadLambdaConfig: vi.fn(() => mockLambdaConfig),
  buildLambdaToolUrl: vi.fn((baseUrl, toolName, version) => 
    `${baseUrl}?tool=${toolName}&version=${version}`
  ),
}));

// Mock the log module
vi.mock('../../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

describe('Lambda MCP Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseSSEResponse', () => {
    it('should parse simple SSE events', async () => {
      const { parseSSEResponse } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const sseText = `event: message
data: {"test": "data"}

`;
      
      const events = parseSSEResponse(sseText);
      
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('message');
      expect(events[0].data).toBe('{"test": "data"}');
    });

    it('should parse multiple SSE events', async () => {
      const { parseSSEResponse } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const sseText = `event: message
data: {"id": 1}

event: message
data: {"id": 2}

`;
      
      const events = parseSSEResponse(sseText);
      
      expect(events).toHaveLength(2);
    });

    it('should handle events without explicit event type', async () => {
      const { parseSSEResponse } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const sseText = `data: {"test": "data"}

`;
      
      const events = parseSSEResponse(sseText);
      
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('message');
    });

    it('should handle error events', async () => {
      const { parseSSEResponse } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const sseText = `event: error
data: {"error": "Something went wrong"}

`;
      
      const events = parseSSEResponse(sseText);
      
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('error');
    });
  });

  describe('extractJsonRpcResponses', () => {
    it('should extract JSON-RPC responses from SSE events', async () => {
      const { parseSSEResponse, extractJsonRpcResponses } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const sseText = `event: message
data: {"jsonrpc":"2.0","id":"1","result":{}}

`;
      
      const events = parseSSEResponse(sseText);
      const responses = extractJsonRpcResponses(events);
      
      expect(responses).toHaveLength(1);
      expect(responses[0].jsonrpc).toBe('2.0');
      expect(responses[0].id).toBe('1');
    });

    it('should handle error events as JSON-RPC errors', async () => {
      const { parseSSEResponse, extractJsonRpcResponses } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const sseText = `event: error
data: {"error": "Tool failed"}

`;
      
      const events = parseSSEResponse(sseText);
      const responses = extractJsonRpcResponses(events);
      
      expect(responses).toHaveLength(1);
      expect(responses[0].error).toBeDefined();
      expect(responses[0].error?.message).toBe('Tool failed');
    });

    it('should skip non-JSON data', async () => {
      const { parseSSEResponse, extractJsonRpcResponses } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const sseText = `event: message
data: not valid json

event: message
data: {"jsonrpc":"2.0","id":"1","result":{}}

`;
      
      const events = parseSSEResponse(sseText);
      const responses = extractJsonRpcResponses(events);
      
      expect(responses).toHaveLength(1);
    });
  });

  describe('LambdaMcpClient', () => {
    it('should construct tool URL correctly', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const client = new LambdaMcpClient(
        'https://test.lambda-url.us-east-1.on.aws/',
        'test-tool',
        'v1.0.0'
      );
      
      const url = client.getToolUrl();
      
      expect(url).toContain('test-tool');
      expect(url).toContain('v1.0.0');
    });

    it('should invoke and parse response successfully', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      mockFetchLambdaSuccess();
      
      const client = new LambdaMcpClient(
        'https://test.lambda-url.us-east-1.on.aws/',
        'test-tool'
      );
      
      const result = await client.invoke({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list',
      });
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
    });

    it('should handle HTTP errors', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      mockFetchError(500, 'Internal Server Error');
      
      const client = new LambdaMcpClient(
        'https://test.lambda-url.us-east-1.on.aws/',
        'test-tool'
      );
      
      const result = await client.invoke({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list',
      }, { retries: 0 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle network errors', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      mockFetchNetworkError('Network unreachable');
      
      const client = new LambdaMcpClient(
        'https://test.lambda-url.us-east-1.on.aws/',
        'test-tool'
      );
      
      const result = await client.invoke({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list',
      }, { retries: 0 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network unreachable');
    });

    it('should detect cold starts', async () => {
      const { LambdaMcpClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockLambdaResponse({ isColdStart: true })
      );
      
      const client = new LambdaMcpClient(
        'https://test.lambda-url.us-east-1.on.aws/',
        'test-tool'
      );
      
      const result = await client.invoke({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list',
      });
      
      expect(result.isColdStart).toBe(true);
    });
  });

  describe('createLambdaClient', () => {
    it('should create client from config', async () => {
      const { createLambdaClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const client = createLambdaClient(mockLambdaConfig, 'test-tool');
      
      expect(client).toBeDefined();
      expect(client.getToolUrl()).toContain('test-tool');
    });

    it('should throw if function URL is missing', async () => {
      const { createLambdaClient } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      const badConfig = { ...mockLambdaConfig, functionUrl: undefined };
      
      expect(() => createLambdaClient(badConfig, 'test-tool')).toThrow();
    });
  });

  describe('isLambdaHealthy', () => {
    it('should return true for 200 response', async () => {
      const { isLambdaHealthy } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockFetchResponse({ status: 200 })
      );
      
      const healthy = await isLambdaHealthy('https://test.lambda-url.us-east-1.on.aws/');
      
      expect(healthy).toBe(true);
    });

    it('should return true for 400 response (expected when no tool param)', async () => {
      const { isLambdaHealthy } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockFetchResponse({ status: 400 })
      );
      
      const healthy = await isLambdaHealthy('https://test.lambda-url.us-east-1.on.aws/');
      
      expect(healthy).toBe(true);
    });

    it('should return false for network errors', async () => {
      const { isLambdaHealthy } = await import(
        '../../../src/discovery/provisioning/lambdaClient.js'
      );
      
      mockFetchNetworkError('Connection refused');
      
      const healthy = await isLambdaHealthy('https://test.lambda-url.us-east-1.on.aws/');
      
      expect(healthy).toBe(false);
    });
  });
});
