import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../../src/config/load';
import { __clearPreviewsForTests, getRecentPreviews, maybePersistCode } from '../../src/codemode/telemetry';

describe('config flags for telemetry and persistence', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:9000';
    delete process.env.CODEMODE_TELEMETRY;
    delete process.env.CODEMODE_PERSIST_CODE;
    __clearPreviewsForTests();
  });

  it('defaults are false', () => {
    const cfg = loadConfig(process.env);
    expect(cfg.codemodeTelemetry).toBe(false);
    expect(cfg.codemodePersistCode).toBe(false);
  });

  it('persist buffer bounded and redacted when enabled', () => {
    process.env.CODEMODE_PERSIST_CODE = 'true';
    const N = 25;
    for (let i = 0; i < N; i++) {
      maybePersistCode(`r-${i}`, `console.log('secret-${i}')`);
    }
    const previews = getRecentPreviews();
    expect(previews.length).toBeLessThanOrEqual(20);
    const any = previews[0];
    expect(any.preview).not.toContain('\n');
  });
});


