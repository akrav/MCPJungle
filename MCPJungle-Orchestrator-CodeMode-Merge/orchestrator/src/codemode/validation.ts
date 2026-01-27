export function assertJsonSerializable(value: unknown): void {
  try {
    // Functions and symbols will drop; explicitly guard common invalid types
    if (typeof value === 'function' || typeof value === 'symbol') {
      throw new Error('Arguments must be JSON-serializable');
    }
    JSON.stringify(value);
  } catch {
    throw new Error('Arguments must be JSON-serializable');
  }
}


