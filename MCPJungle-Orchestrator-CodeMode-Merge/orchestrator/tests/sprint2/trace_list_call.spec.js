import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
import { restartOtelForTests, shutdownOtel, getTestSpanExporter } from '../../src/obs/otel';
let srv;
let url;
describe('Sprint2 Ticket-205 spans for list/call', () => {
    beforeAll(async () => {
        await restartOtelForTests();
        srv = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/mcp') {
                res.setHeader('Content-Type', 'application/json');
                res.end('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}');
                return;
            }
            res.statusCode = 404;
            res.end();
        });
        await new Promise((resolve) => srv.listen(0, resolve));
        const addr = srv.address();
        const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
        url = `http://127.0.0.1:${port}`;
        process.env.JUNGLE_URL = url;
    });
    afterAll(async () => { await shutdownOtel(); await new Promise((r) => srv.close(() => r())); });
    it('records span markers with attributes', async () => {
        const list = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        expect(list.status).toBe(200);
        const call = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'demo' } });
        expect(call.status).toBe(200);
        const spans = getTestSpanExporter().getFinishedSpans();
        // ensure at least one marker for each
        const names = spans.map(s => s.name);
        expect(names.some(n => n.includes('tools/list'))).toBe(true);
        expect(names.some(n => n.includes('tools/call'))).toBe(true);
    });
});
