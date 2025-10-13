import type { Request, Response, NextFunction } from 'express';
import { MethodNotFound } from '../jsonrpc/errors';

const allowed = new Set(['initialize', 'tools/list', 'tools/call', 'cancel']);

export function authorizeMethods() {
  return function authorize(req: Request, res: Response, next: NextFunction) {
    const method = (req.body && typeof req.body === 'object') ? (req.body as any).method : undefined;
    if (typeof method !== 'string') return next();
    if (!allowed.has(method)) return res.json(MethodNotFound((req.body as any).id ?? null));
    next();
  };
}


