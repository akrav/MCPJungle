import { configSchema, OrchestratorConfig } from './schema';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OrchestratorConfig {
  const parsed = configSchema.safeParse({
    JUNGLE_URL: env.JUNGLE_URL,
    PORT: env.PORT,
    BIND: env.BIND ?? '127.0.0.1',
    LOG_LEVEL: env.LOG_LEVEL ?? 'info',
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${msg}`);
  }
  const data = parsed.data as any;
  return {
    jungleUrl: data.JUNGLE_URL as string,
    port: data.PORT as number,
    bind: data.BIND as string,
    logLevel: data.LOG_LEVEL as string,
  };
}
