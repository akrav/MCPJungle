import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
let srv;
let url;
describe('Sprint1 Ticket-108 headers hygiene', () => {
    beforeAll(async () => {
        srv = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/mcp') {
                const fwd = req.headers['forwarded'];
                const ua = req.headers['user-agent'];
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { fwd, ua } }));
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
    afterAll(async () => {
        await new Promise((resolve) => srv.close(() => resolve()));
    });
    it('sets Forwarded and User-Agent', async () => {
        const res = await request(app)
            .post('/mcp')
            .set('Content-Type', 'application/json')
            .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.result.fwd).toBeDefined();
        expect(String(res.body.result.ua || '')).toContain('orchestrator/1.0');
    });
});
