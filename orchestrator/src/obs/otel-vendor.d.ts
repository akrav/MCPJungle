declare module '@opentelemetry/sdk-node' {
  export const NodeSDK: any;
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export const OTLPTraceExporter: any;
}

declare module '@opentelemetry/resources' {
  export const Resource: any;
}

declare module '@opentelemetry/semantic-conventions' {
  export const SemanticResourceAttributes: any;
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(): any;
}

