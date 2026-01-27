import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';
import { restartOtelForTests, shutdownOtel, getTestMetrics } from '../../src/obs/otel';

let srv: http.Server;
let url: string;

describe('Sprint2 Ticket-207 metrics counters and histograms', () => {
  beforeAll(async () => {
    await restartOtelForTests();
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
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
    process.env.JUNGLE_URL = url;
  });

  afterAll(async () => { await shutdownOtel(); await new Promise<void>((r)=>srv.close(()=>r())); });

  it('increments counters and records durations', async () => {
    const before = getTestMetrics();
    await request(app).post('/mcp').set('Content-Type','application/json').send({ jsonrpc:'2.0', id:1, method:'tools/list' });
    const after = getTestMetrics();
    expect((after.counters['requests_total'] || 0)).toBeGreaterThan(before.counters['requests_total'] || 0);
    expect((after.histograms['request_duration_ms'] || []).length).toBeGreaterThan((before.histograms['request_duration_ms'] || []).length);
  });
});


