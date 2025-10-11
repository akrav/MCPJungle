import { Request, Response } from 'express';

export function healthz(_req: Request, res: Response) {
  res.json({ ok: true });
}
