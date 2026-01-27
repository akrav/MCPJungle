import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';

describe('Sprint4 Ticket-408 batch rejection E2E', () => {
  it('rejects array bodies with -32600', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type','application/json')
      .send([{ jsonrpc:'2.0', id:1, method:'tools/list' }]);
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32600);
  });
});
