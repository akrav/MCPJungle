import type { Provisioner } from './types.js';

export function buildRunArgs(userId: string, image: string, env: Record<string,string> = {}): string[] {
  const name = `jungle-${userId}`;
  const args = ['run', '-d', '--name', name, '-p', '0:9000'];
  for (const [k,v] of Object.entries(env)) {
    args.push('-e', `${k}=${v}`);
  }
  args.push(image);
  return args;
}

export function parseInspectHostPort(inspectJson: any): number | null {
  try {
    const first = Array.isArray(inspectJson) ? inspectJson[0] : inspectJson;
    const mappings = first?.NetworkSettings?.Ports?.['9000/tcp'];
    if (Array.isArray(mappings) && mappings[0]?.HostPort) return parseInt(mappings[0].HostPort, 10);
  } catch {}
  return null;
}

export class DockerProvisioner implements Provisioner {
  async provision(_userId: string): Promise<{ baseUrl: string }> {
    throw new Error('NotImplemented: docker CLI invocation not enabled in tests');
  }
  async stop(_userId: string): Promise<void> {
    // NotImplemented
  }
  async isHealthy(_baseUrl: string): Promise<boolean> {
    return false;
  }
}


