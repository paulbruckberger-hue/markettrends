# Single image that bundles the React SPA + Express API (+ collector/newsletter jobs).
# Build context = repo root.  Build: docker build -t <img> .
#
# Default CMD starts the API (which also serves the SPA from ./client-dist).
# Jobs override the command:  node dist/jobs/collect.js  /  node dist/jobs/sendNewsletters.js

# ---------- Stage 1: build client (Vite) ----------
FROM node:20-slim AS client-build
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- Stage 2: build server (tsc) ----------
FROM node:20-slim AS server-build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json server/drizzle.config.ts ./
COPY server/src ./src
COPY server/drizzle ./drizzle
RUN npm run build

# ---------- Stage 3: runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=server-build /app/dist ./dist
COPY --from=server-build /app/drizzle ./drizzle
COPY --from=client-build /client/dist ./client-dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
