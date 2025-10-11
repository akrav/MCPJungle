import request from 'supertest';
import app from '../../src/server/http';
import { describe, it, expect } from 'vitest';

describe('healthz', () => {
  it('returns ok true', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
  });
});
