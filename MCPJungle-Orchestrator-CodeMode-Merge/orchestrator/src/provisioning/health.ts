import { fetch } from 'undici';

export async function waitForHealthy(baseUrl: string, opts: { timeoutMs: number; backoffMs: number }): Promise<void> {
  const start = Date.now();
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(Math.min(2000, opts.timeoutMs)) });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json && json.status === 'ok') return;
      }
    } catch {}
    attempt++;
    const elapsed = Date.now() - start;
    if (elapsed >= opts.timeoutMs) throw new Error('HealthTimeout');
    const jitter = Math.random() * opts.backoffMs;
    const sleep = opts.backoffMs * Math.pow(2, Math.min(attempt, 4)) + jitter;
    await new Promise((r) => setTimeout(r, Math.min(sleep, 2000)));
  }
}


