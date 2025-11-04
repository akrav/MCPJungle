import type { Request } from 'express';
import { fetch } from 'undici';
import { loadConfig } from '../config/load.js';

export type UpstreamTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export class UpstreamClient {
  private sessionId: string | null = null;

  private headersFor(req: Request, extra?: Record<string, string>): Record<string, string> {
    const cfg = loadConfig(process.env);
    const base: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'User-Agent': 'orchestrator/1.0',
      Forwarded: 'proto=http',
      ...(cfg.jungleToken ? { Authorization: `Bearer ${cfg.jungleToken}` } : {}),
      ...(req.headers['x-user-id'] ? { 'x-user-id': String(req.headers['x-user-id']) } : {}),
    };
    if (this.sessionId) base['Mcp-Session-Id'] = this.sessionId;
    return { ...base, ...(extra || {}) };
  }

  private async ensureSession(req: Request, initId: string | number | null): Promise<void> {
    if (this.sessionId) return;
    const cfg = loadConfig(process.env);
    const res = await fetch(`${cfg.jungleUrl}/mcp`, {
      method: 'POST',
      headers: this.headersFor(req),
      body: JSON.stringify({ jsonrpc: '2.0', id: initId ?? 0, method: 'initialize' }),
      signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
    });
    const s = res.headers.get('mcp-session-id');
    if (s && s.trim() !== '') this.sessionId = s;
  }

  async listTools(req: Request, id: string | number | null): Promise<UpstreamTool[]> {
    const cfg = loadConfig(process.env);
    await this.ensureSession(req, id);
    const res = await fetch(`${cfg.jungleUrl}/mcp`, {
      method: 'POST',
      headers: this.headersFor(req),
      body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list' }),
      signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
    });
    const reflected = res.headers.get('mcp-session-id');
    if (reflected && reflected.trim() !== '') this.sessionId = reflected;
    const json = await res.json();
    const tools = (json?.result?.tools ?? []) as UpstreamTool[];
    return tools;
  }

  async callTool(req: Request, id: string | number | null, name: string, args: Record<string, unknown>): Promise<any> {
    const cfg = loadConfig(process.env);
    await this.ensureSession(req, id);
    const res = await fetch(`${cfg.jungleUrl}/mcp`, {
      method: 'POST',
      headers: this.headersFor(req),
      body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
      signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
    });
    const reflected = res.headers.get('mcp-session-id');
    if (reflected && reflected.trim() !== '') this.sessionId = reflected;
    const json = await res.json();
    const result = json?.result;
    if (!result) return undefined;
    if (result.isError) throw new Error(`Tool execution failed: ${JSON.stringify(result.content)}`);
    const content = Array.isArray(result.content) ? result.content[0] : result.content;
    if (content && typeof content === 'object' && 'type' in content && (content as any).type === 'text') {
      const text = (content as any).text;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return content;
  }
}


