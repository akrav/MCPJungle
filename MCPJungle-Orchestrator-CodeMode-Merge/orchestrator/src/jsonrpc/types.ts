export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcErrorObj {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcErrorObj;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;
