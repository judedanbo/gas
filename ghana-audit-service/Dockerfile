# Ghana Audit Service - Nuxt 3 Production Dockerfile
# Multi-stage build for optimized image size

# ===========================================
# Stage 1: Dependencies
# ===========================================
FROM node:24-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --ignore-scripts

# ===========================================
# Stage 2: Builder
# ===========================================
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
# COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ARG NUXT_PUBLIC_SITE_URL=https://audit.gov.gh
ENV NUXT_PUBLIC_SITE_URL=${NUXT_PUBLIC_SITE_URL}

# install npm dependencies
RUN npm install 

# Build the application
RUN npm run build

# ===========================================
# Stage 3: Migrator (run as a one-shot Kubernetes Job)
# ===========================================
FROM node:24-alpine AS migrator

WORKDIR /app

RUN apk add --no-cache libc6-compat

# node_modules from deps stage already includes drizzle-orm, mysql2, and tsx.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server/database/migrations ./server/database/migrations
COPY server/database/migrate.ts ./server/database/migrate.ts

# DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME come from the Job's envFrom.
CMD ["npm", "run", "db:apply"]

# ===========================================
# Stage 4: Production Runner
# ===========================================
FROM node:24-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxtjs

# Copy built application
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxtjs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nuxtjs

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application.
# CMD ["npm", "run", "dev"]
CMD ["node", ".output/server/index.mjs"]
