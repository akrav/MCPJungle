import { describe, it, expect } from 'vitest';
import { buildRunArgs, parseInspectHostPort } from '../../src/provisioning/docker';

describe('docker command build and inspect parse', () => {
  it('builds run args with env', () => {
    const args = buildRunArgs('u1', 'mcpjungle/mcpjungle:latest-stdio', { A: '1', B: '2' });
    const s = args.join(' ');
    expect(s).toContain('run -d --name jungle-u1 -p 0:9000');
    expect(s).toContain('-e A=1');
    expect(s).toContain('-e B=2');
  });

  it('parses host port from inspect json', () => {
    const inspect = [{ NetworkSettings: { Ports: { '9000/tcp': [{ HostPort: '49123' }] } } }];
    expect(parseInspectHostPort(inspect)).toBe(49123);
  });
});


