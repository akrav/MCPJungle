import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('docs quickstart smoke', () => {
  it('README contains headings', () => {
    const p = join(process.cwd(), 'README.md');
    const t = readFileSync(p, 'utf8');
    expect(t).toContain('Code Mode Quickstart');
    expect(t).toContain('Operator Runbook');
  });
});


