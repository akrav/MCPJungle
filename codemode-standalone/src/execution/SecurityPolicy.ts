import type { SecurityPolicy as ISecurityPolicy } from "../types/index.js";

/**
 * Default security policy for code execution
 */
export const DEFAULT_SECURITY_POLICY: ISecurityPolicy = {
  maxExecutionTime: 30000, // 30 seconds
  maxMemoryMB: 128, // 128 MB
  allowNetworkAccess: false,
  allowedDomains: [],
};

/**
 * Manages security policies for code execution
 */
export class SecurityPolicyManager {
  private policy: ISecurityPolicy;

  constructor(policy: Partial<ISecurityPolicy> = {}) {
    this.policy = {
      ...DEFAULT_SECURITY_POLICY,
      ...policy,
    };
  }

  /**
   * Get the current security policy
   */
  getPolicy(): ISecurityPolicy {
    return { ...this.policy };
  }

  /**
   * Update the security policy
   */
  updatePolicy(updates: Partial<ISecurityPolicy>): void {
    this.policy = {
      ...this.policy,
      ...updates,
    };
  }

  /**
   * Validate if a domain is allowed for network access
   */
  isDomainAllowed(domain: string): boolean {
    if (!this.policy.allowNetworkAccess) {
      return false;
    }

    if (!this.policy.allowedDomains || this.policy.allowedDomains.length === 0) {
      return true; // Allow all if no specific domains are listed
    }

    return this.policy.allowedDomains.some((allowed) => {
      // Support wildcards like *.example.com
      const pattern = allowed.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(domain);
    });
  }

  /**
   * Get maximum execution time in milliseconds
   */
  getMaxExecutionTime(): number {
    return this.policy.maxExecutionTime;
  }

  /**
   * Get maximum memory in bytes
   */
  getMaxMemoryBytes(): number {
    return this.policy.maxMemoryMB * 1024 * 1024;
  }
}






