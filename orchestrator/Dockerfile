FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json .eslintrc.cjs .prettierrc.json ./
COPY src ./src
# Build TS and mirror server entrypoints to the path used in CMD
RUN npm ci && npm run build \
  && mkdir -p dist/server \
  && cp -f dist/src/server/dev.js dist/server/dev.js \
  && cp -f dist/src/server/http.js dist/server/http.js \
  && cp -r dist/src/* dist/

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--experimental-specifier-resolution=node"
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:8080/healthz || exit 1
USER node
CMD ["node","dist/server/dev.js"]


