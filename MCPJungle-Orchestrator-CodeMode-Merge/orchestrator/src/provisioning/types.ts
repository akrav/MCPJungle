export interface Provisioner {
  provision(userId: string): Promise<{ baseUrl: string }>;
  stop(userId: string): Promise<void>;
  isHealthy(baseUrl: string): Promise<boolean>;
}

export class NoopProvisioner implements Provisioner {
  async provision(_userId: string): Promise<{ baseUrl: string }> {
    throw new Error('Provisioner disabled');
  }
  async stop(_userId: string): Promise<void> {
    // no-op
  }
  async isHealthy(_baseUrl: string): Promise<boolean> {
    return false;
  }
}

import { loadConfig } from '../config/load.js';

export async function getProvisioner(): Promise<Provisioner> {
  const cfg = loadConfig(process.env);
  switch (cfg.provisioner) {
    case 'none':
      return new NoopProvisioner();
    case 'docker': {
      const docker = await import('./docker.js');
      return new docker.DockerProvisioner();
    }
    case 'k8s': {
      const k8s = await import('./k8s.js');
      return new k8s.K8sProvisioner();
    }
    case 'lambda': {
      const lambda = await import('./lambda.js');
      return new lambda.LambdaProvisioner();
    }
    default:
      return new NoopProvisioner();
  }
}


