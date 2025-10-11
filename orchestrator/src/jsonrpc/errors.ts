import { JsonRpcError } from './types';

function error(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcError {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

export const InvalidRequest = (id: string | number | null, data?: unknown) => error(id, -32600, 'Invalid Request', data);
export const MethodNotFound = (id: string | number | null, data?: unknown) => error(id, -32601, 'Method not found', data);
export const InternalError = (id: string | number | null, data?: unknown) => error(id, -32603, 'Internal error', data);

export const ServerError = (id: string | number | null, status?: number, info?: unknown) =>
  error(id, -32000, 'Server error', { status, info });
