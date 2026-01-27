import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
describe('Sprint3 Ticket-309 README Compose Quickstart', () => {
    it('contains headings and code blocks for compose quickstart', () => {
        const s = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
        expect(/Compose Quickstart/.test(s)).toBe(true);
        expect(/docker compose up -d/.test(s)).toBe(true);
        expect(/curl -s http:\/\/localhost:8080\/healthz/.test(s)).toBe(true);
        expect(/\{\"jsonrpc\":\"2.0\"/.test(s)).toBe(true);
    });
});
