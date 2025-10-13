import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Sprint3 Ticket-308 GHCR tags convention in CI', () => {
  it('uses buildx and pushes sha and staging tags', () => {
    const y = fs.readFileSync(path.join(__dirname, '../../..', '.github/workflows/ci.yml'), 'utf8');
    expect(y).toContain('docker/setup-buildx-action@v3');
    expect(y).toContain('docker/build-push-action@v6');
    expect(y).toMatch(/ghcr\.io\/.+\/mcpjungle-orchestrator:sha-\$\{\{ github\.sha \}\}/);
    expect(y).toMatch(/ghcr\.io\/.+\/mcpjungle-orchestrator:staging/);
  });
});


