import { loadConfig } from '../config/load.js';
import { get as storeGet, set as storeSet, size as storeSize } from './store.js';
import { log } from '../obs/log.js';
import { incCounter, recordHistogram } from '../obs/otel.js';
import type { RouteDecision } from './types.js';
import { getProvisioner } from '../provisioning/types.js';
import { waitForHealthy } from '../provisioning/health.js';

export async function resolveJungleEndpoint({ userId }: { userId?: string }): Promise<RouteDecision> {
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

  // Optionally provision on demand
  if (cfg.provisionOnDemand) {
    try {
      incCounter('provision_attempts_total', 1);
      log('info', 'provision_start', { user_id: userId });
      const t0 = Date.now();
      const prov = await getProvisioner();
      const { baseUrl } = await prov.provision(userId);
      await waitForHealthy(baseUrl, { timeoutMs: cfg.jungleHealthTimeoutMs, backoffMs: cfg.jungleHealthBackoffMs });
      storeSet(userId, baseUrl, cfg.routingUserTtlMs);
      recordHistogram('provision_time_ms', Date.now() - t0);
      incCounter('route_mode_total.per_user', 1);
      log('info', 'route_provisioned', { user_id: userId, baseUrl });
      // Gauge approximation: set as counter of current known entries
      try { const { setGauge } = await import('../obs/otel.js'); setGauge?.('instances_active', storeSize()); } catch {}
      const decision: RouteDecision = { baseUrl, mode: 'per_user' };
      log('info', 'route_decision', { mode: decision.mode, user_id: userId, baseUrl: decision.baseUrl });
      return decision;
    } catch (e) {
      incCounter('provision_failures_total', 1);
      log('warn', 'route_fallback_shared', { user_id: userId, reason: (e as Error)?.message || 'error' });
    }
  }

  const decision: RouteDecision = { baseUrl: cfg.jungleUrl, mode: 'shared' };
  log('info', 'route_decision', { mode: decision.mode, user_id: userId, baseUrl: decision.baseUrl });
  incCounter('route_mode_total.shared', 1);
  return decision;
}


