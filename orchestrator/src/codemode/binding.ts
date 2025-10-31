export type CodemodeInvoker = (functionName: string, args: unknown) => Promise<unknown>;

export function createCodemodeBinding(invoker: CodemodeInvoker): Record<string, (args: unknown) => Promise<unknown>> {
  const handler: ProxyHandler<Record<string, (args: unknown) => Promise<unknown>>> = {
    get(_target, prop) {
      if (typeof prop !== 'string') {
        throw new Error('Invalid codemode property: non-string keys are not supported');
      }
      return async (args: unknown) => invoker(prop, args);
    },
  };
  return new Proxy({}, handler);
}


