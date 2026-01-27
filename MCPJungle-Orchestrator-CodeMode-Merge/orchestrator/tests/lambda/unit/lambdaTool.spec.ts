/**
 * Unit Tests - Lambda Tool Provisioner
 *
 * Tests for the Lambda tool provisioning functionality.
 *
 * @module tests/lambda/unit/lambdaTool.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockLambdaConfig,
  mockS3Config,
  mockTool,
  setupFetchMock,
  mockS3Client,
} from '../setup.js';

// Mock the config module
vi.mock('../../../src/config/aws.js', () => ({
  loadLambdaConfig: vi.fn(() => mockLambdaConfig),
  loadS3Config: vi.fn(() => mockS3Config),
  isLambdaConfigValid: vi.fn((config) => !!config.functionUrl && !!config.s3Bucket),
  buildLambdaToolUrl: vi.fn((baseUrl, toolName, version) => 
    `${baseUrl}?tool=${toolName}&version=${version}`
  ),
  buildS3PackageKey: vi.fn((toolName, version, prefix) => 
    `${prefix}${toolName}/${version}.zip`
  ),
}));

// Mock the log module
vi.mock('../../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => mockS3Client),
  HeadObjectCommand: vi.fn(),
}));

describe('Lambda Tool Provisioner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeToolName', () => {
    it('should convert to lowercase', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      expect(sanitizeToolName('MyTool')).toBe('mytool');
    });

    it('should replace special characters with hyphens', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      expect(sanitizeToolName('my_tool@v1')).toBe('my-tool-v1');
    });

    it('should remove leading and trailing hyphens', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      expect(sanitizeToolName('-my-tool-')).toBe('my-tool');
    });

    it('should collapse multiple hyphens', async () => {
      const { sanitizeToolName } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      expect(sanitizeToolName('my---tool')).toBe('my-tool');
    });
  });

  describe('isLambdaCompatible', () => {
    it('should return true for tools with id and name', async () => {
      const { isLambdaCompatible } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      expect(isLambdaCompatible(mockTool)).toBe(true);
    });

    it('should return false for tools without id', async () => {
      const { isLambdaCompatible } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      expect(isLambdaCompatible({ ...mockTool, id: undefined } as any)).toBe(false);
    });

    it('should return false for tools without name', async () => {
      const { isLambdaCompatible } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      expect(isLambdaCompatible({ ...mockTool, name: undefined } as any)).toBe(false);
    });
  });

  describe('getLambdaConfigStatus', () => {
    it('should return configuration status', async () => {
      const { getLambdaConfigStatus } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      const status = getLambdaConfigStatus();
      
      expect(status).toMatchObject({
        configured: true,
        hasRegion: true,
        hasFunctionUrl: true,
        hasS3Bucket: true,
      });
    });
  });

  describe('provisionToolLambda', () => {
    it('should provision a tool successfully with skipVerification', async () => {
      const { provisionToolLambda, clearProvisionedToolsCache } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      clearProvisionedToolsCache();
      
      const result = await provisionToolLambda('user-123', mockTool, {
        skipVerification: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.toolId).toBe(mockTool.id);
      expect(result.lambdaUrl).toContain('test-tool');
      expect(result.s3Key).toContain('test-tool');
    });

    it('should cache provisioned tools', async () => {
      const { 
        provisionToolLambda, 
        getProvisionedTool,
        clearProvisionedToolsCache 
      } = await import('../../../src/discovery/provisioning/lambdaTool.js');
      
      clearProvisionedToolsCache();
      
      await provisionToolLambda('user-123', mockTool, { skipVerification: true });
      
      const cached = getProvisionedTool('user-123', mockTool.id);
      
      expect(cached).not.toBeNull();
      expect(cached?.toolName).toBe('test-tool');
    });

    it('should return different URLs for different versions', async () => {
      const { provisionToolLambda, clearProvisionedToolsCache } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      clearProvisionedToolsCache();
      
      const result1 = await provisionToolLambda('user-123', mockTool, {
        version: 'v1.0.0',
        skipVerification: true,
      });
      
      const result2 = await provisionToolLambda('user-456', mockTool, {
        version: 'v2.0.0',
        skipVerification: true,
      });
      
      expect(result1.lambdaUrl).toContain('v1.0.0');
      expect(result2.lambdaUrl).toContain('v2.0.0');
    });
  });

  describe('deprovisionToolLambda', () => {
    it('should remove provisioned tool from cache', async () => {
      const { 
        provisionToolLambda, 
        deprovisionToolLambda,
        getProvisionedTool,
        clearProvisionedToolsCache 
      } = await import('../../../src/discovery/provisioning/lambdaTool.js');
      
      clearProvisionedToolsCache();
      
      await provisionToolLambda('user-123', mockTool, { skipVerification: true });
      
      expect(getProvisionedTool('user-123', mockTool.id)).not.toBeNull();
      
      const removed = deprovisionToolLambda('user-123', mockTool.id);
      
      expect(removed).toBe(true);
      expect(getProvisionedTool('user-123', mockTool.id)).toBeNull();
    });

    it('should return false if tool was not provisioned', async () => {
      const { deprovisionToolLambda, clearProvisionedToolsCache } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      clearProvisionedToolsCache();
      
      const removed = deprovisionToolLambda('user-123', 'nonexistent');
      
      expect(removed).toBe(false);
    });
  });

  describe('getUserProvisionedTools', () => {
    it('should return all tools for a user', async () => {
      const { 
        provisionToolLambda, 
        getUserProvisionedTools,
        clearProvisionedToolsCache 
      } = await import('../../../src/discovery/provisioning/lambdaTool.js');
      
      clearProvisionedToolsCache();
      
      const tool1 = { ...mockTool, id: 'tool-1', name: 'tool-one' };
      const tool2 = { ...mockTool, id: 'tool-2', name: 'tool-two' };
      
      await provisionToolLambda('user-123', tool1, { skipVerification: true });
      await provisionToolLambda('user-123', tool2, { skipVerification: true });
      await provisionToolLambda('user-456', mockTool, { skipVerification: true });
      
      const userTools = getUserProvisionedTools('user-123');
      
      expect(userTools).toHaveLength(2);
      expect(userTools.map(t => t.toolId)).toContain('tool-1');
      expect(userTools.map(t => t.toolId)).toContain('tool-2');
    });

    it('should return empty array for user with no tools', async () => {
      const { getUserProvisionedTools, clearProvisionedToolsCache } = await import(
        '../../../src/discovery/provisioning/lambdaTool.js'
      );
      
      clearProvisionedToolsCache();
      
      const userTools = getUserProvisionedTools('nonexistent-user');
      
      expect(userTools).toHaveLength(0);
    });
  });
});
