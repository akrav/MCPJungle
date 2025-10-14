import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';
import { restartOtelForTests, shutdownOtel, getTestSpanExporter } from '../../src/obs/otel';
describe('Sprint4 Ticket-413 OTel spans present & useful', () => {
    beforeAll(async () => { await restartOtelForTests(); process.env.JUNGLE_URL = 'http://localhost:9000'; });
    afterAll(async () => { await shutdownOtel(); });
    it('healthz and initialize record span markers', async () => {
        const h = await request(app).get('/healthz');
        expect(h.status).toBe(200);
        const init = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 1, method: 'initialize' });
        expect(init.status).toBe(200);
        const spans = getTestSpanExporter().getFinishedSpans();
        const names = spans.map(s => s.name);
        expect(names.some(n => n.includes('healthz') || n.includes('http GET /healthz'))).toBe(true);
        expect(names.some(n => n.includes('initialize'))).toBe(true);
    });
});
