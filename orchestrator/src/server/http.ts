import express from 'express';
import helmet from 'helmet';
import { healthz } from '../health/healthz';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', healthz);

export default app;
