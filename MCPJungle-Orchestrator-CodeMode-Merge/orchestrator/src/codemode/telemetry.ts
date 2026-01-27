import crypto from 'node:crypto';
import { loadConfig } from '../config/load.js';
import { incCounter, recordHistogram, recordTestSpanIfAvailable } from '../obs/otel.js';

export type TelemetryAttrs = {
  run_id?: string;
  user_id?: string;
  tool_name?: string;
  catalog_hash?: string;
};

export function computeCodeHash(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// In-memory, bounded persistence buffer (dev-only)
type RunPreview = { run_id: string; code_hash: string; preview: string };
const MAX_PREVIEWS = 20;
const previews: RunPreview[] = [];

export function maybePersistCode(runId: string, code: string): void {
  const cfg = loadConfig(process.env);
  if (!cfg.codemodePersistCode) return;
  const code_hash = computeCodeHash(code);
  const preview = redactPreview(code);
  previews.push({ run_id: runId, code_hash, preview });
  if (previews.length > MAX_PREVIEWS) previews.shift();
}

export function getRecentPreviews(): RunPreview[] {
  return [...previews];
}

export function __clearPreviewsForTests(): void {
  previews.length = 0;
}

function redactPreview(code: string): string {
  const trimmed = code.trim();
  // Simple preview: first 120 chars, without newlines
  const flat = trimmed.replace(/\s+/g, ' ');
  return flat.slice(0, 120);
}

export async function withRunSpan<T>(attrs: TelemetryAttrs, fn: () => Promise<T>): Promise<T> {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) recordTestSpanIfAvailable('codemode.run', attrs as Record<string, unknown>);
  return fn();
}

export async function withCompileSpan<T>(attrs: TelemetryAttrs, fn: () => Promise<T>): Promise<T> {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) recordTestSpanIfAvailable('codemode.compile', attrs as Record<string, unknown>);
  return fn();
}

export async function withEvalSpan<T>(attrs: TelemetryAttrs, fn: () => Promise<T>): Promise<T> {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) recordTestSpanIfAvailable('codemode.eval', attrs as Record<string, unknown>);
  return fn();
}

export async function withToolCallSpan<T>(toolName: string, attrs: TelemetryAttrs, fn: () => Promise<T>): Promise<T> {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) recordTestSpanIfAvailable(`codemode.tool.${toolName}`, attrs as Record<string, unknown>);
  return fn();
}

export function recordCompileMs(ms: number): void {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) recordHistogram('codemode_compile_ms', ms);
}

export function recordEvalMs(ms: number): void {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) recordHistogram('codemode_eval_ms', ms);
}

export function incToolCalls(n = 1): void {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) incCounter('tool_calls_total', n);
}

export function incErrors(kind: 'compile' | 'eval' | 'invoke' | 'limit_exceeded'): void {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) incCounter(`codemode_errors_total.${kind}`, 1);
}

export function recordLimitEvent(limit: 'maxExecutionTime'|'maxMemoryMB'|'maxOutputBytes'|'maxToolCalls', attrs: TelemetryAttrs): void {
  const cfg = loadConfig(process.env);
  if (cfg.codemodeTelemetry) recordTestSpanIfAvailable('codemode.limit', { ...attrs, limit } as Record<string, unknown>);
}


