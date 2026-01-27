import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as router from '../../src/routing/router';

describe('router ensure on miss (provision)', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://shared.example';
    process.env.ROUTING_MODE = 'per_user';
    process.env.PROVISION_ON_DEMAND = 'true';
  });

  it('provisions endpoint and returns per_user decision', async () => {
    const mockProv = { provision: vi.fn(async () => ({ baseUrl: 'http://127.0.0.1:49000' })) } as any;
    const types = await import('../../src/provisioning/types');
    const health = await import('../../src/provisioning/health');
    vi.spyOn(types, 'getProvisioner').mockReturnValue(mockProv);
    vi.spyOn(health, 'waitForHealthy').mockResolvedValue(void 0 as any);
    const d = await router.resolveJungleEndpoint({ userId: 'uA' });
    expect(d.mode).toBe('per_user');
    expect(d.baseUrl).toBe('http://127.0.0.1:49000');
  });
});


