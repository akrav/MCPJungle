import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
let srv;
let url;
describe('Sprint4 Ticket-405 timeout behavior bounded & clear', () => {
    beforeAll(async () => {
        srv = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/mcp') {
                return; // stall
            }
            res.statusCode = 404;
            res.end();
        });
        await new Promise((r) => srv.listen(0, r));
        const addr = srv.address();
        const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
        url = `http://127.0.0.1:${port}`;
        process.env.JUNGLE_URL = url;
        process.env.ORCH_UPSTREAM_TIMEOUT_MS = '100';
    });
    afterAll(async () => { await new Promise((r) => srv.close(() => r())); });
    it('returns JSON-RPC server error on timeout', async () => {
        const res = await request(app)
            .post('/mcp')
            .set('Content-Type', 'application/json')
            .send({ jsonrpc: '2.0', id: 't-1', method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32000);
    });
});
