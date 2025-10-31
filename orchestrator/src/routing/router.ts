import { loadConfig } from '../config/load.js';
import { get as storeGet } from './store.js';
import { log } from '../obs/log.js';
import { incCounter } from '../obs/otel.js';
import type { RouteDecision } from './types.js';

export function resolveJungleEndpoint({ userId }: { userId?: string }): RouteDecision {
  const cfg = loadConfig(process.env);
  if (cfg.routingMode === 'shared' || !userId) {
    const decision: RouteDecision = { baseUrl: cfg.jungleUrl, mode: 'shared' };
    log('info', 'route_decision', { mode: decision.mode, user_id: userId || null, baseUrl: decision.baseUrl });
    incCounter('route_mode_total.shared', 1);
    return decision;
  }

  // per_user mode
  const mapped = storeGet(userId);
  if (mapped) {
    const decision: RouteDecision = { baseUrl: mapped, mode: 'per_user' };
    log('info', 'route_decision', { mode: decision.mode, user_id: userId, baseUrl: decision.baseUrl });
    incCounter('route_mode_total.per_user', 1);
    return decision;
  }

  log('warn', 'route_fallback_shared', { user_id: userId });
  const decision: RouteDecision = { baseUrl: cfg.jungleUrl, mode: 'shared' };
  log('info', 'route_decision', { mode: decision.mode, user_id: userId, baseUrl: decision.baseUrl });
  incCounter('route_mode_total.shared', 1);
  return decision;
}


