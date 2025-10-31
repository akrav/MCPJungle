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
    CODEMODE_TELEMETRY: env.CODEMODE_TELEMETRY,
    CODEMODE_PERSIST_CODE: env.CODEMODE_PERSIST_CODE,
    CODEMODE_VERBOSE_LOGS: env.CODEMODE_VERBOSE_LOGS,
    CODEMODE_LOG_DIR: env.CODEMODE_LOG_DIR,
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
    codemodeTelemetry: data.CODEMODE_TELEMETRY,
    codemodePersistCode: data.CODEMODE_PERSIST_CODE,
    codemodeVerboseLogs: data.CODEMODE_VERBOSE_LOGS,
    codemodeLogDir: data.CODEMODE_LOG_DIR,
  };
}
