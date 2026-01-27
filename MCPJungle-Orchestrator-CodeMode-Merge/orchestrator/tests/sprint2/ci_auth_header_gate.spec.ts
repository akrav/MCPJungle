import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { authed } from '../../src/testutils/supertestClient';
import app from '../../src/server/http';

describe('Sprint2 Ticket-210 CI auth header gate', () => {
  beforeEach(() => { process.env.REQUIRE_BEARER = 'true'; });

  it('without header → error', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type','application/json')
      .send({ jsonrpc:'2.0', id:1, method:'tools/list' });
    expect(res.body.error.code).toBe(-32000);
  });

  it('with helper → OK', async () => {
    const client = authed();
    const res = await client.post('/mcp')
      .set('Content-Type','application/json')
      .send({ jsonrpc:'2.0', id:2, method:'initialize' });
    expect(res.status).toBe(200);
  });
});


