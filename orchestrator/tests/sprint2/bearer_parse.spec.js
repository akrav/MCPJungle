import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';
describe('Sprint2 Ticket-201 bearer parsing', () => {
    beforeEach(() => { process.env.REQUIRE_BEARER = 'true'; });
    it('missing header → JSON-RPC -32000 with 401 data', async () => {
        const res = await request(app)
            .post('/mcp')
            .set('Content-Type', 'application/json')
            .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        expect(res.status).toBe(200);
        expect(res.body.error.code).toBe(-32000);
        expect(res.body.error.data.status).toBe(401);
    });
    it('with header → token attached (middleware executed)', async () => {
        process.env.REQUIRE_BEARER = 'false';
        const res = await request(app)
            .post('/mcp')
            .set('Content-Type', 'application/json')
            .set('Authorization', 'Bearer t-123')
            .send({ jsonrpc: '2.0', id: 1, method: 'initialize' });
        expect(res.status).toBe(200);
        expect(res.body.jsonrpc).toBe('2.0');
    });
});
