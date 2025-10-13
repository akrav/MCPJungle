import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';

let srv: http.Server;
let url: string;

describe('progress ordering (streamed proxy)', () => {
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        res.setHeader('Content-Type', 'application/json');
        // chunked by default in node when no Content-Length
        res.write('{"p":1}\n');
        setTimeout(() => res.write('{"p":2}\n'), 40);
        setTimeout(() => res.end('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}'), 80);
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

  it('receives chunks in order without end-buffering', async () => {
    const times: number[] = [];
    const chunks: Buffer[] = [];
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', (c: Buffer) => { times.push(Date.now()); chunks.push(c); });
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

    expect(res.status).toBe(200);
    // Expect at least 2 chunks (progress + final) to prove no end-buffering
    expect(times.length).toBeGreaterThanOrEqual(2);
    // Ordered ascending
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    // Reasonable spacing (< 500ms between first two frames)
    expect(times[1] - times[0]).toBeLessThan(500);
  });
});


