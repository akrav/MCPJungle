/**
 * Tool Packaging Module
 *
 * Provides utilities for packaging MCP tools for Lambda deployment.
 * This module handles:
 * - NPM package installation
 * - Zip archive creation with symlink preservation
 * - S3 upload for Lambda consumption
 *
 * @module tools/packaging
 */

export {
  packageTool,
  PackageOptions,
  PackageResult,
  PackageError,
} from './npm.js';

export {
  uploadToS3,
  downloadFromS3,
  packageExistsInS3,
  listS3Packages,
  deleteS3Package,
  S3UploadOptions,
  S3UploadResult,
  S3Error,
} from './s3.js';

export {
  verifyPackage,
  verifyS3Package as verifyS3PackageIntegrity,
  PackageVerificationResult,
  VerificationError,
} from './verify.js';
