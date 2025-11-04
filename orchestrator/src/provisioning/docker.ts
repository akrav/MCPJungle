import type { Provisioner } from './types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfig } from '../config/load.js';

const pexec = promisify(execFile);

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
  async provision(userId: string): Promise<{ baseUrl: string }> {
    const cfg = loadConfig(process.env);
    const image = process.env.JUNGLE_IMAGE || 'mcpjungle/mcpjungle:latest-stdio';
    const name = `jungle-${userId}`;
    const env: Record<string,string> = { SERVER_MODE: 'development', PORT: '9000' };
    if (cfg.jungleToken) env['JUNGLE_TOKEN'] = cfg.jungleToken;
    const args = buildRunArgs(userId, image, env);
    // Try to remove any existing container with same name
    await pexec('docker', ['rm', '-f', name]).catch(() => {});
    await pexec('docker', args);
    // Inspect to get host port
    const { stdout } = await pexec('docker', ['inspect', name]);
    const hostPort = parseInspectHostPort(JSON.parse(stdout));
    if (!hostPort) throw new Error('FailedInspectPort');
    return { baseUrl: `http://127.0.0.1:${hostPort}` };
  }
  async stop(_userId: string): Promise<void> {
    const name = `jungle-${_userId}`;
    await pexec('docker', ['rm', '-f', name]).catch(() => {});
  }
  async isHealthy(_baseUrl: string): Promise<boolean> {
    return false;
  }
}


