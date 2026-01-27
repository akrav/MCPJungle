import app from './http.js';
import { loadConfig } from '../config/load.js';

const cfg = loadConfig(process.env);
const port = cfg.port;
const host = cfg.bind || '127.0.0.1';

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`orchestrator listening on http://${host}:${port}`);
});


