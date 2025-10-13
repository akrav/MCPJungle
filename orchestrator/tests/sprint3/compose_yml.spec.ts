import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Sprint3 Ticket-304 compose YAML', () => {
  it('contains jungle service, healthcheck and profiles block', () => {
    const s = fs.readFileSync(path.join(__dirname, '../../docker-compose.yml'), 'utf8');
    expect(s).toContain('jungle:');
    expect(s).toContain('healthcheck:');
    expect(s).toContain('profiles:');
  });
});


