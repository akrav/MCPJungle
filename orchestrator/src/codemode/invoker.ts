import { postToJungle } from '../server/upstream.js';
import { log } from '../obs/log.js';

export type InvokeContext = {
  userId?: string;
  runId?: string;
  cancelToken?: AbortSignal;
};

function generateJsonRpcId(): string {
  const rnd = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}-${rnd}`;
}

export async function invokeTool(
  functionName: string,
  args: unknown,
  ctx: InvokeContext = {},
): Promise<unknown> {
  const id = generateJsonRpcId();
  const runId = ctx.runId || id;
  log('info', 'codemode_bridge_start', { runId, fn: functionName });
  // Safely log request size without revealing contents
  try {
    const argSize = JSON.stringify(args ?? {}).length;
    log('debug', 'codemode_bridge_request', { runId, fn: functionName, arg_bytes: argSize });
  } catch {}

  const body = {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: functionName, arguments: args },
  } as const;

  const abortController = new AbortController();
  const signal = ctx.cancelToken
    ? ((): AbortSignal => {
        // propagate cancel to fetch & send JSON-RPC cancel
        const onAbort = async () => {
          try {
            await postToJungle(
              { jsonrpc: '2.0', id, method: 'cancel', params: { id } },
              { userId: ctx.userId, useSession: true },
            );
            log('info', 'codemode_bridge_cancel_sent', { runId, fn: functionName });
          } finally {
            abortController.abort();
          }
        };
        ctx.cancelToken.addEventListener('abort', onAbort, { once: true });
        return abortController.signal;
      })()
    : abortController.signal;

  const res = await postToJungle(body, { userId: ctx.userId, useSession: true, signal });

  const ctype = res.headers.get('content-type') || '';
  const isJson = typeof ctype === 'string' && ctype.startsWith('application/json');

  // Aggregate streaming JSON to a final object
  if (isJson) {
    const text = await res.text();
    // emit a synthetic chunk log for observability
    log('info', 'codemode_bridge_chunk', { runId, size: text.length });
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      const err = new Error('Invalid JSON from upstream');
      (err as any).cause = e;
      log('warn', 'codemode_bridge_parse_error', { runId });
      throw err;
    }
      log('info', 'codemode_bridge_end', { runId, ok: true });
    if (json && typeof json === 'object') {
      if ('error' in json && json.error) {
        const err = json.error as { code?: number; message?: string };
        const e = new Error(err.message || 'Upstream error');
        (e as any).code = err.code ?? -32000;
        throw e;
      }
        if ('result' in json) {
          const res = (json as any).result;
          // Log size/type, not content
          try {
            const bytes = JSON.stringify(res).length;
            const type = Array.isArray(res) ? 'array' : typeof res;
            log('debug', 'codemode_bridge_response', { runId, fn: functionName, result_bytes: bytes, result_type: type });
          } catch {}
          return res;
        }
    }
    return json;
  }

  // Non-JSON → map to server error
  const status = res.status;
  const e = new Error(`Server error (${status})`);
  (e as any).code = -32000;
  (e as any).status = status;
  log('warn', 'codemode_bridge_end', { runId, ok: false, status });
  throw e;
}


