/**
 * Lambda Client Wrapper
 *
 * Provides a high-level interface for interacting with Lambda-backed MCP tools.
 * This module handles:
 * - HTTP requests to Lambda function URLs
 * - SSE response parsing
 * - JSON-RPC message handling
 * - Error handling and retries
 *
 * @module discovery/provisioning/lambdaClient
 */

import { log } from '../../obs/log.js';
import {
  buildLambdaToolUrl,
  type LambdaConfig,
} from '../../config/aws.js';

// ==============================================================================
// Types
// ==============================================================================

/**
 * JSON-RPC 2.0 request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 response
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Options for Lambda tool invocation
 */
export interface LambdaInvokeOptions {
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Number of retries on transient failures (default: 1) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelayMs?: number;
}

/**
 * Result of a Lambda invocation
 */
export interface LambdaInvokeResult {
  /** Whether the invocation was successful */
  success: boolean;
  /** JSON-RPC response if successful */
  response?: JsonRpcResponse;
  /** Error message if failed */
  error?: string;
  /** Whether this was a cold start */
  isColdStart?: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** HTTP status code */
  statusCode?: number;
}

/**
 * Lambda Client Error
 */
export class LambdaClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'LambdaClientError';
  }
}

// ==============================================================================
// SSE Parsing
// ==============================================================================

/**
 * Parsed SSE event
 */
interface SSEEvent {
  event: string;
  data: string;
}

/**
 * Parses an SSE response body into events
 *
 * SSE format:
 * event: <event-type>
 * data: <json-data>
 *
 * @param text - Raw SSE response text
 * @returns Array of parsed events
 */
export function parseSSEResponse(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = text.split('\n');

  let currentEvent = '';
  let currentData = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6);
    } else if (line === '' && currentData) {
      // Empty line marks end of event
      events.push({ event: currentEvent || 'message', data: currentData });
      currentEvent = '';
      currentData = '';
    }
  }

  // Handle last event if no trailing newline
  if (currentData) {
    events.push({ event: currentEvent || 'message', data: currentData });
  }

  return events;
}

/**
 * Extracts JSON-RPC responses from SSE events
 *
 * @param events - Parsed SSE events
 * @returns Array of JSON-RPC responses
 */
export function extractJsonRpcResponses(events: SSEEvent[]): JsonRpcResponse[] {
  const responses: JsonRpcResponse[] = [];

  for (const event of events) {
    if (event.event === 'message' || event.event === '') {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.jsonrpc === '2.0') {
          responses.push(parsed);
        }
      } catch {
        // Skip non-JSON data
      }
    } else if (event.event === 'error') {
      try {
        const error = JSON.parse(event.data);
        responses.push({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: error.error || 'Unknown error',
            data: error,
          },
        });
      } catch {
        responses.push({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: event.data,
          },
        });
      }
    }
  }

  return responses;
}

// ==============================================================================
// Lambda Client
// ==============================================================================

/**
 * Lambda MCP Client
 *
 * Provides methods for invoking Lambda-backed MCP tools using HTTP.
 */
export class LambdaMcpClient {
  private baseUrl: string;
  private toolName: string;
  private version: string;

  constructor(
    baseUrl: string,
    toolName: string,
    version: string = 'latest'
  ) {
    this.baseUrl = baseUrl;
    this.toolName = toolName;
    this.version = version;
  }

  /**
   * Gets the full Lambda URL for this tool
   */
  getToolUrl(): string {
    return buildLambdaToolUrl(this.baseUrl, this.toolName, this.version);
  }

  /**
   * Invokes a JSON-RPC method on the Lambda tool
   *
   * @param request - JSON-RPC request
   * @param options - Invocation options
   * @returns Invocation result
   */
  async invoke(
    request: JsonRpcRequest,
    options: LambdaInvokeOptions = {}
  ): Promise<LambdaInvokeResult> {
    const {
      timeoutMs = 30000,
      retries = 1,
      retryDelayMs = 1000,
    } = options;

    const url = this.getToolUrl();
    const startTime = Date.now();

    log('info', 'lambda_client_invoke_start', {
      url,
      method: request.method,
      requestId: request.id,
    });

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const result = await this.doInvoke(url, request, timeoutMs);
        
        log('info', 'lambda_client_invoke_success', {
          url,
          method: request.method,
          requestId: request.id,
          durationMs: Date.now() - startTime,
          isColdStart: result.isColdStart,
          attempt,
        });

        return result;
      } catch (err) {
        lastError = err as Error;
        attempt++;

        if (attempt <= retries) {
          log('warn', 'lambda_client_invoke_retry', {
            url,
            method: request.method,
            requestId: request.id,
            error: lastError.message,
            attempt,
            retries,
          });

          await this.sleep(retryDelayMs);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    log('error', 'lambda_client_invoke_failed', {
      url,
      method: request.method,
      requestId: request.id,
      error: lastError?.message,
      durationMs,
      attempts: attempt,
    });

    return {
      success: false,
      error: lastError?.message ?? 'Unknown error',
      durationMs,
    };
  }

  /**
   * Internal method to perform the actual HTTP request
   */
  private async doInvoke(
    url: string,
    request: JsonRpcRequest,
    timeoutMs: number
  ): Promise<LambdaInvokeResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isColdStart = response.headers.get('X-Cold-Start') === 'true';
      const statusCode = response.status;

      if (!response.ok) {
        const errorText = await response.text();
        throw new LambdaClientError(
          `Lambda returned ${statusCode}: ${errorText}`,
          'HTTP_ERROR',
          statusCode
        );
      }

      // Read the full response body
      const body = await response.text();
      const durationMs = Date.now() - startTime;

      // Parse SSE events
      const events = parseSSEResponse(body);
      const responses = extractJsonRpcResponses(events);

      // Find the response matching our request ID
      const matchingResponse = responses.find(
        (r) => r.id === request.id || r.id === null
      );

      if (!matchingResponse) {
        throw new LambdaClientError(
          'No JSON-RPC response found in SSE stream',
          'NO_RESPONSE'
        );
      }

      return {
        success: !matchingResponse.error,
        response: matchingResponse,
        isColdStart,
        durationMs,
        statusCode,
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if ((err as Error).name === 'AbortError') {
        throw new LambdaClientError(
          `Request timed out after ${timeoutMs}ms`,
          'TIMEOUT'
        );
      }

      if (err instanceof LambdaClientError) {
        throw err;
      }

      throw new LambdaClientError(
        `Request failed: ${(err as Error).message}`,
        'REQUEST_FAILED',
        undefined,
        err as Error
      );
    }
  }

  /**
   * Initializes the MCP connection
   */
  async initialize(): Promise<LambdaInvokeResult> {
    return this.invoke({
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcpjungle-orchestrator',
          version: '1.0.0',
        },
      },
    });
  }

  /**
   * Lists available tools
   */
  async listTools(): Promise<LambdaInvokeResult> {
    return this.invoke({
      jsonrpc: '2.0',
      id: 'list-1',
      method: 'tools/list',
    });
  }

  /**
   * Calls a tool
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<LambdaInvokeResult> {
    return this.invoke({
      jsonrpc: '2.0',
      id: `call-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    });
  }

  /**
   * Pings the tool to check if it's healthy
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.invoke(
        {
          jsonrpc: '2.0',
          id: 'ping-1',
          method: 'ping',
        },
        { timeoutMs: 5000, retries: 0 }
      );
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Helper to sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==============================================================================
// Factory Functions
// ==============================================================================

/**
 * Creates a Lambda MCP client from configuration
 *
 * @param config - Lambda configuration
 * @param toolName - Name of the MCP tool
 * @param version - Tool version
 * @returns Lambda MCP client
 */
export function createLambdaClient(
  config: LambdaConfig,
  toolName: string,
  version: string = 'latest'
): LambdaMcpClient {
  if (!config.functionUrl) {
    throw new LambdaClientError(
      'Lambda function URL not configured',
      'CONFIG_MISSING'
    );
  }

  return new LambdaMcpClient(config.functionUrl, toolName, version);
}

/**
 * Creates a Lambda MCP client from a full URL
 *
 * @param url - Lambda function URL (base URL without query params)
 * @param toolName - Name of the MCP tool
 * @param version - Tool version
 * @returns Lambda MCP client
 */
export function createLambdaClientFromUrl(
  url: string,
  toolName: string,
  version: string = 'latest'
): LambdaMcpClient {
  return new LambdaMcpClient(url, toolName, version);
}

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Checks if a Lambda function URL is healthy
 *
 * @param url - Lambda function URL
 * @param timeoutMs - Timeout in milliseconds
 * @returns true if the Lambda is responding
 */
export async function isLambdaHealthy(
  url: string,
  timeoutMs: number = 5000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Lambda returns 400 if tool parameter is missing
    // Any response (even 400) indicates the Lambda is running
    return response.status === 200 || response.status === 400;
  } catch {
    return false;
  }
}

/**
 * Measures Lambda cold start time by invoking with a simple request
 *
 * @param url - Lambda function URL
 * @param toolName - Tool name
 * @param version - Tool version
 * @returns Cold start duration in ms, or null if already warm
 */
export async function measureColdStart(
  url: string,
  toolName: string,
  version: string = 'latest'
): Promise<{ durationMs: number; isColdStart: boolean }> {
  const client = new LambdaMcpClient(url, toolName, version);
  const result = await client.initialize();

  return {
    durationMs: result.durationMs,
    isColdStart: result.isColdStart ?? false,
  };
}
