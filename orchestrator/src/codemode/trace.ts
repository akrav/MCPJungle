import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { loadConfig } from '../config/load.js';

const runIdToFile: Map<string, string> = new Map();

function isEnabled(): boolean {
  const cfg = loadConfig(process.env);
  return Boolean(cfg.codemodeVerboseLogs);
}

function getDir(): string | null {
  const cfg = loadConfig(process.env);
  return cfg.codemodeLogDir || null;
}

export async function initTrace(runId: string, extra?: Record<string, unknown>): Promise<void> {
  if (!isEnabled()) return;
  const dir = getDir();
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `codemode-run-${runId}.log`);
  runIdToFile.set(runId, file);
  const ts = new Date().toISOString();
  const hdr = `[${ts}] start runId=${runId}${extra ? ' ' + JSON.stringify(extra) : ''}\n`;
  await fs.appendFile(file, hdr, 'utf8');
}

export async function trace(runId: string, stage: string, fields?: Record<string, unknown>): Promise<void> {
  if (!isEnabled()) return;
  const file = runIdToFile.get(runId);
  if (!file) return;
  const ts = new Date().toISOString();
  const body = fields ? JSON.stringify(fields) : '';
  await fs.appendFile(file, `[${ts}] ${stage} ${body}\n`, 'utf8');
}


