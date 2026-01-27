/**
 * Lambda Provisioner
 *
 * Implements the Provisioner interface for AWS Lambda-based Jungle instances.
 * This provisioner uses a shared Lambda function that dynamically loads MCP tools.
 *
 * @module provisioning/lambda
 */

import type { Provisioner } from './types.js';
import { loadLambdaConfig, type LambdaConfig } from '../config/aws.js';
import { log } from '../obs/log.js';

/**
 * Lambda Provisioner
 *
 * Unlike Docker/K8s provisioners that create isolated containers per user,
 * the Lambda provisioner uses a shared Lambda function. Tool isolation is
 * achieved at the Lambda level through separate tool packages in S3.
 *
 * For true per-user isolation, the Lambda function can be configured to
 * use different S3 paths or IAM roles per user (future enhancement).
 */
export class LambdaProvisioner implements Provisioner {
  private config: LambdaConfig;

  constructor(config?: LambdaConfig) {
    this.config = config ?? loadLambdaConfig();
  }

  /**
   * Provisions a Lambda-based Jungle instance for a user.
   *
   * Currently returns the shared Lambda function URL.
   * The Lambda function handles tool loading dynamically via query parameters.
   *
   * @param userId - The user ID to provision for
   * @returns The base URL for the Lambda function
   */
  async provision(userId: string): Promise<{ baseUrl: string }> {
    log('info', 'lambda_provisioner_provision', { userId });

    const functionUrl = this.config.functionUrl;

    if (!functionUrl) {
      throw new Error(
        'Lambda function URL not configured. Set AWS_LAMBDA_FUNCTION_URL environment variable.'
      );
    }

    log('info', 'lambda_provisioner_provision_success', {
      userId,
      functionUrl,
    });

    // For Lambda, we return the shared function URL
    // Tool-specific routing is handled via query parameters at call time
    return { baseUrl: functionUrl };
  }

  /**
   * Stops a Lambda-based Jungle instance.
   *
   * For the shared Lambda model, this is a no-op since we don't create
   * per-user Lambda functions. The Lambda function continues running
   * and serving other users.
   *
   * @param userId - The user ID to stop
   */
  async stop(userId: string): Promise<void> {
    log('info', 'lambda_provisioner_stop', { userId });
    // No-op for shared Lambda model
    // Future: If we implement per-user Lambda functions, delete them here
  }

  /**
   * Checks if the Lambda function is healthy.
   *
   * Sends a simple request to verify the Lambda function is responding.
   *
   * @param baseUrl - The Lambda function URL to check
   * @returns true if the Lambda function is healthy
   */
  async isHealthy(baseUrl: string): Promise<boolean> {
    try {
      // Send a lightweight health check request
      // Using a short timeout since Lambda should respond quickly if warm
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(baseUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Lambda returns 400 if tool parameter is missing, which is expected
      // Any response (even error) indicates the Lambda is running
      return response.status === 200 || response.status === 400;
    } catch (error) {
      log('warn', 'lambda_provisioner_health_check_failed', {
        baseUrl,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Gets the configuration for this provisioner
   */
  getConfig(): LambdaConfig {
    return this.config;
  }
}

/**
 * Creates a Lambda provisioner instance
 *
 * @param config - Optional Lambda configuration (defaults to env vars)
 * @returns A new LambdaProvisioner instance
 */
export function createLambdaProvisioner(config?: LambdaConfig): LambdaProvisioner {
  return new LambdaProvisioner(config);
}
