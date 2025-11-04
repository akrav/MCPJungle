import fs from 'node:fs';
import path from 'node:path';

const artifactsDir = path.resolve(__dirname, 'artifacts');
const reportPath = path.join(artifactsDir, 'E2E_REPORT.md');

export function reportInit() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(reportPath, `# E2E Test Report\n\nGenerated: ${new Date().toISOString()}\n\n`);
}

export function reportTest(title: string, input: unknown, expected: unknown) {
  const block = [
    `## ${title}`,
    '',
    '**Input**',
    '```json',
    safeJson(input),
    '```',
    '',
    '**Expected**',
    '```json',
    safeJson(expected),
    '```',
    '',
  ].join('\n');
  fs.appendFileSync(reportPath, block);
}

export function reportActual(actual: unknown, passed: boolean) {
  const block = [
    '**Actual**',
    '```json',
    safeJson(actual),
    '```',
    '',
    `Result: ${passed ? 'PASS' : 'FAIL'}`,
    '',
    '---',
    '',
  ].join('\n');
  fs.appendFileSync(reportPath, block);
}

function safeJson(v: unknown) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export function reportPathAbsolute() { return reportPath; }




