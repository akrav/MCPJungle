import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
describe('Sprint2 Ticket-209 TLS/mTLS docs present', () => {
    it('README mentions TLS and mTLS guidance', () => {
        const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
        expect(/TLS/i.test(readme)).toBe(true);
        expect(/mTLS/i.test(readme)).toBe(true);
        expect(/ingress/i.test(readme) || /service mesh/i.test(readme)).toBe(true);
    });
});
