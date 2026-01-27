/**
 * Integration Tests - Discovery to Lambda Flow
 *
 * Tests for Lambda configuration utilities and flow helpers.
 * These tests focus on utility functions that don't require
 * full configuration loading.
 *
 * @module tests/lambda/integration/discovery_flow.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the log module
vi.mock('../../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

// ==============================================================================
// Utility Function Tests
// ==============================================================================

describe('Lambda Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tool Name Sanitization', () => {
    it('should remove @ symbol from scoped packages', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      const result = sanitizeToolName('@org/package-name');
      expect(result).not.toContain('@');
      expect(result).not.toContain('/');
    });

    it('should handle simple tool names', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      const result = sanitizeToolName('simple-tool');
      expect(result).toBe('simple-tool');
    });

    it('should handle dots in names', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      const result = sanitizeToolName('tool.with.dots');
      expect(result).not.toContain('.');
    });

    it('should handle spaces in names', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      const result = sanitizeToolName('Tool With Spaces');
      expect(result).not.toContain(' ');
    });

    it('should produce valid Lambda function name characters', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      const result = sanitizeToolName('@org/my-tool_v2.0');
      // Lambda function names can contain: a-z, A-Z, 0-9, -, _
      expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('Lambda Compatibility Check', () => {
    it('should return true for tool with id and name', async () => {
      const { isLambdaCompatible } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      const tool = { id: 'test-id', name: 'test-tool' };
      expect(isLambdaCompatible(tool)).toBe(true);
    });

    it('should return false for tool without id', async () => {
      const { isLambdaCompatible } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      const tool = { name: 'test-tool' } as any;
      expect(isLambdaCompatible(tool)).toBe(false);
    });

    it('should return false for tool without name', async () => {
      const { isLambdaCompatible } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      const tool = { id: 'test-id' } as any;
      expect(isLambdaCompatible(tool)).toBe(false);
    });
  });

  describe('Provisioned Tools Cache', () => {
    it('should return empty array for unknown user', async () => {
      const { getUserProvisionedTools, clearProvisionedToolsCache } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      clearProvisionedToolsCache();
      const tools = getUserProvisionedTools('nonexistent-user');
      
      expect(tools).toEqual([]);
    });

    it('should return null for unknown tool', async () => {
      const { getProvisionedTool, clearProvisionedToolsCache } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      clearProvisionedToolsCache();
      const tool = getProvisionedTool('user1', 'nonexistent-tool');
      
      expect(tool).toBeNull();
    });

    it('should clear cache without error', async () => {
      const { clearProvisionedToolsCache, getUserProvisionedTools } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );

      // Should not throw
      expect(() => clearProvisionedToolsCache()).not.toThrow();
      
      const tools = getUserProvisionedTools('anyUser');
      expect(tools).toEqual([]);
    });
  });
});

// ==============================================================================
// Lambda URL Building Tests
// ==============================================================================

describe('Lambda URL Building', () => {
  describe('buildLambdaToolUrl', () => {
    it('should build correct URL with tool and version', async () => {
      const { buildLambdaToolUrl } = await import(
        '../../../src/config/aws.js'
      );

      const baseUrl = 'https://abc123.lambda-url.us-east-1.on.aws';
      const url = buildLambdaToolUrl(baseUrl, 'my-tool', 'v1.0.0');

      expect(url).toContain('tool=my-tool');
      expect(url).toContain('version=v1.0.0');
      expect(url.startsWith(baseUrl)).toBe(true);
    });

    it('should use latest as default version', async () => {
      const { buildLambdaToolUrl } = await import(
        '../../../src/config/aws.js'
      );

      const baseUrl = 'https://abc123.lambda-url.us-east-1.on.aws';
      const url = buildLambdaToolUrl(baseUrl, 'my-tool');

      expect(url).toContain('tool=my-tool');
      expect(url).toContain('version=latest');
    });

    it('should URL-encode special characters in tool name', async () => {
      const { buildLambdaToolUrl } = await import(
        '../../../src/config/aws.js'
      );

      const baseUrl = 'https://test.lambda-url.aws';
      const url = buildLambdaToolUrl(baseUrl, '@org/tool-name', 'v1');

      expect(url).toContain(encodeURIComponent('@org/tool-name'));
    });

    it('should handle base URL with trailing slash', async () => {
      const { buildLambdaToolUrl } = await import(
        '../../../src/config/aws.js'
      );

      const baseUrl = 'https://test.lambda-url.aws/';
      const url = buildLambdaToolUrl(baseUrl, 'tool', 'v1');

      // Should contain the query params correctly
      expect(url).toContain('tool=tool');
      expect(url).toContain('version=v1');
    });
  });

  describe('buildS3PackageKey', () => {
    it('should build correct S3 key', async () => {
      const { buildS3PackageKey } = await import(
        '../../../src/config/aws.js'
      );

      const key = buildS3PackageKey('my-tool', 'v1.0.0');

      expect(key).toBe('packages/my-tool/v1.0.0.zip');
    });

    it('should use latest when version not specified', async () => {
      const { buildS3PackageKey } = await import(
        '../../../src/config/aws.js'
      );

      const key = buildS3PackageKey('my-tool');

      expect(key).toBe('packages/my-tool/latest.zip');
    });

    it('should handle scoped package names', async () => {
      const { buildS3PackageKey } = await import(
        '../../../src/config/aws.js'
      );

      const key = buildS3PackageKey('@org/my-tool', 'v1.0.0');

      // Should preserve the package name as-is in the key
      expect(key).toContain('my-tool');
      expect(key).toContain('v1.0.0.zip');
    });
  });

  describe('parseLambdaToolUrl', () => {
    it('should parse tool and version from URL', async () => {
      const { parseLambdaToolUrl } = await import(
        '../../../src/config/aws.js'
      );

      const url = 'https://test.lambda-url.aws?tool=my-tool&version=v1.0.0';
      const parsed = parseLambdaToolUrl(url);

      expect(parsed.toolName).toBe('my-tool');
      expect(parsed.version).toBe('v1.0.0');
    });

    it('should handle URL-encoded tool names', async () => {
      const { parseLambdaToolUrl } = await import(
        '../../../src/config/aws.js'
      );

      const encodedTool = encodeURIComponent('@org/tool-name');
      const url = `https://test.lambda-url.aws?tool=${encodedTool}&version=v1`;
      const parsed = parseLambdaToolUrl(url);

      expect(parsed.toolName).toBe('@org/tool-name');
    });

    it('should default version to latest when not provided', async () => {
      const { parseLambdaToolUrl } = await import(
        '../../../src/config/aws.js'
      );

      const url = 'https://test.lambda-url.aws?tool=my-tool';
      const parsed = parseLambdaToolUrl(url);

      expect(parsed.version).toBe('latest');
    });
  });
});

// ==============================================================================
// Config Validation Tests (without requiring full config load)
// ==============================================================================

describe('Lambda Config Validation', () => {
  describe('isLambdaConfigValid', () => {
    it('should return true when function URL is set', async () => {
      const { isLambdaConfigValid } = await import(
        '../../../src/config/aws.js'
      );

      const config = {
        region: 'us-east-1',
        functionUrl: 'https://test.lambda-url.aws',
        s3Bucket: 'bucket',
        roleArn: 'arn:aws:iam::123:role/test',
      };

      expect(isLambdaConfigValid(config)).toBe(true);
    });

    it('should return false when function URL is empty', async () => {
      const { isLambdaConfigValid } = await import(
        '../../../src/config/aws.js'
      );

      const config = {
        region: 'us-east-1',
        functionUrl: '',
        s3Bucket: 'bucket',
        roleArn: 'arn:aws:iam::123:role/test',
      };

      expect(isLambdaConfigValid(config)).toBe(false);
    });

    it('should return false when function URL is undefined', async () => {
      const { isLambdaConfigValid } = await import(
        '../../../src/config/aws.js'
      );

      const config = {
        region: 'us-east-1',
        functionUrl: undefined as any,
        s3Bucket: 'bucket',
        roleArn: 'arn:aws:iam::123:role/test',
      };

      expect(isLambdaConfigValid(config)).toBe(false);
    });
  });
});
