import { configSchema, OrchestratorConfig } from './schema.js';

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): OrchestratorConfig {
  const parsed = configSchema.safeParse({
    JUNGLE_URL: env.JUNGLE_URL,
    PORT: env.PORT,
    BIND: env.BIND ?? '127.0.0.1',
    LOG_LEVEL: env.LOG_LEVEL ?? 'info',
    JUNGLE_TOKEN: env.JUNGLE_TOKEN,
    ORCH_UPSTREAM_TIMEOUT_MS: env.ORCH_UPSTREAM_TIMEOUT_MS,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${msg}`);
  }
  const data = parsed.data;
  return {
    jungleUrl: data.JUNGLE_URL,
    port: data.PORT,
    bind: data.BIND,
    logLevel: data.LOG_LEVEL,
    jungleToken: data.JUNGLE_TOKEN,
    upstreamTimeoutMs: data.ORCH_UPSTREAM_TIMEOUT_MS,
  };
}
