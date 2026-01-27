import helmet from 'helmet';
import type { RequestHandler } from 'express';

export function applyHelmet(): RequestHandler {
  // Defaults are sufficient; can be tuned later
  return helmet();
}


