import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createAdminRouter, selectToolSchema } from '../../src/server/admin';
import {
  storePendingChoices,
  clearAllPendingChoices,
  PendingTool,
} from '../../src/discovery/interaction/pendingState';

// Mock dependencies
vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

vi.mock('../../src/discovery/provisioning/installer.js', () => ({
  installTool: vi.fn().mockResolvedValue({
    success: true,
    toolId: 'tool-123',
    canonicalName: 'Test_Tool__tool-123',
    message: 'Installed',
    isNewInstall: true,
  }),
}));

vi.mock('../../src/discovery/interaction/prompt.js', () => ({
  notifySelectionMade: vi.fn(),
  notifySelectionRejected: vi.fn(),
}));

const createMockTool = (id: string, name: string): PendingTool => ({
  id,
  name,
  description: `${name} description`,
  endpoint_url: `https://api.example.com/${id}`,
  price_per_call: 0.01,
  average_rating: 4.5,
  listing_status: 'ACTIVE',
});

describe('Admin API Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllPendingChoices();

    // Create test app with admin router
    app = express();
    app.use(express.json());
    app.use('/admin', createAdminRouter());
  });

  afterEach(() => {
    clearAllPendingChoices();
  });

  describe('selectToolSchema', () => {
    it('validates correct select request', () => {
      const result = selectToolSchema.safeParse({
        requestId: 'req-123',
        toolId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'select',
      });
      expect(result.success).toBe(true);
    });

    it('validates correct reject request', () => {
      const result = selectToolSchema.safeParse({
        requestId: 'req-123',
        action: 'reject',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing requestId', () => {
      const result = selectToolSchema.safeParse({
        action: 'select',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid action', () => {
      const result = selectToolSchema.safeParse({
        requestId: 'req-123',
        action: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid toolId format', () => {
      const result = selectToolSchema.safeParse({
        requestId: 'req-123',
        toolId: 'not-a-uuid',
        action: 'select',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('POST /admin/select-tool', () => {
    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({ invalid: 'body' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    it('returns 400 for missing requestId', async () => {
      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({ action: 'select' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent requestId', async () => {
      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'non-existent',
          action: 'reject',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('returns 200 for valid reject action', async () => {
      // Store pending choices
      const tools = [createMockTool('t1', 'Tool 1')];
      storePendingChoices('req-123', 'user-456', 'test query', tools);

      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'req-123',
          action: 'reject',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('rejected');
    });

    it('returns 400 when select action missing toolId', async () => {
      const tools = [createMockTool('t1', 'Tool 1')];
      storePendingChoices('req-123', 'user-456', 'test', tools);

      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'req-123',
          action: 'select',
          // missing toolId
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('toolId');
    });

    it('returns 400 when toolId not in candidates', async () => {
      const tools = [createMockTool('t1', 'Tool 1')];
      storePendingChoices('req-123', 'user-456', 'test', tools);

      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'req-123',
          toolId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID but not in list
          action: 'select',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not in the candidate list');
    });

    it('returns 200 for valid select action', async () => {
      const toolId = '550e8400-e29b-41d4-a716-446655440000';
      const tools = [createMockTool(toolId, 'Tool 1')];
      storePendingChoices('req-123', 'user-456', 'test', tools);

      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'req-123',
          toolId,
          action: 'select',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('installed');
      expect(res.body.data.toolId).toBe(toolId);
    });

    it('returns 415 for non-JSON content type', async () => {
      const res = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'text/plain')
        .send('not json');

      expect(res.status).toBe(415);
      expect(res.body.error).toContain('application/json');
    });
  });

  describe('GET /admin/pending', () => {
    it('returns count of all pending selections', async () => {
      storePendingChoices('req-1', 'user-1', 'q1', [createMockTool('t1', 'T1')]);
      storePendingChoices('req-2', 'user-2', 'q2', [createMockTool('t2', 'T2')]);

      const res = await request(app).get('/admin/pending');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(2);
    });

    it('returns pending selections for specific user', async () => {
      storePendingChoices('req-1', 'user-A', 'q1', [createMockTool('t1', 'T1')]);
      storePendingChoices('req-2', 'user-A', 'q2', [createMockTool('t2', 'T2')]);
      storePendingChoices('req-3', 'user-B', 'q3', [createMockTool('t3', 'T3')]);

      const res = await request(app).get('/admin/pending?userId=user-A');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.pending).toHaveLength(2);
    });
  });

  describe('GET /admin/health', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/admin/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('healthy');
      expect(res.body.data.timestamp).toBeDefined();
    });
  });
});

