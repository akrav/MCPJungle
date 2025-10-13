import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';

describe('Sprint2 Ticket-202 method allow-list', () => {
  beforeEach(() => { process.env.REQUIRE_BEARER = 'false'; });

  it('allowed methods pass', async () => {
    const ok = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect(ok.status).toBe(200);
    expect(ok.body.jsonrpc).toBe('2.0');
  });

  it('unknown method → -32601', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'unknownMethod' });
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32601);
  });
});


