import { describe, it, expect } from 'vitest';
import {
  InvalidRequest,
  MethodNotFound,
  InternalError,
  ServerError,
} from '../../src/jsonrpc/errors';

describe('jsonrpc errors', () => {
  it('builds standard errors', () => {
    const e1 = InvalidRequest(1);
    const e2 = MethodNotFound('abc');
    const e3 = InternalError(null);
    expect(e1.error.code).toBe(-32600);
    expect(e2.error.code).toBe(-32601);
    expect(e3.error.code).toBe(-32603);
  });
  it('wraps server errors with status in data', () => {
    const e = ServerError(99, 502);
    // @ts-expect-error data is optional but present here
    expect(e.error.data.status).toBe(502);
  });
});
