# ---------- Build stage ----------
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle

RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Compiled JS + generated SQL migrations
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

EXPOSE 8080

# Default entrypoint = API. Jobs override the command:
#   collector:  node dist/jobs/collect.js
#   newsletter: node dist/jobs/sendNewsletters.js
CMD ["node", "dist/index.js"]
