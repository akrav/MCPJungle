/**
 * Lambda Test Infrastructure Setup
 *
 * Provides test utilities, mocks, and fixtures for Lambda-related testing.
 *
 * @module tests/lambda/setup
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// ==============================================================================
// Mock Data
// ==============================================================================

/**
 * Mock Lambda configuration
 */
export const mockLambdaConfig = {
  region: 'us-east-1',
  functionUrl: 'https://test-function.lambda-url.us-east-1.on.aws/',
  s3Bucket: 'test-mcp-packages',
  roleArn: 'arn:aws:iam::123456789:role/test-lambda-role',
  ecrRepo: 'test-ecr-repo',
  memoryMb: 2048,
  timeoutMs: 30000,
  ephemeralStorageMb: 512,
};

/**
 * Mock S3 configuration
 */
export const mockS3Config = {
  bucket: 'test-mcp-packages',
  region: 'us-east-1',
  packagePrefix: 'packages/',
};

/**
 * Mock tool data
 */
export const mockTool = {
  id: 'test-tool-id-12345678',
  name: 'test-tool',
  description: 'A test MCP tool for unit testing',
  endpoint_url: 'https://example.com/test-tool',
  price_per_call: 0.01,
  average_rating: 4.5,
  listing_status: 'ACTIVE' as const,
};

/**
 * Mock JSON-RPC request
 */
export const mockJsonRpcRequest = {
  jsonrpc: '2.0' as const,
  id: 'test-1',
  method: 'tools/list',
};

/**
 * Mock JSON-RPC response
 */
export const mockJsonRpcResponse = {
  jsonrpc: '2.0' as const,
  id: 'test-1',
  result: {
    tools: [
      {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  },
};

/**
 * Mock SSE response
 */
export const mockSSEResponse = `event: message
data: {"jsonrpc":"2.0","id":"test-1","result":{"tools":[]}}

`;

// ==============================================================================
// Mock Factories
// ==============================================================================

/**
 * Creates a mock fetch response
 */
export function createMockFetchResponse(options: {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}): Response {
  const { status = 200, body = '', headers = {} } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({
      'Content-Type': 'text/event-stream',
      ...headers,
    }),
    text: async () => body,
    json: async () => JSON.parse(body),
    clone: () => createMockFetchResponse(options),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    url: '',
    type: 'basic' as ResponseType,
    redirected: false,
  } as Response;
}

/**
 * Creates a mock Lambda SSE response
 */
export function createMockLambdaResponse(options: {
  jsonRpcResponse?: object;
  isColdStart?: boolean;
}): Response {
  const { jsonRpcResponse = mockJsonRpcResponse, isColdStart = false } = options;

  const sseBody = `event: message
data: ${JSON.stringify(jsonRpcResponse)}

`;

  return createMockFetchResponse({
    status: 200,
    body: sseBody,
    headers: {
      'Content-Type': 'text/event-stream',
      'X-Cold-Start': isColdStart ? 'true' : 'false',
      'X-Tool-Name': 'test-tool',
      'X-Tool-Version': 'latest',
    },
  });
}

// ==============================================================================
// Mock AWS SDK
// ==============================================================================

/**
 * Mock S3 client
 */
export const mockS3Client = {
  send: vi.fn(),
};

/**
 * Mock Lambda client
 */
export const mockLambdaClient = {
  send: vi.fn(),
};

/**
 * Setup AWS SDK mocks
 */
export function setupAwsMocks(): void {
  vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn(() => mockS3Client),
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
  }));

  vi.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: vi.fn(() => mockLambdaClient),
    InvokeCommand: vi.fn(),
    CreateFunctionCommand: vi.fn(),
    DeleteFunctionCommand: vi.fn(),
    GetFunctionCommand: vi.fn(),
  }));
}

/**
 * Reset AWS SDK mocks
 */
export function resetAwsMocks(): void {
  mockS3Client.send.mockReset();
  mockLambdaClient.send.mockReset();
}

// ==============================================================================
// Mock Supabase
// ==============================================================================

/**
 * Mock Supabase client
 */
export const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: mockTool, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null, count: 1 })),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
  })),
};

/**
 * Setup Supabase mocks
 */
export function setupSupabaseMocks(): void {
  vi.mock('../../src/discovery/supabase/client.js', () => ({
    getSupabaseClient: vi.fn(() => mockSupabase),
  }));
}

// ==============================================================================
// Mock Fetch
// ==============================================================================

/**
 * Setup global fetch mock
 */
export function setupFetchMock(): void {
  global.fetch = vi.fn();
}

/**
 * Mock fetch to return Lambda response
 */
export function mockFetchLambdaSuccess(response = mockJsonRpcResponse): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    createMockLambdaResponse({ jsonRpcResponse: response })
  );
}

/**
 * Mock fetch to return error
 */
export function mockFetchError(status: number, message: string): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    createMockFetchResponse({
      status,
      body: JSON.stringify({ error: message }),
    })
  );
}

/**
 * Mock fetch to throw network error
 */
export function mockFetchNetworkError(message: string): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error(message)
  );
}

// ==============================================================================
// Test Lifecycle
// ==============================================================================

/**
 * Standard test setup
 */
export function setupLambdaTests(): void {
  beforeAll(() => {
    setupFetchMock();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.resetModules();
  });
}

// ==============================================================================
// Test Utilities
// ==============================================================================

/**
 * Creates a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates an AbortError
 */
export function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Creates a timeout mock that aborts after delay
 */
export function createTimeoutMock(delayMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(createAbortError()), delayMs);
  });
}
