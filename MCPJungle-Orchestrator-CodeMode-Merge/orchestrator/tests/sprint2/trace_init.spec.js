import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';
import { restartOtelForTests, shutdownOtel, getTestSpanExporter } from '../../src/obs/otel';
describe('Sprint2 Ticket-204 OpenTelemetry bootstrap', () => {
    beforeAll(async () => {
        await restartOtelForTests();
        process.env.JUNGLE_URL = 'http://localhost:9000';
    });
    afterAll(async () => { await shutdownOtel(); });
    it('emits a root span on request', async () => {
        const res = await request(app)
            .get('/healthz');
        expect(res.status).toBe(200);
        const exporter = getTestSpanExporter();
        expect(exporter).toBeTruthy();
        const spans = exporter.getFinishedSpans();
        expect(spans.length).toBeGreaterThan(0);
    });
});
