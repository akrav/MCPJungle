import { Request, Response } from 'express';
import { loadConfig } from '../config/load.js';

const VERSION = '0.1.0';

export function healthz(_req: Request, res: Response) {
  const cfg = loadConfig(process.env);
  res.json({ ok: true, version: VERSION, jungleUrl: cfg.jungleUrl });
}
