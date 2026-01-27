import { JsonRpcRequest } from './types';

export function isJsonRpcObject(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.jsonrpc === '2.0' && typeof v.method === 'string' && !Array.isArray(value)
  );
}
