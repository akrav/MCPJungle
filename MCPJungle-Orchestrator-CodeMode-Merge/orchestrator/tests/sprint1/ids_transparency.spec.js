import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
let srv;
let url;
describe('Sprint1 Ticket-104 ID transparency', () => {
    beforeAll(async () => {
        srv = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/mcp') {
                let body = '';
                req.on('data', (c) => (body += c));
                req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(body); });
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
    afterAll(async () => { await new Promise((r) => srv.close(() => r())); });
    it('echoes string id exactly', async () => {
        const id = 'abc-123';
        const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(id);
    });
    it('echoes numeric id exactly', async () => {
        const id = 99;
        const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(id);
    });
});
