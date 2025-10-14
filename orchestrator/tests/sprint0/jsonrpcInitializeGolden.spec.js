import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';
import fs from 'node:fs';
import path from 'node:path';
describe('initialize golden', () => {
    it('matches basic envelope fields', async () => {
        const res = await request(app)
            .post('/mcp')
            .send({ jsonrpc: '2.0', id: 'golden-1', method: 'initialize' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(200);
        const fixturesDir = path.join(__dirname, '..', 'fixtures');
        const golden = fs.readFileSync(path.join(fixturesDir, 'initialize_res.json'), 'utf8');
        // compare normalized JSON
        expect(JSON.parse(JSON.stringify(res.body))).toEqual(JSON.parse(golden));
    });
});
