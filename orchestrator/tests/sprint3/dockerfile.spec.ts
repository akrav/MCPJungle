import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Sprint3 Ticket-302 Dockerfile basics', () => {
  it('is multi-stage, has HEALTHCHECK and runs as node', () => {
    const s = fs.readFileSync(path.join(__dirname, '../../Dockerfile'), 'utf8');
    expect(s).toMatch(/FROM node:20-alpine AS builder/);
    expect(s).toMatch(/HEALTHCHECK/);
    expect(s).toMatch(/USER node/);
  });
});


