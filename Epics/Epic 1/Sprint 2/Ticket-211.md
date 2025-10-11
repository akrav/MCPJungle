## Ticket-211 — Minimal rate limiting around `/mcp`

**What / Why**
Add **express-rate-limit** at `/mcp` to reduce abuse; conservative defaults. 

**Where**
`/src/security/rateLimit.ts` (wired in `server/http.ts`)

**Tests**
`rate_limit.spec.ts`: send (limit + 1) requests fast → last gets **429**; reset after window.

**LLM priming**
`express-rate-limit`, `windowMs`, `max`, `Retry-After`.

---

## How to run Sprint 2 tests locally

```bash
npm i

# Run only Sprint 2 tests
npm run test -- tests/sprint2

# Optional: set OTLP endpoint to see spans/metrics
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
npm run dev
```

---

### Why these priming cues work

They mirror the exact APIs and best-practice vocab you’re already using—**Bearer per RFC-6750**, **OWASP API** allow-listing, **Helmet** + strict JSON parsing, **OpenTelemetry** Node SDK (traces/metrics), **AbortSignal.timeout**—nudging the model toward **idiomatic TS/Node** while keeping the proxy contract intact. 

If you want, I can also drop tiny **skeleton files** (headers + TODO asserts) so several of these tickets go green with near-zero extra calls.
