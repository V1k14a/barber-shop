# syntax=docker/dockerfile:1

# ---- deps: install all node_modules (incl. dev deps for build + seed) -------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- builder: compile the Next.js app ---------------------------------------
# Also used by the `migrate` service in docker-compose (has prisma CLI + tsx).
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---- runner: minimal production image ---------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Run as the unprivileged "node" user that ships with the official image.
USER node
EXPOSE 3000
CMD ["node", "server.js"]
