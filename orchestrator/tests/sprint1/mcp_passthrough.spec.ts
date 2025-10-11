import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';

let srv: http.Server;
let url: string;

describe('Sprint1 Ticket-103 pass-through list & call', () => {
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          res.end(body); // echo exact envelope
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

  afterAll(async () => {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  });

  it('relays tools/list response exactly', async () => {
    const reqBody = { jsonrpc: '2.0', id: 'l1', method: 'tools/list' };
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send(reqBody);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(reqBody);
  });

  it('relays tools/call response exactly', async () => {
    const reqBody = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { a: 1 } };
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send(reqBody);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(reqBody);
  });
});


