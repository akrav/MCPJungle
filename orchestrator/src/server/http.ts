import express from 'express';
import helmet from 'helmet';
import { healthz } from '../health/healthz';
import { isJsonRpcObject } from '../jsonrpc/validate';
import { InvalidRequest, ServerError } from '../jsonrpc/errors';
import type { JsonRpcSuccess } from '../jsonrpc/types';
import { loadConfig } from '../config/load';
import { fetch } from 'undici';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', healthz);

// Explicitly reject GET on /mcp per bootstrap contract
app.get('/mcp', (_req, res) => res.sendStatus(405));

// Minimal /mcp POST bootstrap: reject arrays, accept single object
app.post('/mcp', async (req, res) => {
  const body = req.body;
  if (Array.isArray(body)) {
    return res.json(InvalidRequest(null));
  }
  if (!isJsonRpcObject(body)) {
    // attempt to grab potential id if present
    const id =
      body && typeof body === 'object' && 'id' in body
        ? ((body as Record<string, unknown>).id ?? null)
        : null;
    return res.json(InvalidRequest(id));
  }

  const id = body.id ?? null;
  if (body.method === 'initialize') {
    const resp: JsonRpcSuccess = {
      jsonrpc: '2.0',
      id,
      result: {
        server: { name: 'orchestrator', version: '0.1.0' },
        protocolVersion: '2024-11-05',
      },
    };
    return res.json(resp);
  }

  // Happy-path proxy: forward JSON-RPC body to Jungle and relay response
  const cfg = loadConfig(process.env);
  try {
    const upstream = await fetch(`${cfg.jungleUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const proxyBody = await upstream.text();
    // Try to relay JSON as-is; fall back to server error on parse issues
    try {
      return res.json(JSON.parse(proxyBody));
    } catch {
      return res.json(ServerError(id, upstream.status));
    }
  } catch (e) {
    return res.json(ServerError(id));
  }
});

export default app;
