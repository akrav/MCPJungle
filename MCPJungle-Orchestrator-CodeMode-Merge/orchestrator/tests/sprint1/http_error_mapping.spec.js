import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
let srv;
let url;
describe('Sprint1 Ticket-105 HTTP error -> JSON-RPC error mapping', () => {
    beforeAll(async () => {
        srv = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/mcp') {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'text/html');
                res.end('<html>bad gateway</html>');
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
    it('maps 5xx HTML to JSON-RPC -32000 with status', async () => {
        const res = await request(app)
            .post('/mcp')
            .set('Content-Type', 'application/json')
            .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32000);
        expect(res.body.error.data.status).toBe(502);
    });
});
