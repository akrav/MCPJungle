/**
 * Unit Tests - Tool Packaging
 *
 * Tests for the NPM package handling and verification.
 *
 * @module tests/lambda/unit/packaging.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the log module
vi.mock('../../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

describe('Tool Packaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('deriveToolName', () => {
    it('should remove npm scope', async () => {
      const { deriveToolName } = await import(
        '../../../src/tools/packaging/npm.js'
      );
      
      expect(deriveToolName('@upstash/context7-mcp')).toBe('context7');
    });

    it('should remove mcp-server- prefix', async () => {
      const { deriveToolName } = await import(
        '../../../src/tools/packaging/npm.js'
      );
      
      expect(deriveToolName('mcp-server-filesystem')).toBe('filesystem');
    });

    it('should remove mcp- prefix', async () => {
      const { deriveToolName } = await import(
        '../../../src/tools/packaging/npm.js'
      );
      
      expect(deriveToolName('mcp-sqlite')).toBe('sqlite');
    });

    it('should remove -mcp suffix', async () => {
      const { deriveToolName } = await import(
        '../../../src/tools/packaging/npm.js'
      );
      
      expect(deriveToolName('context7-mcp')).toBe('context7');
    });

    it('should remove -server suffix', async () => {
      const { deriveToolName } = await import(
        '../../../src/tools/packaging/npm.js'
      );
      
      expect(deriveToolName('filesystem-server')).toBe('filesystem');
    });

    it('should handle complex package names', async () => {
      const { deriveToolName } = await import(
        '../../../src/tools/packaging/npm.js'
      );
      
      expect(deriveToolName('@anthropic/mcp-server-sqlite-mcp')).toBe('sqlite');
    });
  });

  describe('getExpectedBinaryNames', () => {
    it('should return expected binary patterns', async () => {
      const { getExpectedBinaryNames } = await import(
        '../../../src/tools/packaging/npm.js'
      );
      
      const names = getExpectedBinaryNames('context7');
      
      expect(names).toContain('context7-mcp');
      expect(names).toContain('context7');
      expect(names).toContain('mcp-context7');
      expect(names).toContain('mcp-server-context7');
    });
  });
});

describe('Package Verification', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create a real temp file for testing
    tempDir = await fs.mkdtemp(join(tmpdir(), 'lambda-test-'));
    testFile = join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'test content');
  });

  afterEach(async () => {
    // Cleanup temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getFileHash', () => {
    it('should calculate SHA-256 hash of a real file', async () => {
      const { getFileHash } = await import(
        '../../../src/tools/packaging/verify.js'
      );
      
      const hash = await getFileHash(testFile);
      
      // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      // Known hash for 'test content'
      expect(hash).toBe('6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72');
    });

    it('should produce different hashes for different content', async () => {
      const { getFileHash } = await import(
        '../../../src/tools/packaging/verify.js'
      );
      
      const file2 = join(tempDir, 'test2.txt');
      await fs.writeFile(file2, 'different content');
      
      const hash1 = await getFileHash(testFile);
      const hash2 = await getFileHash(file2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isValidZipFile', () => {
    it('should return true for valid zip magic bytes', async () => {
      const { isValidZipFile } = await import(
        '../../../src/tools/packaging/verify.js'
      );
      
      // Create a file with ZIP magic bytes
      const zipFile = join(tempDir, 'test.zip');
      // PK\x03\x04 is the ZIP magic number
      await fs.writeFile(zipFile, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
      
      const isValid = await isValidZipFile(zipFile);
      expect(isValid).toBe(true);
    });

    it('should return false for non-zip files', async () => {
      const { isValidZipFile } = await import(
        '../../../src/tools/packaging/verify.js'
      );
      
      const isValid = await isValidZipFile(testFile);
      expect(isValid).toBe(false);
    });

    it('should return false for non-existent files', async () => {
      const { isValidZipFile } = await import(
        '../../../src/tools/packaging/verify.js'
      );
      
      const isValid = await isValidZipFile('/non/existent/file.zip');
      expect(isValid).toBe(false);
    });
  });
});

describe('S3 Package Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('S3Error', () => {
    it('should include operation and key in message', async () => {
      const { S3Error } = await import(
        '../../../src/tools/packaging/s3.js'
      );
      
      const error = new S3Error('Not found', 'download', 'packages/test/latest.zip');
      
      expect(error.message).toContain('download');
      expect(error.operation).toBe('download');
      expect(error.key).toBe('packages/test/latest.zip');
    });

    it('should store original error when provided', async () => {
      const { S3Error } = await import(
        '../../../src/tools/packaging/s3.js'
      );
      
      const originalError = new Error('Network failure');
      const error = new S3Error('Upload failed', 'upload', 'key', originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });
});
