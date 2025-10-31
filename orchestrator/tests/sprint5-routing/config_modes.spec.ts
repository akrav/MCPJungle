import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/load';

describe('routing config modes', () => {
  it('defaults to shared', () => {
    process.env.JUNGLE_URL = 'http://shared.example';
    delete process.env.ROUTING_MODE;
    const cfg = loadConfig(process.env);
    expect(cfg.routingMode).toBe('shared');
  });

  it('accepts per_user', () => {
    process.env.JUNGLE_URL = 'http://shared.example';
    process.env.ROUTING_MODE = 'per_user';
    const cfg = loadConfig(process.env);
    expect(cfg.routingMode).toBe('per_user');
  });
});


