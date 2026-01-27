import type { Request, Response, NextFunction } from 'express';
import { ServerError } from '../jsonrpc/errors.js';

function parseBearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

export function bearerAuth() {
  return function bearer(req: Request, res: Response, next: NextFunction) {
    const requireBearer = String(process.env.REQUIRE_BEARER || 'false') === 'true';
    const token = parseBearer(req.header('authorization'));
    (res.locals as any).auth = { token: token ?? undefined };
    if (requireBearer && !token) {
      // Return JSON-RPC server error per contract
      return res.json(ServerError(null, 401, { reason: 'missing_bearer' }));
    }
    next();
  };
}


