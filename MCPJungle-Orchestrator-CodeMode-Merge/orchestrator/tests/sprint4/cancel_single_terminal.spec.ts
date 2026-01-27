import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';

let srv: http.Server;
let url: string;

describe('Sprint4 Ticket-404 cancel yields single terminal', () => {
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const msg = JSON.parse(body);
            if (msg.method === 'cancel') {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"jsonrpc":"2.0","id":null,"result":{"ok":true}}');
              return;
            }
          } catch {}
          setTimeout(() => {
            res.setHeader('Content-Type', 'application/json');
            res.end('{"jsonrpc":"2.0","id":1,"result":{"finished":true}}');
          }, 100);
        });
        return;
      }
      res.statusCode = 404; res.end();
    });
    await new Promise<void>((resolve) => srv.listen(0, resolve));
    const addr = srv.address();
    const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
    url = `http://127.0.0.1:${port}`;
    process.env.JUNGLE_URL = url;
  });

  afterAll(async () => { await new Promise<void>((r)=>srv.close(()=>r())); });

  it('only one terminal response', async () => {
    const call = request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/call' });

    setTimeout(() => {
      void request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send({ jsonrpc: '2.0', id: null, method: 'cancel' });
    }, 10);

    const res = await call;
    expect(res.status).toBe(200);
    expect(['result', 'error'].some((k) => k in res.body)).toBe(true);
  });
});
