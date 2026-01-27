import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
let srv;
let url;
describe('Sprint4 Ticket-406 retry jitter correctness (502/503 only)', () => {
    beforeAll(async () => {
        let counter = 0;
        srv = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/mcp') {
                counter++;
                if (counter < 3) {
                    res.statusCode = 503;
                    return res.end('no');
                }
                res.setHeader('Content-Type', 'application/json');
                return res.end('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}');
            }
            res.statusCode = 404;
            res.end();
        });
        await new Promise((r) => srv.listen(0, r));
        const addr = srv.address();
        const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
        url = `http://127.0.0.1:${port}`;
        process.env.JUNGLE_URL = url;
    });
    afterAll(async () => { await new Promise((r) => srv.close(() => r())); });
    it('retries on 503 and eventually succeeds', async () => {
        const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.jsonrpc).toBe('2.0');
    });
    it('does not retry on 500', async () => {
        const s = http.createServer((req, res) => { res.statusCode = 500; res.end('bad'); });
        await new Promise((r) => s.listen(0, r));
        const addr = s.address();
        const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
        process.env.JUNGLE_URL = `http://127.0.0.1:${port}`;
        const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32000);
        await new Promise((r) => s.close(() => r()));
    });
});
