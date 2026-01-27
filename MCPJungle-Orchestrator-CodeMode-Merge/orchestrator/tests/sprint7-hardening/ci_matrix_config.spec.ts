import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('CI matrix config', () => {
  it('includes sprint suites and flags', () => {
    const p = join(process.cwd(), '..', '.github/workflows/ci.yml');
    const y = readFileSync(p, 'utf8');
    expect(y).toContain('tests/sprint7-hardening');
    expect(y).toContain('OTEL_TEST=true');
  });
});


