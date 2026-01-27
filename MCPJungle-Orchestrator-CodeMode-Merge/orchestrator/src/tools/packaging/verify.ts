/**
 * Package Verification
 *
 * Verifies the integrity and structure of MCP tool packages.
 *
 * @module tools/packaging/verify
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { log } from '../../obs/log.js';
import { loadS3Config, buildS3PackageKey } from '../../config/aws.js';
import { getExpectedBinaryNames } from './npm.js';

// ==============================================================================
// Types
// ==============================================================================

/**
 * Result of package verification
 */
export interface PackageVerificationResult {
  /** Whether the package is valid */
  valid: boolean;
  /** Verification checks performed */
  checks: {
    /** File exists and is readable */
    fileExists: boolean;
    /** File is a valid zip archive */
    isValidZip: boolean;
    /** Package has node_modules directory */
    hasNodeModules: boolean;
    /** Package has .bin directory with executables */
    hasBinDirectory: boolean;
    /** Expected binary was found */
    binaryFound: boolean;
    /** Hash matches expected (if provided) */
    hashMatches?: boolean;
  };
  /** File size in bytes */
  sizeBytes: number;
  /** SHA-256 hash */
  hash: string;
  /** Binary names found */
  binaries: string[];
  /** Errors encountered */
  errors: string[];
}

/**
 * Error during verification
 */
export class VerificationError extends Error {
  constructor(
    message: string,
    public readonly check: string,
    public readonly originalError?: Error
  ) {
    super(`VerificationError [${check}]: ${message}`);
    this.name = 'VerificationError';
  }
}

// ==============================================================================
// Local Package Verification
// ==============================================================================

/**
 * Verifies a local package file
 *
 * @param zipPath - Path to the zip file
 * @param toolName - Expected tool name
 * @param expectedHash - Expected SHA-256 hash (optional)
 * @returns Verification result
 */
export async function verifyPackage(
  zipPath: string,
  toolName: string,
  expectedHash?: string
): Promise<PackageVerificationResult> {
  const result: PackageVerificationResult = {
    valid: false,
    checks: {
      fileExists: false,
      isValidZip: false,
      hasNodeModules: false,
      hasBinDirectory: false,
      binaryFound: false,
    },
    sizeBytes: 0,
    hash: '',
    binaries: [],
    errors: [],
  };

  log('info', 'verify_package_start', { zipPath, toolName });

  try {
    // 1. Check file exists
    const stats = await fs.stat(zipPath);
    result.checks.fileExists = true;
    result.sizeBytes = stats.size;

    // 2. Calculate hash
    const content = await fs.readFile(zipPath);
    result.hash = createHash('sha256').update(content).digest('hex');

    // 3. Check hash if provided
    if (expectedHash) {
      result.checks.hashMatches = result.hash === expectedHash;
      if (!result.checks.hashMatches) {
        result.errors.push(
          `Hash mismatch: expected ${expectedHash.slice(0, 16)}..., got ${result.hash.slice(0, 16)}...`
        );
      }
    }

    // 4. Verify zip magic bytes
    const isZip =
      content[0] === 0x50 &&
      content[1] === 0x4b &&
      content[2] === 0x03 &&
      content[3] === 0x04;
    result.checks.isValidZip = isZip;

    if (!isZip) {
      result.errors.push('File is not a valid ZIP archive');
    }

    // 5. Use unzip to list contents (without extracting)
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`unzip -l "${zipPath}"`, {
        maxBuffer: 10 * 1024 * 1024,
      });

      // Check for node_modules
      result.checks.hasNodeModules = stdout.includes('node_modules/');

      // Check for .bin directory
      result.checks.hasBinDirectory = stdout.includes('node_modules/.bin/');

      // Check for expected binaries
      const expectedNames = getExpectedBinaryNames(toolName);
      for (const name of expectedNames) {
        if (stdout.includes(`node_modules/.bin/${name}`)) {
          result.binaries.push(name);
        }
      }

      result.checks.binaryFound = result.binaries.length > 0;

      if (!result.checks.binaryFound) {
        // List all binaries found
        const binMatch = stdout.match(/node_modules\/\.bin\/([^\s/]+)/g);
        if (binMatch) {
          const allBinaries = binMatch.map((m) =>
            m.replace('node_modules/.bin/', '')
          );
          result.binaries = [...new Set(allBinaries)];
          result.errors.push(
            `Expected binary for '${toolName}' not found. Available: ${result.binaries.join(', ')}`
          );
        } else {
          result.errors.push('No binaries found in node_modules/.bin/');
        }
      }
    } catch (err) {
      result.errors.push(`Failed to read zip contents: ${(err as Error).message}`);
    }

    // Determine overall validity
    result.valid =
      result.checks.fileExists &&
      result.checks.isValidZip &&
      result.checks.hasNodeModules &&
      result.checks.binaryFound &&
      (expectedHash === undefined || result.checks.hashMatches === true);

    log('info', 'verify_package_complete', {
      zipPath,
      toolName,
      valid: result.valid,
      errors: result.errors,
    });

    return result;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;

    if (error.code === 'ENOENT') {
      result.errors.push(`File not found: ${zipPath}`);
    } else {
      result.errors.push(`Verification failed: ${error.message}`);
    }

    log('error', 'verify_package_failed', {
      zipPath,
      toolName,
      error: error.message,
    });

    return result;
  }
}

// ==============================================================================
// S3 Package Verification
// ==============================================================================

/**
 * Verifies a package exists in S3 and retrieves its metadata
 *
 * @param toolName - Tool name
 * @param version - Tool version
 * @returns Verification result with S3 metadata
 */
export async function verifyS3Package(
  toolName: string,
  version: string = 'latest'
): Promise<{
  exists: boolean;
  sizeBytes: number;
  etag: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}> {
  const s3Config = loadS3Config();
  if (!s3Config) {
    return { exists: false, sizeBytes: 0, etag: '' };
  }

  const key = buildS3PackageKey(toolName, version, s3Config.packagePrefix);

  log('info', 'verify_s3_package_start', {
    bucket: s3Config.bucket,
    key,
  });

  try {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({ region: s3Config.region });
    const command = new HeadObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    const response = await client.send(command);

    log('info', 'verify_s3_package_found', {
      bucket: s3Config.bucket,
      key,
      sizeBytes: response.ContentLength,
      etag: response.ETag,
    });

    return {
      exists: true,
      sizeBytes: response.ContentLength || 0,
      etag: response.ETag || '',
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  } catch (err) {
    const error = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } };

    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      log('info', 'verify_s3_package_not_found', {
        bucket: s3Config.bucket,
        key,
      });
      return { exists: false, sizeBytes: 0, etag: '' };
    }

    log('error', 'verify_s3_package_error', {
      bucket: s3Config.bucket,
      key,
      error: error.message,
    });

    throw new VerificationError(
      `S3 verification failed: ${error.message}`,
      's3_head',
      error
    );
  }
}

// ==============================================================================
// Quick Validation Functions
// ==============================================================================

/**
 * Quick check if a file is a valid zip
 */
export async function isValidZipFile(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(4);
    await fd.read(buffer, 0, 4, 0);
    await fd.close();

    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  } catch {
    return false;
  }
}

/**
 * Gets the hash of a file
 */
export async function getFileHash(
  filePath: string,
  algorithm: string = 'sha256'
): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash(algorithm).update(content).digest('hex');
}
