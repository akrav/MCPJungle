/**
 * E2E Test: Manual Mode Happy Path
 *
 * Verifies the human-in-the-loop flow:
 * 1. User in "Manual Mode" requests a missing tool
 * 2. System pauses and stores pending choices
 * 3. Admin API is called to make selection
 * 4. System installs the selected tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { ToolWithScore } from '../../src/discovery/supabase/types';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';
import {
  storePendingChoices,
  getPendingChoices,
  clearPendingChoices,
  clearAllPendingChoices,
  PendingTool,
} from '../../src/discovery/interaction/pendingState';
import { createAdminRouter } from '../../src/server/admin';

// Mock external dependencies
vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

vi.mock('../../src/discovery/provisioning/installer.js', () => ({
  installTool: vi.fn().mockResolvedValue({
    success: true,
    toolId: 'tool-123',
    canonicalName: 'Weather_API__tool-123',
    message: 'Installed',
    isNewInstall: true,
  }),
  persistToolConfig: vi.fn(),
  getUserTool: vi.fn(),
  isToolInstalled: vi.fn(),
  generateCanonicalName: vi.fn((tool) => `${tool.name}__${tool.id.slice(0, 8)}`),
}));

vi.mock('../../src/discovery/interaction/prompt.js', () => ({
  requestUserSelection: vi.fn().mockReturnValue({
    requestId: 'test-req',
    candidateCount: 1,
    message: 'Mock prompt',
  }),
  notifySelectionMade: vi.fn(),
  notifySelectionRejected: vi.fn(),
}));

// Import after mocks
import { installTool } from '../../src/discovery/provisioning/installer.js';
import { notifySelectionMade, notifySelectionRejected } from '../../src/discovery/interaction/prompt.js';

// Test data factories
function createMockTool(id: string, name: string): PendingTool {
  return {
    id,
    name,
    description: `${name} description`,
    endpoint_url: `https://api.example.com/${id}`,
    price_per_call: 0.01,
    average_rating: 4.5,
    listing_status: 'ACTIVE',
  };
}

describe('E2E: Manual Mode Happy Path', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllPendingChoices();

    // Setup Express app with admin router
    app = express();
    app.use(express.json());
    app.use('/admin', createAdminRouter());
  });

  afterEach(() => {
    clearAllPendingChoices();
  });

  describe('Phase 1: Request Triggers Manual Mode', () => {
    it('stores pending choices when request triggers manual mode', () => {
      const candidates = [
        createMockTool('tool-1', 'Weather API'),
        createMockTool('tool-2', 'Climate Service'),
      ];

      // Simulate manual mode being triggered
      const result = storePendingChoices(
        'req-123',
        'user-456',
        'get weather data',
        candidates
      );

      expect(result.requestId).toBe('req-123');
      expect(result.candidateCount).toBe(2);

      // Verify pending choices are stored
      const pending = getPendingChoices('req-123');
      expect(pending).toBeDefined();
      expect(pending?.userId).toBe('user-456');
      expect(pending?.candidates).toHaveLength(2);
      expect(pending?.query).toBe('get weather data');
    });

    it('pending state includes all candidate details', () => {
      const tool = createMockTool('tool-abc', 'Premium Weather');
      storePendingChoices('req-999', 'user-111', 'forecast', [tool]);

      const pending = getPendingChoices('req-999');

      expect(pending?.candidates[0].id).toBe('tool-abc');
      expect(pending?.candidates[0].name).toBe('Premium Weather');
      expect(pending?.candidates[0].price_per_call).toBe(0.01);
    });
  });

  describe('Phase 2: Admin API Selection', () => {
    it('successfully selects and installs a tool via admin API', async () => {
      // Setup: Store pending choices
      const toolId = '550e8400-e29b-41d4-a716-446655440000';
      const candidates = [createMockTool(toolId, 'Weather API')];
      storePendingChoices('req-select-test', 'user-123', 'weather', candidates);

      // Action: Call admin API to select tool
      const response = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'req-select-test',
          toolId: toolId,
          action: 'select',
        });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('installed');

      // Verify installer was called
      expect(installTool).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ id: toolId })
      );

      // Verify pending choices were cleared
      expect(getPendingChoices('req-select-test')).toBeUndefined();

      // Verify notification was sent
      expect(notifySelectionMade).toHaveBeenCalledWith(
        'req-select-test',
        toolId,
        'Weather API'
      );
    });

    it('successfully rejects all tools via admin API', async () => {
      // Setup
      const candidates = [createMockTool('tool-1', 'Tool A')];
      storePendingChoices('req-reject-test', 'user-123', 'query', candidates);

      // Action: Reject
      const response = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'req-reject-test',
          action: 'reject',
        });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('rejected');

      // Verify installer was NOT called
      expect(installTool).not.toHaveBeenCalled();

      // Verify pending choices were cleared
      expect(getPendingChoices('req-reject-test')).toBeUndefined();

      // Verify rejection notification
      expect(notifySelectionRejected).toHaveBeenCalledWith('req-reject-test');
    });
  });

  describe('Phase 3: Full Manual Flow', () => {
    it('complete flow: store -> select -> clear', async () => {
      const toolId = '550e8400-e29b-41d4-a716-446655440001';

      // Step 1: Simulate discovery triggering manual mode
      const candidates = [
        createMockTool(toolId, 'Primary Weather'),
        createMockTool('550e8400-e29b-41d4-a716-446655440002', 'Backup Weather'),
      ];

      storePendingChoices('full-flow-req', 'user-full', 'weather forecast', candidates);

      // Verify state is stored
      let pending = getPendingChoices('full-flow-req');
      expect(pending).toBeDefined();
      expect(pending?.candidates).toHaveLength(2);

      // Step 2: User makes selection via Admin API
      const response = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'full-flow-req',
          toolId: toolId,
          action: 'select',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.toolId).toBe(toolId);

      // Step 3: Verify state is cleared
      pending = getPendingChoices('full-flow-req');
      expect(pending).toBeUndefined();

      // Verify correct tool was installed
      expect(installTool).toHaveBeenCalledWith(
        'user-full',
        expect.objectContaining({
          id: toolId,
          name: 'Primary Weather',
        })
      );
    });

    it('handles multiple concurrent pending requests', async () => {
      const tool1 = '550e8400-e29b-41d4-a716-446655440010';
      const tool2 = '550e8400-e29b-41d4-a716-446655440020';

      // Store two separate pending requests
      storePendingChoices('req-A', 'user-A', 'query A', [createMockTool(tool1, 'Tool A')]);
      storePendingChoices('req-B', 'user-B', 'query B', [createMockTool(tool2, 'Tool B')]);

      // Both should exist
      expect(getPendingChoices('req-A')).toBeDefined();
      expect(getPendingChoices('req-B')).toBeDefined();

      // Select from first request
      await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({ requestId: 'req-A', toolId: tool1, action: 'select' });

      // First cleared, second still exists
      expect(getPendingChoices('req-A')).toBeUndefined();
      expect(getPendingChoices('req-B')).toBeDefined();

      // Select from second request
      await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({ requestId: 'req-B', toolId: tool2, action: 'select' });

      // Both cleared
      expect(getPendingChoices('req-A')).toBeUndefined();
      expect(getPendingChoices('req-B')).toBeUndefined();

      // Both tools installed
      expect(installTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling in manual flow', () => {
    it('returns 404 when selecting expired/invalid request', async () => {
      const response = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'non-existent-request',
          action: 'reject',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('returns 400 when selecting tool not in candidates', async () => {
      storePendingChoices('req-invalid', 'user-1', 'q', [
        createMockTool('550e8400-e29b-41d4-a716-446655440099', 'Valid Tool'),
      ]);

      const response = await request(app)
        .post('/admin/select-tool')
        .set('Content-Type', 'application/json')
        .send({
          requestId: 'req-invalid',
          toolId: '550e8400-e29b-41d4-a716-446655440000', // Different UUID
          action: 'select',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not in the candidate list');
    });
  });
});

