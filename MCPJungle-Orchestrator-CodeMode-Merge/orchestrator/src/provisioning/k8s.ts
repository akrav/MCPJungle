import type { Provisioner } from './types.js';

export function buildDeployment(userId: string) {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: `jungle-${userId}`, labels: { userId } },
  };
}

export function buildService(userId: string) {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: `jungle-${userId}`, labels: { userId } },
  };
}

export function serviceBaseUrl(userId: string, port = 9000): string {
  return `http://jungle-${userId}:${port}`;
}

export class K8sProvisioner implements Provisioner {
  async provision(userId: string): Promise<{ baseUrl: string }> {
    // For unit tests only
    return { baseUrl: serviceBaseUrl(userId) };
  }
  async stop(_userId: string): Promise<void> {}
  async isHealthy(_baseUrl: string): Promise<boolean> { return false; }
}


