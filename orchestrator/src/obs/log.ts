export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACT_KEYS = [/authorization/i, /token/i, /api[-_]?key/i, /secret/i];

function redact(value: unknown): unknown {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) return value.map(redact);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.some((r) => r.test(k))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function log(
  level: LogLevel,
  message: string,
  fields?: Record<string, unknown>,
) {
  const traceIds = getTraceIds();
  const base = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...(traceIds ? traceIds : {}),
  } as Record<string, unknown>;

  const redacted = fields
    ? (redact(fields) as Record<string, unknown>)
    : undefined;
  const payload = redacted ? { ...base, ...redacted } : base;

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

function getTraceIds(): { trace_id: string; span_id: string } | null {
  try {
    // dynamic import to avoid hard dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ot = require('@opentelemetry/api');
    const span = ot.trace.getSpan(ot.context.active());
    const sc = span?.spanContext();
    if (sc && sc.traceId && sc.spanId) return { trace_id: sc.traceId, span_id: sc.spanId };
  } catch {}
  return null;
}
