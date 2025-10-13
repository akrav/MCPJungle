import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Sprint3 Ticket-310 K8s skeleton manifests', () => {
  it('deployment has probes to /healthz', () => {
    const s = fs.readFileSync(path.join(__dirname, '../../deploy/k8s/deployment.yaml'), 'utf8');
    expect(s).toContain('readinessProbe');
    expect(s).toContain('/healthz');
    expect(s).toContain('startupProbe');
  });
  it('service exposes port 80 -> 8080', () => {
    const s = fs.readFileSync(path.join(__dirname, '../../deploy/k8s/service.yaml'), 'utf8');
    expect(s).toContain('targetPort: 8080');
  });
});
