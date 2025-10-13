import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';

describe('Sprint2 Ticket-211 rate limiting', () => {
  it('returns 429 after exceeding limit', async () => {
    const req = () => request(app).post('/mcp').set('Content-Type','application/json').send({ jsonrpc:'2.0', id:1, method:'initialize' });
    let lastStatus = 0; let got429 = false;
    for (let i = 0; i < 8; i++) {
      const res = await req();
      lastStatus = res.status;
      if (res.status === 429) { got429 = true; break; }
    }
    expect(got429 || lastStatus === 429).toBe(true);
  });
});


