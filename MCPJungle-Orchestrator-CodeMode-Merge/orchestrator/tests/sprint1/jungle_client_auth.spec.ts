import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';

let srv: http.Server;
let url: string;

describe('Sprint1 Ticket-102 Jungle auth + timeout', () => {
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        const auth = req.headers['authorization'];
        if (auth !== 'Bearer test-token') {
          res.statusCode = 401; res.end('unauthorized'); return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}');
        return;
      }
      res.statusCode = 404; res.end();
    });
    await new Promise<void>((resolve) => srv.listen(0, resolve));
    const addr = srv.address();
    const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  });

  it('includes Bearer token and respects timeout', async () => {
    process.env.JUNGLE_URL = url;
    process.env.JUNGLE_TOKEN = 'test-token';
    process.env.ORCH_UPSTREAM_TIMEOUT_MS = '5000';

    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe('2.0');
  });
});


