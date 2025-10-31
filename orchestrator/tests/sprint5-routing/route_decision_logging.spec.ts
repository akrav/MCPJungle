import { describe, it, expect, beforeEach } from 'vitest';
import { resolveJungleEndpoint } from '../../src/routing/router';
import { restartOtelForTests, getTestMetrics } from '../../src/obs/otel';

describe('route decision logging & metrics', () => {
  beforeEach(async () => {
    process.env.OTEL_TEST = 'true';
    await restartOtelForTests();
    process.env.JUNGLE_URL = 'http://shared.example';
    process.env.ROUTING_MODE = 'shared';
  });

  it('increments counter per mode', () => {
    resolveJungleEndpoint({ userId: 'u1' });
    const m = getTestMetrics();
    expect(m.counters['route_mode_total.shared']).toBeGreaterThanOrEqual(1);
  });
});


