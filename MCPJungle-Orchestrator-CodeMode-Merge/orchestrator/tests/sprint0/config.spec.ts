import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/load';

describe('config loader', () => {
  it('parses valid env with defaults', () => {
    const cfg = loadConfig({
      JUNGLE_URL: 'http://localhost:9000',
    } as NodeJS.ProcessEnv);
    expect(cfg.jungleUrl).toBe('http://localhost:9000');
    expect(cfg.port).toBe(8080);
    expect(cfg.bind).toBe('127.0.0.1');
    expect(cfg.logLevel).toBe('info');
  });

  it('uses provided PORT/BIND/LOG_LEVEL', () => {
    const cfg = loadConfig({
      JUNGLE_URL: 'https://example.com/mcp',
      PORT: '3000',
      BIND: '0.0.0.0',
      LOG_LEVEL: 'debug',
    } as NodeJS.ProcessEnv);
    expect(cfg.port).toBe(3000);
    expect(cfg.bind).toBe('0.0.0.0');
    expect(cfg.logLevel).toBe('debug');
  });

  it('throws on invalid URL', () => {
    expect(() =>
      loadConfig({ JUNGLE_URL: 'not-a-url' } as NodeJS.ProcessEnv),
    ).toThrow(/JUNGLE_URL/);
  });
});
