/**
 * S3 Package Storage
 *
 * Handles uploading and downloading MCP tool packages to/from S3.
 *
 * @module tools/packaging/s3
 */

import { promises as fs } from 'fs';
import { log } from '../../obs/log.js';
import { loadS3Config, buildS3PackageKey } from '../../config/aws.js';

// ==============================================================================
// Types
// ==============================================================================

/**
 * Options for uploading to S3
 */
export interface S3UploadOptions {
  /** Local path to the zip file */
  filePath: string;
  /** Tool name */
  toolName: string;
  /** Tool version */
  version?: string;
  /** Custom S3 bucket (default: from config) */
  bucket?: string;
  /** Content type (default: 'application/zip') */
  contentType?: string;
  /** Metadata to attach */
  metadata?: Record<string, string>;
}

/**
 * Result of an S3 upload
 */
export interface S3UploadResult {
  /** Whether upload was successful */
  success: boolean;
  /** S3 bucket */
  bucket: string;
  /** S3 object key */
  key: string;
  /** Full S3 URI */
  uri: string;
  /** ETag from S3 */
  etag?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * S3 package info
 */
export interface S3PackageInfo {
  /** Tool name */
  toolName: string;
  /** Version */
  version: string;
  /** S3 key */
  key: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Last modified date */
  lastModified: Date;
  /** ETag */
  etag: string;
}

/**
 * Error thrown during S3 operations
 */
export class S3Error extends Error {
  constructor(
    message: string,
    public readonly operation: 'upload' | 'download' | 'list' | 'delete' | 'head',
    public readonly key?: string,
    public readonly originalError?: Error
  ) {
    super(`S3Error [${operation}]: ${message}`);
    this.name = 'S3Error';
  }
}

// ==============================================================================
// Upload Functions
// ==============================================================================

/**
 * Uploads a package to S3
 *
 * @param options - Upload options
 * @returns Upload result
 */
export async function uploadToS3(options: S3UploadOptions): Promise<S3UploadResult> {
  const {
    filePath,
    toolName,
    version = 'latest',
    contentType = 'application/zip',
    metadata = {},
  } = options;

  const s3Config = loadS3Config();
  if (!s3Config) {
    return {
      success: false,
      bucket: '',
      key: '',
      uri: '',
      error: 'S3 not configured. Set AWS_LAMBDA_S3_BUCKET environment variable.',
    };
  }

  const bucket = options.bucket ?? s3Config.bucket;
  const key = buildS3PackageKey(toolName, version, s3Config.packagePrefix);

  log('info', 's3_upload_start', {
    filePath,
    bucket,
    key,
    toolName,
    version,
  });

  try {
    // Read file content
    const fileContent = await fs.readFile(filePath);

    // Dynamic import to avoid bundling issues
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({ region: s3Config.region });
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        'tool-name': toolName,
        'tool-version': version,
        'packaged-at': new Date().toISOString(),
        ...metadata,
      },
    });

    const response = await client.send(command);

    const uri = `s3://${bucket}/${key}`;

    log('info', 's3_upload_success', {
      bucket,
      key,
      uri,
      etag: response.ETag,
    });

    return {
      success: true,
      bucket,
      key,
      uri,
      etag: response.ETag,
    };
  } catch (err) {
    const error = err as Error;

    log('error', 's3_upload_failed', {
      bucket,
      key,
      error: error.message,
    });

    return {
      success: false,
      bucket,
      key,
      uri: '',
      error: error.message,
    };
  }
}

// ==============================================================================
// Download Functions
// ==============================================================================

/**
 * Downloads a package from S3
 *
 * @param toolName - Tool name
 * @param version - Tool version
 * @param outputPath - Local path to save the file
 * @returns Path to downloaded file
 */
export async function downloadFromS3(
  toolName: string,
  version: string = 'latest',
  outputPath: string
): Promise<string> {
  const s3Config = loadS3Config();
  if (!s3Config) {
    throw new S3Error('S3 not configured', 'download');
  }

  const key = buildS3PackageKey(toolName, version, s3Config.packagePrefix);

  log('info', 's3_download_start', {
    bucket: s3Config.bucket,
    key,
    outputPath,
  });

  try {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({ region: s3Config.region });
    const command = new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    await fs.writeFile(outputPath, buffer);

    log('info', 's3_download_success', {
      bucket: s3Config.bucket,
      key,
      outputPath,
      sizeBytes: buffer.length,
    });

    return outputPath;
  } catch (err) {
    const error = err as Error;

    log('error', 's3_download_failed', {
      bucket: s3Config.bucket,
      key,
      error: error.message,
    });

    throw new S3Error(
      `Failed to download package: ${error.message}`,
      'download',
      key,
      error
    );
  }
}

// ==============================================================================
// Query Functions
// ==============================================================================

/**
 * Checks if a package exists in S3
 *
 * @param toolName - Tool name
 * @param version - Tool version
 * @returns true if package exists
 */
export async function packageExistsInS3(
  toolName: string,
  version: string = 'latest'
): Promise<boolean> {
  const s3Config = loadS3Config();
  if (!s3Config) {
    return false;
  }

  const key = buildS3PackageKey(toolName, version, s3Config.packagePrefix);

  try {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({ region: s3Config.region });
    const command = new HeadObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (err) {
    const error = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } };

    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }

    log('warn', 's3_exists_check_error', {
      bucket: s3Config.bucket,
      key,
      error: error.message,
    });

    return false;
  }
}

/**
 * Lists all package versions for a tool
 *
 * @param toolName - Tool name
 * @returns Array of package info
 */
export async function listS3Packages(toolName?: string): Promise<S3PackageInfo[]> {
  const s3Config = loadS3Config();
  if (!s3Config) {
    return [];
  }

  const prefix = toolName
    ? `${s3Config.packagePrefix}${toolName}/`
    : s3Config.packagePrefix;

  try {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const client = new S3Client({ region: s3Config.region });
    const command = new ListObjectsV2Command({
      Bucket: s3Config.bucket,
      Prefix: prefix,
    });

    const response = await client.send(command);
    const packages: S3PackageInfo[] = [];

    for (const obj of response.Contents || []) {
      if (!obj.Key) continue;

      // Parse key: packages/{toolName}/{version}.zip
      const match = obj.Key.match(/packages\/([^/]+)\/([^/]+)\.zip$/);
      if (match) {
        packages.push({
          toolName: match[1],
          version: match[2],
          key: obj.Key,
          sizeBytes: obj.Size || 0,
          lastModified: obj.LastModified || new Date(),
          etag: obj.ETag || '',
        });
      }
    }

    return packages;
  } catch (err) {
    log('error', 's3_list_failed', {
      prefix,
      error: (err as Error).message,
    });

    return [];
  }
}

/**
 * Deletes a package from S3
 *
 * @param toolName - Tool name
 * @param version - Tool version
 * @returns true if deleted successfully
 */
export async function deleteS3Package(
  toolName: string,
  version: string = 'latest'
): Promise<boolean> {
  const s3Config = loadS3Config();
  if (!s3Config) {
    return false;
  }

  const key = buildS3PackageKey(toolName, version, s3Config.packagePrefix);

  log('info', 's3_delete_start', {
    bucket: s3Config.bucket,
    key,
  });

  try {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({ region: s3Config.region });
    const command = new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    await client.send(command);

    log('info', 's3_delete_success', {
      bucket: s3Config.bucket,
      key,
    });

    return true;
  } catch (err) {
    log('error', 's3_delete_failed', {
      bucket: s3Config.bucket,
      key,
      error: (err as Error).message,
    });

    return false;
  }
}
