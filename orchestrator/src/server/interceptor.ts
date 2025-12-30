/**
 * Discovery Interceptor
 *
 * Middleware that intercepts "Method not found" errors and triggers
 * the tool discovery process to automatically find and install missing tools.
 *
 * @module server/interceptor
 */

import { log } from '../obs/log.js';

/**
 * JSON-RPC Error codes
 */
export const JSON_RPC_ERRORS = {
  METHOD_NOT_FOUND: -32601,
  INVALID_REQUEST: -32600,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
} as const;

/**
 * Structure of a JSON-RPC error response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Request context for discovery
 */
export interface DiscoveryContext {
  userId: string;
  method: string;
  intent: string;
  originalRequest: unknown;
  requestId: string | number | null;
}

/**
 * Result of discovery attempt
 */
export interface DiscoveryResult {
  found: boolean;
  toolId?: string;
  toolName?: string;
  installed?: boolean;
  error?: string;
}

/**
 * Discovery resolver function type
 */
export type DiscoveryResolver = (
  userId: string,
  intent: string
) => Promise<DiscoveryResult>;

/**
 * Configuration for the interceptor
 */
export interface InterceptorConfig {
  /** Maximum number of retry attempts after installing a tool */
  maxRetries: number;
  /** Discovery resolver function */
  discoveryResolver?: DiscoveryResolver;
  /** Whether discovery is enabled */
  enabled: boolean;
}

/**
 * Default interceptor configuration
 */
export const DEFAULT_INTERCEPTOR_CONFIG: InterceptorConfig = {
  maxRetries: 1,
  enabled: true,
};

/**
 * Current interceptor configuration
 */
let currentConfig: InterceptorConfig = { ...DEFAULT_INTERCEPTOR_CONFIG };

/**
 * Configures the interceptor
 *
 * @param config - Partial configuration to merge with defaults
 */
export function configureInterceptor(config: Partial<InterceptorConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Gets the current interceptor configuration
 */
export function getInterceptorConfig(): InterceptorConfig {
  return { ...currentConfig };
}

/**
 * Resets the interceptor to default configuration
 */
export function resetInterceptor(): void {
  currentConfig = { ...DEFAULT_INTERCEPTOR_CONFIG };
}

/**
 * Checks if a JSON-RPC response is a "Method not found" error
 *
 * @param response - The response to check
 * @returns true if it's a method not found error
 */
export function isMethodNotFoundError(response: unknown): response is JsonRpcErrorResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const resp = response as Record<string, unknown>;
  if (resp.jsonrpc !== '2.0') {
    return false;
  }

  if (!resp.error || typeof resp.error !== 'object') {
    return false;
  }

  const error = resp.error as Record<string, unknown>;
  return error.code === JSON_RPC_ERRORS.METHOD_NOT_FOUND;
}

/**
 * Extracts the tool/method name from a JSON-RPC request
 *
 * @param request - The JSON-RPC request body
 * @returns The method name or null if not found
 */
export function extractMethodName(request: unknown): string | null {
  if (!request || typeof request !== 'object') {
    return null;
  }

  const req = request as Record<string, unknown>;
  if (typeof req.method === 'string') {
    return req.method;
  }

  return null;
}

/**
 * Extracts the request ID from a JSON-RPC request
 *
 * @param request - The JSON-RPC request body
 * @returns The request ID or null
 */
export function extractRequestId(request: unknown): string | number | null {
  if (!request || typeof request !== 'object') {
    return null;
  }

  const req = request as Record<string, unknown>;
  if (typeof req.id === 'string' || typeof req.id === 'number') {
    return req.id;
  }

  return null;
}

/**
 * Builds a discovery context from a request
 *
 * @param request - The JSON-RPC request body
 * @param userId - The user's ID
 * @returns Discovery context or null if unable to build
 */
export function buildDiscoveryContext(
  request: unknown,
  userId: string
): DiscoveryContext | null {
  const method = extractMethodName(request);
  if (!method) {
    return null;
  }

  const requestId = extractRequestId(request);

  // Extract intent from the method name and params
  // For tools/call methods, the intent is usually in the params
  let intent = method;

  const req = request as Record<string, unknown>;
  if (req.params && typeof req.params === 'object') {
    const params = req.params as Record<string, unknown>;
    // Try to extract a description or name from params
    if (typeof params.name === 'string') {
      intent = params.name;
    } else if (typeof params.description === 'string') {
      intent = params.description;
    } else if (typeof params.tool === 'string') {
      intent = params.tool;
    }
  }

  return {
    userId,
    method,
    intent,
    originalRequest: request,
    requestId,
  };
}

/**
 * Attempts to discover and install a missing tool
 *
 * @param context - The discovery context
 * @returns Discovery result
 */
export async function attemptDiscovery(
  context: DiscoveryContext
): Promise<DiscoveryResult> {
  if (!currentConfig.enabled) {
    log('info', 'interceptor_discovery_disabled', { userId: context.userId });
    return { found: false, error: 'Discovery is disabled' };
  }

  if (!currentConfig.discoveryResolver) {
    log('warn', 'interceptor_no_resolver', { userId: context.userId });
    return { found: false, error: 'No discovery resolver configured' };
  }

  log('info', 'interceptor_discovery_start', {
    userId: context.userId,
    method: context.method,
    intent: context.intent,
  });

  try {
    const result = await currentConfig.discoveryResolver(context.userId, context.intent);

    log('info', 'interceptor_discovery_result', {
      userId: context.userId,
      intent: context.intent,
      found: result.found,
      toolName: result.toolName,
    });

    return result;
  } catch (err) {
    log('error', 'interceptor_discovery_error', {
      userId: context.userId,
      intent: context.intent,
      error: (err as Error).message,
    });

    return {
      found: false,
      error: (err as Error).message,
    };
  }
}

/**
 * Handles a "Method not found" error by attempting discovery
 *
 * This is the main entry point for the interceptor. It:
 * 1. Checks if the error is a method not found error
 * 2. Builds a discovery context
 * 3. Attempts to discover and install the missing tool
 * 4. Returns whether a retry should be attempted
 *
 * @param response - The upstream response
 * @param request - The original request
 * @param userId - The user's ID
 * @param retryCount - Current retry attempt number
 * @returns Object indicating whether to retry and the discovery result
 */
export async function handleMethodNotFound(
  response: unknown,
  request: unknown,
  userId: string,
  retryCount = 0
): Promise<{ shouldRetry: boolean; result: DiscoveryResult }> {
  // Check if this is a method not found error
  if (!isMethodNotFoundError(response)) {
    return {
      shouldRetry: false,
      result: { found: false, error: 'Not a method not found error' },
    };
  }

  // Check retry limit
  if (retryCount >= currentConfig.maxRetries) {
    log('info', 'interceptor_retry_limit_reached', { userId, retryCount });
    return {
      shouldRetry: false,
      result: { found: false, error: 'Retry limit reached' },
    };
  }

  // Build discovery context
  const context = buildDiscoveryContext(request, userId);
  if (!context) {
    log('warn', 'interceptor_no_context', { userId });
    return {
      shouldRetry: false,
      result: { found: false, error: 'Unable to build discovery context' },
    };
  }

  // Attempt discovery
  const result = await attemptDiscovery(context);

  // If tool was found and installed, we should retry
  const shouldRetry = result.found && result.installed === true;

  return { shouldRetry, result };
}

/**
 * Creates a "Method not found" JSON-RPC error response
 *
 * @param id - The request ID
 * @param method - The method that was not found
 * @param discoveryAttempted - Whether discovery was attempted
 * @returns JSON-RPC error response
 */
export function createMethodNotFoundResponse(
  id: string | number | null,
  method: string,
  discoveryAttempted = false
): JsonRpcErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
      message: 'Method not found',
      data: {
        method,
        discoveryAttempted,
        hint: discoveryAttempted
          ? 'No matching tool was found in the registry.'
          : 'Tool discovery was not attempted.',
      },
    },
  };
}

// =============================================================================
// RETRY MECHANISM
// =============================================================================

/**
 * Retry context stored in request for tracking retries
 */
export interface RetryContext {
  /** Number of times this request has been retried */
  retryCount: number;
  /** Original request body */
  originalRequest: unknown;
  /** Tool that was installed (if any) */
  installedToolId?: string;
  /** Whether discovery was attempted */
  discoveryAttempted: boolean;
}

/**
 * Symbol for storing retry context on request
 */
export const RETRY_CONTEXT_KEY = Symbol('discoveryRetryContext');

/**
 * Request handler type for replay
 */
export type RequestHandler = (
  request: unknown,
  context: { userId: string; retryCount: number }
) => Promise<unknown>;

/**
 * Registered request handler for retry
 */
let requestHandler: RequestHandler | null = null;

/**
 * Registers the request handler for retry mechanism
 *
 * @param handler - The handler to call when retrying a request
 */
export function registerRequestHandler(handler: RequestHandler): void {
  requestHandler = handler;
}

/**
 * Clears the registered request handler
 */
export function clearRequestHandler(): void {
  requestHandler = null;
}

/**
 * Gets or creates retry context for a request
 *
 * @param request - The request object
 * @returns The retry context
 */
export function getRetryContext(request: unknown): RetryContext {
  if (!request || typeof request !== 'object') {
    return {
      retryCount: 0,
      originalRequest: request,
      discoveryAttempted: false,
    };
  }

  const req = request as Record<string | symbol, unknown>;
  if (req[RETRY_CONTEXT_KEY]) {
    return req[RETRY_CONTEXT_KEY] as RetryContext;
  }

  const context: RetryContext = {
    retryCount: 0,
    originalRequest: request,
    discoveryAttempted: false,
  };

  req[RETRY_CONTEXT_KEY] = context;
  return context;
}

/**
 * Increments retry count and checks if retry is allowed
 *
 * @param context - The retry context
 * @returns true if retry is allowed
 */
export function canRetry(context: RetryContext): boolean {
  return context.retryCount < currentConfig.maxRetries;
}

/**
 * Processes a request with automatic discovery and retry on method not found.
 *
 * This is the main entry point for the retry mechanism:
 * 1. Executes the request
 * 2. If "method not found" error, attempts discovery
 * 3. If tool installed, retries the request
 * 4. Returns final response
 *
 * @param request - The JSON-RPC request body
 * @param userId - The user's ID
 * @param executeRequest - Function to execute the request
 * @returns The final response after potential retry
 */
export async function processWithDiscovery(
  request: unknown,
  userId: string,
  executeRequest: (req: unknown) => Promise<unknown>
): Promise<unknown> {
  const context = getRetryContext(request);

  log('info', 'interceptor_process_start', {
    userId,
    retryCount: context.retryCount,
    method: extractMethodName(request),
  });

  // Execute the request
  let response: unknown;
  try {
    response = await executeRequest(request);
  } catch (err) {
    // If execution throws, wrap it as an error response
    log('error', 'interceptor_execution_error', {
      userId,
      error: (err as Error).message,
    });
    throw err;
  }

  // Check if it's a method not found error
  if (!isMethodNotFoundError(response)) {
    // Not a method not found error, return as-is
    return response;
  }

  log('info', 'interceptor_method_not_found', {
    userId,
    method: extractMethodName(request),
    retryCount: context.retryCount,
  });

  // Check if we can retry
  if (!canRetry(context)) {
    log('info', 'interceptor_retry_exhausted', {
      userId,
      retryCount: context.retryCount,
    });
    // Return modified response with discovery info
    const method = extractMethodName(request) || 'unknown';
    return createMethodNotFoundResponse(
      extractRequestId(request),
      method,
      context.discoveryAttempted
    );
  }

  // Attempt discovery
  const { shouldRetry, result } = await handleMethodNotFound(
    response,
    request,
    userId,
    context.retryCount
  );

  context.discoveryAttempted = true;

  if (!shouldRetry) {
    log('info', 'interceptor_no_retry', {
      userId,
      found: result.found,
      error: result.error,
    });
    // Discovery didn't find/install a tool, return error
    const method = extractMethodName(request) || 'unknown';
    return createMethodNotFoundResponse(extractRequestId(request), method, true);
  }

  // Tool was installed, retry the request
  context.retryCount++;
  context.installedToolId = result.toolId;

  log('info', 'interceptor_retry', {
    userId,
    retryCount: context.retryCount,
    installedToolId: result.toolId,
  });

  // Recursive call with incremented retry count
  return processWithDiscovery(request, userId, executeRequest);
}

/**
 * Express-style middleware wrapper for discovery interceptor
 *
 * This can be used to wrap the MCP request handler in the HTTP server.
 *
 * @param handler - The original request handler
 * @returns Wrapped handler with discovery capability
 */
export function withDiscoveryInterceptor(
  handler: (req: unknown, userId: string) => Promise<unknown>
): (req: unknown, userId: string) => Promise<unknown> {
  return async (req: unknown, userId: string): Promise<unknown> => {
    return processWithDiscovery(req, userId, (request) => handler(request, userId));
  };
}

