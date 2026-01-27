import type { Request, Response, NextFunction } from 'express';

export function simpleRateLimit(maxPerWindow = 10, windowMs = 1000) {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return function (req: Request, res: Response, next: NextFunction) {
    const key = req.ip || 'global';
    const now = Date.now();
    const data = hits.get(key) || { count: 0, windowStart: now };
    if (now - data.windowStart > windowMs) {
      data.windowStart = now;
      data.count = 0;
    }
    data.count++;
    hits.set(key, data);
    if (data.count > maxPerWindow) {
      res.status(429).setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.end('Too Many Requests');
    }
    next();
  };
}


