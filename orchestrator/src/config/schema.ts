import { z } from 'zod';

export const configSchema = z.object({
  JUNGLE_URL: z.string().url({ message: 'JUNGLE_URL must be a valid URL' }),
  PORT: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? parseInt(v, 10) : 8080))
    .pipe(z.number().int().positive()),
  BIND: z.string().default('127.0.0.1'),
  LOG_LEVEL: z
    .string()
    .optional()
    .transform((v) => v || 'info'),
  JUNGLE_TOKEN: z.string().optional(),
  ORCH_UPSTREAM_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? parseInt(v, 10) : 30000))
    .pipe(z.number().int().positive()),
  CODEMODE_TELEMETRY: z
    .string()
    .optional()
    .transform((v) => String(v || 'false').toLowerCase() === 'true'),
  CODEMODE_PERSIST_CODE: z
    .string()
    .optional()
    .transform((v) => String(v || 'false').toLowerCase() === 'true'),
  CODEMODE_VERBOSE_LOGS: z
    .string()
    .optional()
    .transform((v) => String(v || 'false').toLowerCase() === 'true'),
  CODEMODE_LOG_DIR: z.string().optional(),
  ROUTING_MODE: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v : 'shared'))
    .pipe(z.enum(['shared', 'per_user'])),
  ROUTING_USER_TTL_MS: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? parseInt(v, 10) : 30 * 60 * 1000))
    .pipe(z.number().int().positive()),
  PROVISIONER: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v : 'none'))
    .pipe(z.enum(['none', 'docker', 'k8s'])),
  PROVISION_ON_DEMAND: z
    .string()
    .optional()
    .transform((v) => String(v || 'false').toLowerCase() === 'true'),
  JUNGLE_HEALTH_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? parseInt(v, 10) : 20000))
    .pipe(z.number().int().positive()),
  JUNGLE_HEALTH_BACKOFF_MS: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? parseInt(v, 10) : 250))
    .pipe(z.number().int().positive()),
  // Supabase configuration for tool discovery
  SUPABASE_URL: z
    .string()
    .url({ message: 'SUPABASE_URL must be a valid URL' })
    .optional(),
  SUPABASE_KEY: z.string().optional(),
});

export type OrchestratorConfig = {
  jungleUrl: string;
  port: number;
  bind: string;
  logLevel: string;
  jungleToken?: string;
  upstreamTimeoutMs: number;
  codemodeTelemetry: boolean;
  codemodePersistCode: boolean;
  codemodeVerboseLogs: boolean;
  codemodeLogDir?: string;
  routingMode: 'shared' | 'per_user';
  routingUserTtlMs: number;
  provisioner: 'none' | 'docker' | 'k8s';
  provisionOnDemand: boolean;
  jungleHealthTimeoutMs: number;
  jungleHealthBackoffMs: number;
  // Supabase configuration for tool discovery
  supabaseUrl?: string;
  supabaseKey?: string;
};
