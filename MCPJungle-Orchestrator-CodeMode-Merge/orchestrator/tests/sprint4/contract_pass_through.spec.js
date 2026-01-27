import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
let srv;
let url;
describe('Sprint4 Ticket-402 pass-through list & call', () => {
    beforeAll(async () => {
        srv = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/mcp') {
                let body = '';
                req.on('data', (c) => (body += c));
                req.on('end', () => {
                    const msg = JSON.parse(body);
                    if (msg.method === 'tools/list') {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'a' }, { name: 'b' }] } }));
                        return;
                    }
                    if (msg.method === 'tools/call') {
                        res.setHeader('Content-Type', 'application/json');
                        res.write('{"part":1}\n');
                        setTimeout(() => res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { ok: true, nested: { x: 1 } } })), 10);
                        return;
                    }
                    res.statusCode = 400;
                    res.end('bad');
                });
                return;
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
    it('tools/list envelope equals upstream', async () => {
        const id = 'L-1';
        const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.body).toEqual({ jsonrpc: '2.0', id, result: { tools: [{ name: 'a' }, { name: 'b' }] } });
    });
    it('tools/call envelope equals upstream (after streaming assembly)', async () => {
        const id = 2;
        const res = await request(app)
            .post('/mcp')
            .set('Content-Type', 'application/json')
            .buffer(true)
            .parse((res, cb) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
            .send({ jsonrpc: '2.0', id, method: 'tools/call' });
        expect(res.status).toBe(200);
        const buf = res.body;
        const text = buf.toString('utf8');
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        const last = lines[lines.length - 1];
        const json = JSON.parse(last);
        expect(json).toEqual({ jsonrpc: '2.0', id, result: { ok: true, nested: { x: 1 } } });
    });
});
