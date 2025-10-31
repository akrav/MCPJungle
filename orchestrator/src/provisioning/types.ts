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

export function getProvisioner(): Provisioner {
  const cfg = loadConfig(process.env);
  switch (cfg.provisioner) {
    case 'none':
      return new NoopProvisioner();
    case 'docker':
      // dynamic import to avoid hard dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const docker = require('./docker');
      return new docker.DockerProvisioner();
    case 'k8s':
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const k8s = require('./k8s');
      return new k8s.K8sProvisioner();
    default:
      return new NoopProvisioner();
  }
}


