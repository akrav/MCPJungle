import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';

let srv: http.Server;
let url: string;

describe('Sprint1 Ticket-112 per-user instance dev stub', () => {
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        const user = req.headers['x-user-id'] as string | undefined;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { user } }));
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

  it('forwards x-user-id through to Jungle', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type','application/json')
      .set('x-user-id', 'u-123')
      .send({ jsonrpc:'2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(200);
    expect(res.body.result.user).toBe('u-123');
  });
});
