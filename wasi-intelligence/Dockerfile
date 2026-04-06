FROM node:20-alpine

WORKDIR /app

# Install intelligence server dependencies
COPY wasi-intelligence/package.json wasi-intelligence/package-lock.json* ./wasi-intelligence/
RUN cd wasi-intelligence && npm ci --omit=dev

# Copy all required source trees
COPY wasi-intelligence/ ./wasi-intelligence/
COPY archives-bf-ai/lib/ ./archives-bf-ai/lib/
COPY archives-bf-ai/data/ ./archives-bf-ai/data/
COPY wasi-dex/exports/ ./wasi-dex/exports/

WORKDIR /app/wasi-intelligence

EXPOSE 3200

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3200/api/health || exit 1

CMD ["node", "server.mjs"]
