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
});

export type OrchestratorConfig = {
  jungleUrl: string;
  port: number;
  bind: string;
  logLevel: string;
  jungleToken?: string;
  upstreamTimeoutMs: number;
};
