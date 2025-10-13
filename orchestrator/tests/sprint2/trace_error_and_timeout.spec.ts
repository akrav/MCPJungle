import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
import { restartOtelForTests, shutdownOtel, getTestSpanExporter } from '../../src/obs/otel';

let srv: http.Server;
let url: string;

describe('Sprint2 Ticket-206 trace on error/timeout', () => {
  beforeAll(async () => { await restartOtelForTests(); });
  afterAll(async () => { await shutdownOtel(); });

  it('marks error path when upstream returns 502 HTML', async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'text/html');
        res.end('<b>bad</b>');
        return;
      }
      res.statusCode = 404; res.end();
    });
    await new Promise<void>((resolve) => srv.listen(0, resolve));
    const addr = srv.address();
    const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
    url = `http://127.0.0.1:${port}`;
    process.env.JUNGLE_URL = url;

    const res = await request(app)
      .post('/mcp')
      .set('Content-Type','application/json')
      .send({ jsonrpc:'2.0', id: 1, method:'tools/list' });
    expect(res.status).toBe(200);
    const spans = getTestSpanExporter()!.getFinishedSpans();
    expect(spans.some(s => s.name.includes('tools/list'))).toBe(true);
    await new Promise<void>((r)=>srv.close(()=>r()));
  });

  it('marks timeout path when upstream stalls', async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        return; // stall
      }
      res.statusCode = 404; res.end();
    });
    await new Promise<void>((resolve) => srv.listen(0, resolve));
    const addr = srv.address();
    const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
    url = `http://127.0.0.1:${port}`;
    process.env.JUNGLE_URL = url;
    process.env.ORCH_UPSTREAM_TIMEOUT_MS = '100';
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type','application/json')
      .send({ jsonrpc:'2.0', id: 2, method:'tools/call' });
    expect(res.status).toBe(200);
    const spans = getTestSpanExporter()!.getFinishedSpans();
    expect(spans.some(s => s.name.includes('tools/call'))).toBe(true);
    await new Promise<void>((r)=>srv.close(()=>r()));
  });
});


