# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build application
COPY . .
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S arisa && \
    adduser -S arisa -u 1001 -G arisa

# Copy production artifacts
COPY --from=builder --chown=arisa:arisa /app/dist ./dist
COPY --from=builder --chown=arisa:arisa /app/node_modules ./node_modules
COPY --from=builder --chown=arisa:arisa /app/package.json ./
COPY --from=builder --chown=arisa:arisa /app/prisma ./prisma/

USER arisa

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
