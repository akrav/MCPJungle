import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/load';

describe('provisioning config flags', () => {
  it('defaults applied', () => {
    process.env.JUNGLE_URL = 'http://shared.example';
    delete process.env.PROVISIONER;
    delete process.env.PROVISION_ON_DEMAND;
    delete process.env.JUNGLE_HEALTH_TIMEOUT_MS;
    delete process.env.JUNGLE_HEALTH_BACKOFF_MS;
    const cfg = loadConfig(process.env);
    expect(cfg.provisioner).toBe('none');
    expect(cfg.provisionOnDemand).toBe(false);
    expect(cfg.jungleHealthTimeoutMs).toBeGreaterThan(1000);
    expect(cfg.jungleHealthBackoffMs).toBeGreaterThan(0);
  });
});


