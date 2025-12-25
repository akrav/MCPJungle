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
    ROUTING_MODE: env.ROUTING_MODE,
    ROUTING_USER_TTL_MS: env.ROUTING_USER_TTL_MS,
    PROVISIONER: env.PROVISIONER,
    PROVISION_ON_DEMAND: env.PROVISION_ON_DEMAND,
    JUNGLE_HEALTH_TIMEOUT_MS: env.JUNGLE_HEALTH_TIMEOUT_MS,
    JUNGLE_HEALTH_BACKOFF_MS: env.JUNGLE_HEALTH_BACKOFF_MS,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_KEY: env.SUPABASE_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
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
    routingMode: data.ROUTING_MODE,
    routingUserTtlMs: data.ROUTING_USER_TTL_MS,
    provisioner: data.PROVISIONER,
    provisionOnDemand: data.PROVISION_ON_DEMAND,
    jungleHealthTimeoutMs: data.JUNGLE_HEALTH_TIMEOUT_MS,
    jungleHealthBackoffMs: data.JUNGLE_HEALTH_BACKOFF_MS,
    supabaseUrl: data.SUPABASE_URL,
    supabaseKey: data.SUPABASE_KEY,
    openaiApiKey: data.OPENAI_API_KEY,
  };
}
