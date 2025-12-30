/**
 * Admin API Routes
 *
 * Provides administrative endpoints for manual tool selection
 * and other orchestrator management operations.
 *
 * @module server/admin
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { log } from '../obs/log.js';
import {
  getPendingChoices,
  clearPendingChoices,
} from '../discovery/interaction/pendingState.js';
import { installTool } from '../discovery/provisioning/installer.js';
import { getToolById } from '../discovery/supabase/service.js';
import {
  notifySelectionMade,
  notifySelectionRejected,
} from '../discovery/interaction/prompt.js';

/**
 * Zod schema for select-tool request body
 */
export const selectToolSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  toolId: z.string().uuid().optional(),
  action: z.enum(['select', 'reject']),
});

/**
 * Type for validated select-tool request
 */
export type SelectToolRequest = z.infer<typeof selectToolSchema>;

/**
 * Response structure for admin API
 */
export interface AdminApiResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Error response structure
 */
export interface AdminApiError {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * Creates an Express router with admin endpoints
 */
export function createAdminRouter(): Router {
  const router = Router();

  // JSON body parsing only for POST/PUT/PATCH requests
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (!req.is('application/json')) {
        res.status(415).json({
          success: false,
          error: 'Content-Type must be application/json',
        } as AdminApiError);
        return;
      }
    }
    next();
  });

  /**
   * POST /admin/select-tool
   *
   * Handles manual tool selection for pending choices.
   * - action: 'select' with toolId - Installs the selected tool
   * - action: 'reject' - Rejects all options
   */
  router.post('/select-tool', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const parseResult = selectToolSchema.safeParse(req.body);

      if (!parseResult.success) {
        log('warn', 'admin_select_tool_invalid_body', {
          errors: parseResult.error.issues,
        });

        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        } as AdminApiError);
        return;
      }

      const { requestId, toolId, action } = parseResult.data;

      log('info', 'admin_select_tool_request', { requestId, toolId, action });

      // Check if pending selection exists
      const pending = getPendingChoices(requestId);

      if (!pending) {
        log('warn', 'admin_select_tool_not_found', { requestId });

        res.status(404).json({
          success: false,
          error: 'Pending selection not found or expired',
          details: { requestId },
        } as AdminApiError);
        return;
      }

      // Handle action
      if (action === 'reject') {
        // Clear pending choices
        clearPendingChoices(requestId);
        notifySelectionRejected(requestId);

        log('info', 'admin_select_tool_rejected', { requestId });

        res.status(200).json({
          success: true,
          message: 'Selection rejected. No tool will be installed.',
          data: { requestId },
        } as AdminApiResponse);
        return;
      }

      // action === 'select'
      if (!toolId) {
        res.status(400).json({
          success: false,
          error: 'toolId is required when action is "select"',
        } as AdminApiError);
        return;
      }

      // Verify toolId is in the candidate list
      const selectedTool = pending.candidates.find((t) => t.id === toolId);

      if (!selectedTool) {
        log('warn', 'admin_select_tool_invalid_tool', {
          requestId,
          toolId,
          validToolIds: pending.candidates.map((t) => t.id),
        });

        res.status(400).json({
          success: false,
          error: 'Selected tool is not in the candidate list',
          details: {
            toolId,
            validToolIds: pending.candidates.map((t) => t.id),
          },
        } as AdminApiError);
        return;
      }

      // Install the tool
      try {
        const installResult = await installTool(pending.userId, selectedTool);

        // Clear pending choices
        clearPendingChoices(requestId);
        notifySelectionMade(requestId, toolId, selectedTool.name);

        log('info', 'admin_select_tool_installed', {
          requestId,
          toolId,
          toolName: selectedTool.name,
          userId: pending.userId,
        });

        res.status(200).json({
          success: true,
          message: `Tool "${selectedTool.name}" installed successfully`,
          data: {
            requestId,
            toolId,
            toolName: selectedTool.name,
            canonicalName: installResult.canonicalName,
            isNewInstall: installResult.isNewInstall,
          },
        } as AdminApiResponse);
      } catch (installError) {
        log('error', 'admin_select_tool_install_failed', {
          requestId,
          toolId,
          error: (installError as Error).message,
        });

        res.status(500).json({
          success: false,
          error: 'Failed to install tool',
          details: { message: (installError as Error).message },
        } as AdminApiError);
      }
    } catch (error) {
      log('error', 'admin_select_tool_error', {
        error: (error as Error).message,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: { message: (error as Error).message },
      } as AdminApiError);
    }
  });

  /**
   * GET /admin/pending
   *
   * Lists all pending selections (for debugging)
   */
  router.get('/pending', (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;

    log('info', 'admin_list_pending', { userId });

    // Import dynamically to avoid circular dependencies
    import('../discovery/interaction/pendingState.js').then((module) => {
      const { getPendingChoicesForUser, getPendingCount } = module;

      if (userId) {
        const pending = getPendingChoicesForUser(userId);
        res.status(200).json({
          success: true,
          message: `Found ${pending.length} pending selection(s)`,
          data: {
            userId,
            count: pending.length,
            pending: pending.map((p) => ({
              requestId: p.requestId,
              query: p.query,
              candidateCount: p.candidates.length,
              expiresAt: new Date(p.expiresAt).toISOString(),
            })),
          },
        } as AdminApiResponse);
      } else {
        res.status(200).json({
          success: true,
          message: `Total pending selections: ${getPendingCount()}`,
          data: { count: getPendingCount() },
        } as AdminApiResponse);
      }
    });
  });

  /**
   * GET /admin/health
   *
   * Health check for admin API
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Admin API is healthy',
      data: { timestamp: new Date().toISOString() },
    } as AdminApiResponse);
  });

  return router;
}

/**
 * Default admin router instance
 */
export const adminRouter = createAdminRouter();

