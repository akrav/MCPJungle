import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    list: { executor: 'constant-vus', vus: 1, duration: '10s' },
    call: { executor: 'constant-vus', vus: 1, duration: '10s', startTime: '0s' },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:8080';

export function list() {
  const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const res = http.post(`${BASE}/mcp`, payload, { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'status 200': (r) => r.status === 200, 'jsonrpc 2.0': (r) => r.json('jsonrpc') === '2.0' });
  sleep(1);
}

export function call() {
  const payload = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call' });
  const res = http.post(`${BASE}/mcp`, payload, { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'status 200': (r) => r.status === 200, 'jsonrpc 2.0': (r) => r.json('jsonrpc') === '2.0' });
  sleep(1);
}
