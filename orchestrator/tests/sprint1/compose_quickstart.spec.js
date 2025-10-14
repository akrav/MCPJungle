import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
describe('Sprint1 Ticket-113 compose + README quickstart', () => {
    it('compose points orchestrator to jungle service', () => {
        const dc = fs.readFileSync(path.join(__dirname, '../../docker-compose.yml'), 'utf8');
        expect(dc).toContain('jungle:');
        expect(dc).toContain('JUNGLE_URL=http://jungle:9000');
    });
    it('README has Quickstart with Jungle section', () => {
        const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
        expect(readme).toMatch(/Quickstart \(Compose with Jungle\)/);
        expect(readme).toContain('http://localhost:8080/healthz');
        expect(readme).toContain('http://localhost:9000');
    });
});
