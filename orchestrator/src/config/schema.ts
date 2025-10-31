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
};
