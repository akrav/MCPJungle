// Lightweight OTEL bootstrap with graceful fallback when deps are unavailable.
// In test mode, we expose a minimal in-memory exporter shape.

let started = false;
let testMode = false;
const testFinishedSpans: Array<{ name: string; attrs?: Record<string, unknown> }> = [];
const testCounters: Record<string, number> = {};
const testHistograms: Record<string, number[]> = {};
const testGauges: Record<string, number> = {};

type InMemoryLikeExporter = { getFinishedSpans(): Array<{ name: string; attrs?: Record<string, unknown> }> };
let testExporter: InMemoryLikeExporter | null = null;

export async function startOtel(): Promise<void> {
  if (started) return;
  const useTest = String(process.env.OTEL_TEST || 'false') === 'true';
  // Fallback: mark as started in test mode with an in-memory buffer
  if (useTest) {
    testMode = true;
    testExporter = { getFinishedSpans: () => testFinishedSpans };
    started = true;
    return;
  }

  // Production path: enable when explicitly requested
  if (String(process.env.OTEL_ENABLE_VENDOR || 'false') === 'true') {
    try {
      // Dynamically import vendor SDKs; optionalDependencies avoid hard CI pinning
      const [{ NodeSDK }, { OTLPTraceExporter }, { Resource }, { SemanticResourceAttributes }, { getNodeAutoInstrumentations }] = await Promise.all([
        import('@opentelemetry/sdk-node'),
        import('@opentelemetry/exporter-trace-otlp-http'),
        import('@opentelemetry/resources'),
        import('@opentelemetry/semantic-conventions'),
        import('@opentelemetry/auto-instrumentations-node'),
      ]);
      const resource = new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: 'orchestrator' });
      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
      const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
      const sdk = new NodeSDK({ resource, traceExporter, instrumentations: [getNodeAutoInstrumentations()] });
      await sdk.start();
      started = true;
      return;
    } catch {
      // If vendor libs are unavailable, fall through to no-op
    }
  }
}

export async function shutdownOtel(): Promise<void> {
  started = false;
  testMode = false;
  testFinishedSpans.length = 0;
}

export async function restartOtelForTests(): Promise<void> {
  await shutdownOtel();
  process.env.OTEL_TEST = 'true';
  await startOtel();
}

export function getTestSpanExporter(): InMemoryLikeExporter | null {
  return testExporter;
}

export function recordTestSpanIfAvailable(name: string, attrs?: Record<string, unknown>): void {
  if (testMode) testFinishedSpans.push({ name, attrs });
}

export function incCounter(name: string, value = 1): void {
  if (testMode) {
    testCounters[name] = (testCounters[name] || 0) + value;
  }
}

export function recordHistogram(name: string, value: number): void {
  if (testMode) {
    if (!testHistograms[name]) testHistograms[name] = [];
    testHistograms[name].push(value);
  }
}

export function getTestMetrics(): { counters: Record<string, number>; histograms: Record<string, number[]> } {
  return { counters: { ...testCounters }, histograms: Object.fromEntries(Object.entries(testHistograms).map(([k,v]) => [k, [...v]])) };
}

export function setGauge(name: string, value: number): void {
  if (testMode) testGauges[name] = value;
}

export function getTestGauges(): Record<string, number> {
  return { ...testGauges };
}


