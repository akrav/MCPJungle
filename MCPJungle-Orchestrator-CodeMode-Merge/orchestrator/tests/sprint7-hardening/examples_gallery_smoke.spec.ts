import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

describe('examples mini-gallery', () => {
  it('runs example1 and prints JSON', () => {
    const p = spawnSync('npx', ['tsx', join(process.cwd(), 'examples/codemode/example1.ts')], { encoding: 'utf8', cwd: join(process.cwd()) , env: { ...process.env, JUNGLE_URL: 'http://shared.example' } });
    expect(p.status).toBe(0);
    const parsed = JSON.parse(p.stdout.trim());
    expect(typeof parsed).toBe('object');
  });
  it('runs example2 and prints JSON', () => {
    const p = spawnSync('npx', ['tsx', join(process.cwd(), 'examples/codemode/example2.ts')], { encoding: 'utf8', cwd: join(process.cwd()), env: { ...process.env, JUNGLE_URL: 'http://shared.example' } });
    expect(p.status).toBe(0);
    const parsed = JSON.parse(p.stdout.trim());
    expect(typeof parsed).toBe('object');
  });
});


