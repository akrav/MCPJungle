export type SecurityLimits = {
  maxExecutionTime: number; // ms
  maxMemoryMB: number; // MB
  maxToolCalls: number;
  maxOutputBytes: number;
  allowNetworkAccess: boolean;
};

export const DEFAULT_LIMITS: SecurityLimits = {
  maxExecutionTime: 10000,
  maxMemoryMB: 128,
  maxToolCalls: 50,
  maxOutputBytes: 1_000_000,
  allowNetworkAccess: false,
};

export function buildLimits(overrides?: Partial<SecurityLimits>): SecurityLimits {
  return { ...DEFAULT_LIMITS, ...(overrides || {}) };
}


