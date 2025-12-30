import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMethodNotFoundError,
  extractMethodName,
  extractRequestId,
  buildDiscoveryContext,
  attemptDiscovery,
  handleMethodNotFound,
  createMethodNotFoundResponse,
  configureInterceptor,
  resetInterceptor,
  getInterceptorConfig,
  JSON_RPC_ERRORS,
  DiscoveryResult,
  processWithDiscovery,
  getRetryContext,
  canRetry,
  withDiscoveryInterceptor,
  registerRequestHandler,
  clearRequestHandler,
  RETRY_CONTEXT_KEY,
} from '../../src/server/interceptor';

vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

describe('Discovery Interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInterceptor();
  });

  afterEach(() => {
    resetInterceptor();
  });

  describe('isMethodNotFoundError', () => {
    it('returns true for valid method not found error', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      };
      expect(isMethodNotFoundError(response)).toBe(true);
    });

    it('returns false for other error codes', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600, // Invalid Request
          message: 'Invalid Request',
        },
      };
      expect(isMethodNotFoundError(response)).toBe(false);
    });

    it('returns false for success response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: { data: 'test' },
      };
      expect(isMethodNotFoundError(response)).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isMethodNotFoundError(null)).toBe(false);
      expect(isMethodNotFoundError(undefined)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isMethodNotFoundError('string')).toBe(false);
      expect(isMethodNotFoundError(123)).toBe(false);
    });
  });

  describe('extractMethodName', () => {
    it('extracts method from valid request', () => {
      const request = { jsonrpc: '2.0', method: 'tools/call', id: 1 };
      expect(extractMethodName(request)).toBe('tools/call');
    });

    it('returns null for missing method', () => {
      const request = { jsonrpc: '2.0', id: 1 };
      expect(extractMethodName(request)).toBeNull();
    });

    it('returns null for non-object', () => {
      expect(extractMethodName(null)).toBeNull();
      expect(extractMethodName('string')).toBeNull();
    });
  });

  describe('extractRequestId', () => {
    it('extracts string id', () => {
      const request = { jsonrpc: '2.0', method: 'test', id: 'abc-123' };
      expect(extractRequestId(request)).toBe('abc-123');
    });

    it('extracts number id', () => {
      const request = { jsonrpc: '2.0', method: 'test', id: 42 };
      expect(extractRequestId(request)).toBe(42);
    });

    it('returns null for missing id', () => {
      const request = { jsonrpc: '2.0', method: 'test' };
      expect(extractRequestId(request)).toBeNull();
    });
  });

  describe('buildDiscoveryContext', () => {
    it('builds context from basic request', () => {
      const request = { jsonrpc: '2.0', method: 'weather/get', id: 1 };
      const context = buildDiscoveryContext(request, 'user-123');

      expect(context).not.toBeNull();
      expect(context?.userId).toBe('user-123');
      expect(context?.method).toBe('weather/get');
      expect(context?.intent).toBe('weather/get');
    });

    it('extracts intent from params.name', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'get_weather' },
        id: 1,
      };
      const context = buildDiscoveryContext(request, 'user-123');

      expect(context?.intent).toBe('get_weather');
    });

    it('extracts intent from params.description', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { description: 'Get current weather for a location' },
        id: 1,
      };
      const context = buildDiscoveryContext(request, 'user-123');

      expect(context?.intent).toBe('Get current weather for a location');
    });

    it('returns null for invalid request', () => {
      expect(buildDiscoveryContext(null, 'user-123')).toBeNull();
      expect(buildDiscoveryContext({}, 'user-123')).toBeNull();
    });
  });

  describe('attemptDiscovery', () => {
    it('calls discovery resolver with correct params', async () => {
      const mockResolver = vi.fn().mockResolvedValue({
        found: true,
        toolId: 'tool-123',
        toolName: 'Weather API',
        installed: true,
      });

      configureInterceptor({ discoveryResolver: mockResolver });

      const context = {
        userId: 'user-123',
        method: 'tools/call',
        intent: 'get weather',
        originalRequest: {},
        requestId: 1,
      };

      const result = await attemptDiscovery(context);

      expect(mockResolver).toHaveBeenCalledWith('user-123', 'get weather');
      expect(result.found).toBe(true);
      expect(result.toolName).toBe('Weather API');
    });

    it('returns not found when resolver returns false', async () => {
      const mockResolver = vi.fn().mockResolvedValue({ found: false });
      configureInterceptor({ discoveryResolver: mockResolver });

      const context = {
        userId: 'user-123',
        method: 'tools/call',
        intent: 'nonexistent tool',
        originalRequest: {},
        requestId: 1,
      };

      const result = await attemptDiscovery(context);

      expect(result.found).toBe(false);
    });

    it('returns error when discovery is disabled', async () => {
      configureInterceptor({ enabled: false });

      const context = {
        userId: 'user-123',
        method: 'test',
        intent: 'test',
        originalRequest: {},
        requestId: 1,
      };

      const result = await attemptDiscovery(context);

      expect(result.found).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('returns error when no resolver configured', async () => {
      configureInterceptor({ discoveryResolver: undefined });

      const context = {
        userId: 'user-123',
        method: 'test',
        intent: 'test',
        originalRequest: {},
        requestId: 1,
      };

      const result = await attemptDiscovery(context);

      expect(result.found).toBe(false);
      expect(result.error).toContain('No discovery resolver');
    });

    it('handles resolver errors gracefully', async () => {
      const mockResolver = vi.fn().mockRejectedValue(new Error('Network error'));
      configureInterceptor({ discoveryResolver: mockResolver });

      const context = {
        userId: 'user-123',
        method: 'test',
        intent: 'test',
        originalRequest: {},
        requestId: 1,
      };

      const result = await attemptDiscovery(context);

      expect(result.found).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('handleMethodNotFound', () => {
    const methodNotFoundResponse = {
      jsonrpc: '2.0' as const,
      id: 1,
      error: { code: -32601, message: 'Method not found' },
    };

    const request = {
      jsonrpc: '2.0',
      method: 'weather/get',
      id: 1,
    };

    it('triggers discovery for method not found error', async () => {
      const mockResolver = vi.fn().mockResolvedValue({
        found: true,
        toolId: 'tool-123',
        installed: true,
      });
      configureInterceptor({ discoveryResolver: mockResolver });

      const { shouldRetry, result } = await handleMethodNotFound(
        methodNotFoundResponse,
        request,
        'user-123'
      );

      expect(mockResolver).toHaveBeenCalled();
      expect(result.found).toBe(true);
      expect(shouldRetry).toBe(true);
    });

    it('returns shouldRetry=false when tool not found', async () => {
      const mockResolver = vi.fn().mockResolvedValue({ found: false });
      configureInterceptor({ discoveryResolver: mockResolver });

      const { shouldRetry, result } = await handleMethodNotFound(
        methodNotFoundResponse,
        request,
        'user-123'
      );

      expect(shouldRetry).toBe(false);
      expect(result.found).toBe(false);
    });

    it('returns shouldRetry=false when not a method not found error', async () => {
      const successResponse = { jsonrpc: '2.0', id: 1, result: {} };

      const { shouldRetry } = await handleMethodNotFound(
        successResponse,
        request,
        'user-123'
      );

      expect(shouldRetry).toBe(false);
    });

    it('respects retry limit', async () => {
      const mockResolver = vi.fn().mockResolvedValue({
        found: true,
        installed: true,
      });
      configureInterceptor({ discoveryResolver: mockResolver, maxRetries: 1 });

      // First retry (retryCount=1) should be blocked
      const { shouldRetry } = await handleMethodNotFound(
        methodNotFoundResponse,
        request,
        'user-123',
        1 // Already retried once
      );

      expect(shouldRetry).toBe(false);
      expect(mockResolver).not.toHaveBeenCalled();
    });
  });

  describe('createMethodNotFoundResponse', () => {
    it('creates proper error response', () => {
      const response = createMethodNotFoundResponse(1, 'weather/get', false);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.error.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
      expect(response.error.message).toBe('Method not found');
    });

    it('includes discovery attempt info', () => {
      const response = createMethodNotFoundResponse('abc', 'test', true);

      expect(response.error.data).toEqual({
        method: 'test',
        discoveryAttempted: true,
        hint: expect.stringContaining('No matching tool'),
      });
    });

    it('handles null id', () => {
      const response = createMethodNotFoundResponse(null, 'test', false);
      expect(response.id).toBeNull();
    });
  });

  describe('configuration', () => {
    it('configureInterceptor merges config', () => {
      configureInterceptor({ maxRetries: 5 });
      const config = getInterceptorConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.enabled).toBe(true); // Default preserved
    });

    it('resetInterceptor restores defaults', () => {
      configureInterceptor({ maxRetries: 10, enabled: false });
      resetInterceptor();
      const config = getInterceptorConfig();

      expect(config.maxRetries).toBe(1);
      expect(config.enabled).toBe(true);
    });
  });

  describe('Retry Mechanism', () => {
    const successResponse = { jsonrpc: '2.0', id: 1, result: { data: 'success' } };
    const methodNotFoundResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32601, message: 'Method not found' },
    };
    const request = { jsonrpc: '2.0', method: 'weather/get', id: 1 };

    describe('getRetryContext', () => {
      it('creates default context for new request', () => {
        const context = getRetryContext({ method: 'test' });
        expect(context.retryCount).toBe(0);
        expect(context.discoveryAttempted).toBe(false);
      });

      it('returns same context on subsequent calls', () => {
        const req = { method: 'test' };
        const context1 = getRetryContext(req);
        context1.retryCount = 5;

        const context2 = getRetryContext(req);
        expect(context2.retryCount).toBe(5);
      });

      it('handles null/undefined gracefully', () => {
        const context = getRetryContext(null);
        expect(context.retryCount).toBe(0);
      });
    });

    describe('canRetry', () => {
      it('returns true when under retry limit', () => {
        configureInterceptor({ maxRetries: 2 });
        const context = { retryCount: 0, originalRequest: {}, discoveryAttempted: false };
        expect(canRetry(context)).toBe(true);
      });

      it('returns false when at retry limit', () => {
        configureInterceptor({ maxRetries: 1 });
        const context = { retryCount: 1, originalRequest: {}, discoveryAttempted: false };
        expect(canRetry(context)).toBe(false);
      });
    });

    describe('processWithDiscovery', () => {
      it('returns successful response without discovery', async () => {
        const executeRequest = vi.fn().mockResolvedValue(successResponse);

        const result = await processWithDiscovery(request, 'user-123', executeRequest);

        expect(result).toEqual(successResponse);
        expect(executeRequest).toHaveBeenCalledTimes(1);
      });

      it('attempts discovery on method not found', async () => {
        const mockResolver = vi.fn().mockResolvedValue({
          found: true,
          toolId: 'tool-123',
          installed: true,
        });
        configureInterceptor({ discoveryResolver: mockResolver, maxRetries: 1 });

        const executeRequest = vi.fn()
          .mockResolvedValueOnce(methodNotFoundResponse)
          .mockResolvedValueOnce(successResponse);

        const result = await processWithDiscovery(request, 'user-123', executeRequest);

        expect(result).toEqual(successResponse);
        expect(executeRequest).toHaveBeenCalledTimes(2); // Original + retry
        expect(mockResolver).toHaveBeenCalled();
      });

      it('returns error after exhausting retries', async () => {
        const mockResolver = vi.fn().mockResolvedValue({
          found: true,
          toolId: 'tool-123',
          installed: true,
        });
        configureInterceptor({ discoveryResolver: mockResolver, maxRetries: 1 });

        // Keep returning method not found
        const executeRequest = vi.fn().mockResolvedValue(methodNotFoundResponse);

        const result = await processWithDiscovery(request, 'user-123', executeRequest);

        // Should get error response with discovery attempted = true
        expect(result).toHaveProperty('error');
        expect((result as any).error.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
        expect((result as any).error.data.discoveryAttempted).toBe(true);
      });

      it('returns error when discovery finds no tool', async () => {
        const mockResolver = vi.fn().mockResolvedValue({ found: false });
        configureInterceptor({ discoveryResolver: mockResolver });

        const executeRequest = vi.fn().mockResolvedValue(methodNotFoundResponse);

        const result = await processWithDiscovery(request, 'user-123', executeRequest);

        expect(result).toHaveProperty('error');
        expect((result as any).error.data.discoveryAttempted).toBe(true);
      });

      it('does not retry when tool found but not installed', async () => {
        const mockResolver = vi.fn().mockResolvedValue({
          found: true,
          toolId: 'tool-123',
          installed: false, // Not installed
        });
        configureInterceptor({ discoveryResolver: mockResolver });

        const executeRequest = vi.fn().mockResolvedValue(methodNotFoundResponse);

        const result = await processWithDiscovery(request, 'user-123', executeRequest);

        expect(executeRequest).toHaveBeenCalledTimes(1); // No retry
        expect(result).toHaveProperty('error');
      });
    });

    describe('withDiscoveryInterceptor', () => {
      it('wraps handler with discovery capability', async () => {
        const handler = vi.fn().mockResolvedValue(successResponse);
        const wrappedHandler = withDiscoveryInterceptor(handler);

        const result = await wrappedHandler(request, 'user-123');

        expect(result).toEqual(successResponse);
        expect(handler).toHaveBeenCalledWith(request, 'user-123');
      });

      it('triggers discovery on method not found', async () => {
        const mockResolver = vi.fn().mockResolvedValue({
          found: true,
          toolId: 'tool-123',
          installed: true,
        });
        configureInterceptor({ discoveryResolver: mockResolver, maxRetries: 2 });

        let callCount = 0;
        const handler = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(methodNotFoundResponse);
          }
          return Promise.resolve(successResponse);
        });

        const wrappedHandler = withDiscoveryInterceptor(handler);
        const result = await wrappedHandler(request, 'user-123');

        expect(handler).toHaveBeenCalledTimes(2);
        expect(result).toEqual(successResponse);
      });
    });
  });
});

