# Deployment Guide

Complete guide for deploying codemode-standalone to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Scaling](#scaling)
- [Backup and Recovery](#backup-and-recovery)
- [Security Hardening](#security-hardening)
- [Performance Tuning](#performance-tuning)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | 16.0.0 | 20.x LTS |
| **RAM** | 2GB | 4GB+ |
| **CPU** | 2 cores | 4+ cores |
| **Disk** | 1GB | 10GB+ |
| **OS** | Linux/macOS/Windows | Linux (Ubuntu 22.04) |

### Build Dependencies

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential python3 git

# macOS
xcode-select --install
brew install python

# Verify
node --version  # >= 16.0.0
npm --version   # >= 8.0.0
python3 --version
```

---

## Deployment Options

### Option 1: Docker (Recommended)

#### Dockerfile

```dockerfile
FROM node:20-alpine

# Install build dependencies for isolated-vm
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (if running HTTP server)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Start application
CMD ["node", "dist/your-app.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  codemode:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MAX_EXECUTION_TIME=5000
      - MAX_MEMORY_MB=128
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('healthy')"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s
```

#### Deploy

```bash
# Build image
docker build -t codemode-standalone:latest .

# Run container
docker run -d \
  --name codemode \
  -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  --restart unless-stopped \
  codemode-standalone:latest

# Or use docker-compose
docker-compose up -d
```

---

### Option 2: PM2 (Process Manager)

#### ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'codemode',
    script: './dist/your-app.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production'
    },
    // Resource limits
    max_memory_restart: '1G',
    
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Restart behavior
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000
  }]
};
```

#### Deploy

```bash
# Install PM2 globally
npm install -g pm2

# Build project
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
# Follow the instructions output by the command

# Monitor
pm2 monit

# View logs
pm2 logs codemode
```

---

### Option 3: Kubernetes

#### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: codemode-deployment
  labels:
    app: codemode
spec:
  replicas: 3
  selector:
    matchLabels:
      app: codemode
  template:
    metadata:
      labels:
        app: codemode
    spec:
      containers:
      - name: codemode
        image: your-registry/codemode-standalone:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: codemode-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "1"
          limits:
            memory: "2Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: codemode-service
spec:
  selector:
    app: codemode
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### Deploy

```bash
# Create secrets
kubectl create secret generic codemode-secrets \
  --from-literal=openai-api-key=sk-...

# Apply deployment
kubectl apply -f deployment.yaml

# Check status
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/codemode-deployment
```

---

### Option 4: Serverless (AWS Lambda)

#### handler.ts

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { CodemodeEngine } from './src/index';

const engine = new CodemodeEngine({
  generateCode: yourLLMFunction,
  tools: yourTools,
  securityPolicy: {
    maxExecutionTime: 5000,
    maxMemoryMB: 128
  }
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const request = JSON.parse(event.body || '{}');
    
    const response = await engine.execute({
      userRequest: request.userRequest,
      context: request.context
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

#### serverless.yml

```yaml
service: codemode-standalone

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  memorySize: 2048
  timeout: 30
  environment:
    NODE_ENV: production
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}

functions:
  execute:
    handler: dist/handler.handler
    events:
      - http:
          path: /execute
          method: post
          cors: true

plugins:
  - serverless-offline
  - serverless-plugin-typescript
```

---

## Configuration

### Environment Variables

Create `.env.production`:

```bash
# Environment
NODE_ENV=production

# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Security Policy
MAX_EXECUTION_TIME=5000
MAX_MEMORY_MB=128
ALLOW_NETWORK_ACCESS=false

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9090

# Database (if needed)
DATABASE_URL=postgresql://...

# Redis (for caching)
REDIS_URL=redis://...
```

### Loading Configuration

```typescript
import dotenv from 'dotenv';

// Load environment-specific config
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY,
  
  // Security
  maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '5000'),
  maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '128'),
  allowNetworkAccess: process.env.ALLOW_NETWORK_ACCESS === 'true',
  
  // Server
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0'
};

export default config;
```

---

## Monitoring

### Health Checks

```typescript
import express from 'express';

const app = express();

// Liveness probe - is the app running?
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now()
  });
});

// Readiness probe - is the app ready to serve traffic?
app.get('/ready', async (req, res) => {
  try {
    // Check dependencies
    await checkDependencies();
    
    res.status(200).json({
      status: 'ready',
      dependencies: {
        llm: 'connected',
        tools: 'loaded'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message
    });
  }
});
```

### Metrics

```typescript
import prometheus from 'prom-client';

// Create metrics
const executionDuration = new prometheus.Histogram({
  name: 'codemode_execution_duration_seconds',
  help: 'Duration of code execution',
  labelNames: ['status']
});

const executionCounter = new prometheus.Counter({
  name: 'codemode_executions_total',
  help: 'Total number of executions',
  labelNames: ['status']
});

const memoryUsage = new prometheus.Gauge({
  name: 'codemode_memory_usage_bytes',
  help: 'Current memory usage'
});

// Record metrics
async function executeWithMetrics(request: CodemodeRequest) {
  const timer = executionDuration.startTimer();
  
  try {
    const response = await engine.execute(request);
    
    timer({ status: 'success' });
    executionCounter.inc({ status: 'success' });
    
    return response;
  } catch (error) {
    timer({ status: 'error' });
    executionCounter.inc({ status: 'error' });
    throw error;
  } finally {
    memoryUsage.set(process.memoryUsage().heapUsed);
  }
}

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

### Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Write to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write to file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Use in application
logger.info('Execution started', { requestId, userId });
logger.error('Execution failed', { requestId, error });
```

---

## Scaling

### Horizontal Scaling

```typescript
// Load balancer configuration (nginx)
upstream codemode_backend {
  least_conn;  // Use least connections algorithm
  
  server 10.0.1.1:3000 max_fails=3 fail_timeout=30s;
  server 10.0.1.2:3000 max_fails=3 fail_timeout=30s;
  server 10.0.1.3:3000 max_fails=3 fail_timeout=30s;
}

server {
  listen 80;
  
  location / {
    proxy_pass http://codemode_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
  }
}
```

### Auto-scaling (Kubernetes)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: codemode-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: codemode-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Caching Layer

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

class CachedCodemodeEngine extends CodemodeEngine {
  async execute(request: CodemodeRequest) {
    const cacheKey = this.getCacheKey(request);
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Execute and cache
    const result = await super.execute(request);
    await redis.setex(cacheKey, 3600, JSON.stringify(result)); // 1 hour
    
    return result;
  }
  
  private getCacheKey(request: CodemodeRequest): string {
    return `codemode:${hashRequest(request)}`;
  }
}
```

---

## Backup and Recovery

### Backup Strategy

```typescript
// Backup configuration and state
async function backup() {
  const timestamp = new Date().toISOString();
  
  // Backup configuration
  await backupConfig(`backups/config-${timestamp}.json`);
  
  // Backup tool definitions
  await backupTools(`backups/tools-${timestamp}.json`);
  
  // Backup logs
  await backupLogs(`backups/logs-${timestamp}.tar.gz`);
}

// Run daily
import cron from 'node-cron';
cron.schedule('0 2 * * *', backup);  // 2 AM daily
```

### Disaster Recovery

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Stop accepting new requests
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Wait for existing requests to complete
  await Promise.race([
    waitForRequests(),
    timeout(30000)  // Max 30 seconds
  ]);
  
  // Cleanup
  await cleanup();
  
  process.exit(0);
});
```

---

## Security Hardening

See [SECURITY.md](./SECURITY.md) for detailed security guide.

### Quick Checklist

- [ ] Use HTTPS/TLS for all connections
- [ ] Implement rate limiting
- [ ] Enable CORS appropriately
- [ ] Use strong authentication
- [ ] Encrypt sensitive data
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Monitor for suspicious activity

---

## Performance Tuning

### Node.js Optimization

```bash
# Increase heap size if needed
NODE_OPTIONS="--max-old-space-size=4096" node dist/app.js

# Enable production optimizations
NODE_ENV=production node dist/app.js
```

### Database Optimization

```typescript
// Connection pooling
import { Pool } from 'pg';

const pool = new Pool({
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### Caching Strategy

```typescript
// Multi-level cache
class MultiLevelCache {
  private memoryCache = new Map();
  private redisCache: Redis;
  
  async get(key: string) {
    // L1: Memory cache
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // L2: Redis cache
    const redisValue = await this.redisCache.get(key);
    if (redisValue) {
      this.memoryCache.set(key, JSON.parse(redisValue));
      return JSON.parse(redisValue);
    }
    
    return null;
  }
}
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| High memory usage | Memory leaks | Enable heap snapshots, analyze |
| Slow execution | Heavy tools | Optimize tool implementations |
| Timeout errors | Long-running code | Increase timeout or optimize |
| Connection errors | Network issues | Check network, add retries |

### Debug Mode

```bash
# Enable debug logging
DEBUG=* NODE_ENV=development node dist/app.js

# Or specific modules
DEBUG=codemode:* node dist/app.js
```

---

## Next Steps

After deployment:

1. Monitor metrics and logs
2. Set up alerts
3. Test disaster recovery
4. Document runbooks
5. Train operations team

## Support

For deployment assistance:
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review logs and metrics
- Contact support team

