import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
describe('Sprint3 Ticket-301 .dockerignore contents', () => {
    it('includes noisy dirs and files', () => {
        const p = path.join(__dirname, '../../.dockerignore');
        const s = fs.readFileSync(p, 'utf8');
        expect(s).toMatch(/node_modules/);
        expect(s).toMatch(/\.git/);
        expect(s).toMatch(/coverage/);
        expect(s).toMatch(/dist/);
        expect(s).toMatch(/\.env/);
    });
});
