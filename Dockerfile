# syntax=docker/dockerfile:1

# ---- build the web app ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY server/src server/src
COPY web web
# Optional: use another tile provider instead of the public OpenStreetMap servers.
ARG VITE_TILE_URL
ARG VITE_TILE_ATTRIBUTION
RUN npm run build -w web

# ---- runtime: one Node process serving the API and the built web app ----
FROM node:22-alpine
ENV NODE_ENV=production PORT=3001 CACHE_DIR=/data WEB_DIST=/app/web/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev -w server && npm cache clean --force
COPY server/tsconfig.json server/
COPY server/src server/src
COPY --from=build /app/web/dist web/dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3001
# Static GTFS is parsed before the server listens, so allow a generous start period.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["npx", "tsx", "server/src/index.ts"]
