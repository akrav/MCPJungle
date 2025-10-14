import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';
describe('Sprint1 Ticket-111 content-type guard', () => {
    it('rejects non-JSON content-type with -32600', async () => {
        const res = await request(app)
            .post('/mcp')
            .set('Content-Type', 'text/plain')
            .send('not-json');
        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32600);
    });
});
