import http from 'node:http';

export async function waitForHttp(url: string, timeoutMs = 30000, intervalMs = 500): Promise<void> {
  const start = Date.now();
  while (true) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            res.resume();
            resolve();
          } else {
            reject(new Error(`status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(3000, () => {
          req.destroy(new Error('timeout'));
        });
      });
      return;
    } catch {
      if (Date.now() - start > timeoutMs) throw new Error(`Timeout waiting for ${url}`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}




