import express from 'express';
import helmet from 'helmet';
import { healthz } from '../health/healthz';
import { isJsonRpcObject } from '../jsonrpc/validate';
import { InvalidRequest, MethodNotFound } from '../jsonrpc/errors';
import type { JsonRpcSuccess } from '../jsonrpc/types';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', healthz);

// Explicitly reject GET on /mcp per bootstrap contract
app.get('/mcp', (_req, res) => res.sendStatus(405));

// Minimal /mcp POST bootstrap: reject arrays, accept single object
app.post('/mcp', (req, res) => {
  const body = req.body;
  if (Array.isArray(body)) {
    return res.json(InvalidRequest(null));
  }
  if (!isJsonRpcObject(body)) {
    // attempt to grab potential id if present
    const id = body && typeof body === 'object' && 'id' in body ? (body as any).id ?? null : null;
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

  return res.json(MethodNotFound(id));
});

export default app;
