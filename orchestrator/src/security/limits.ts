import type { Request, Response, NextFunction } from 'express';
import { InvalidRequest } from '../jsonrpc/errors';

export function enforceJsonAndSize(limitBytes: number = 1_000_000) {
  return function (req: Request, res: Response, next: NextFunction) {
    const ctype = req.headers['content-type'] || '';
    if (typeof ctype !== 'string' || !ctype.startsWith('application/json')) {
      return res.json(InvalidRequest(null));
    }
    const len = req.headers['content-length'];
    if (len) {
      const n = Number(len);
      if (!Number.isNaN(n) && n > limitBytes) {
        return res.json(InvalidRequest(null));
      }
    }
    next();
  };
}


