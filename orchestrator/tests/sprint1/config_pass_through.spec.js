import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/load';
describe('Sprint1 Ticket-101 config', () => {
    it('adds Jungle token and upstream timeout with defaults', () => {
        const cfg = loadConfig({ JUNGLE_URL: 'http://localhost:9000' });
        expect(cfg.upstreamTimeoutMs).toBe(30000);
        expect(cfg.jungleToken).toBeUndefined();
    });
    it('parses token and custom timeout', () => {
        const cfg = loadConfig({
            JUNGLE_URL: 'https://example.com/mcp',
            JUNGLE_TOKEN: 'abc123',
            ORCH_UPSTREAM_TIMEOUT_MS: '45000',
        });
        expect(cfg.jungleToken).toBe('abc123');
        expect(cfg.upstreamTimeoutMs).toBe(45000);
    });
});
