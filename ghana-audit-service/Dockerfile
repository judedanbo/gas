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
ARG NUXT_PUBLIC_SITE_URL=https://test.audit.gov.gh
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
# migrate.ts imports baseline.ts (squash-baseline reconciliation) — both required.
COPY server/database/baseline.ts ./server/database/baseline.ts
# migrate.ts, reset.ts, seed.ts and the seeds/ scripts all import the shared
# sanitized logger (server/utils/logger.ts). It is dependency-free, so this is
# the only server/utils file the migrator image needs.
COPY server/utils/logger.ts ./server/utils/logger.ts
# reset.ts powers the (manual, suspended) k8s/jobs/reset-job.yaml. It is NOT the
# default command and is heavily guarded; see that manifest.
COPY server/database/reset.ts ./server/database/reset.ts
# seed.ts + seeds/ power the (manual) k8s/jobs/seed-job.yaml (npm run db:seed:all).
# The seed scripts import server/database/schema/index and read seeds/data/*.json
# fixtures, so all three paths must be present. Not the default command.
COPY server/database/seed.ts ./server/database/seed.ts
COPY server/database/seeds ./server/database/seeds
COPY server/database/schema ./server/database/schema

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

# Runtime tools used in the request path / background jobs:
#   chromium + font libs  -> analytics PDF export (/api/admin/analytics/report.pdf)
#   poppler-utils         -> thumbnail generation (pdftoppm) + report optimization
#                            (pdfinfo/pdftotext/pdffonts/pdfimages)
#   ghostscript, qpdf,    -> report PDF optimization pipeline (server/utils/pdfOptimizer.ts).
#   tesseract-ocr            The optimize job is launched detached from the request but runs
#                            IN-PROCESS in this runner (server/api/admin/reports/optimize.post.ts),
#                            so the full toolchain must be present here or optimization fails
#                            with MISSING_BINARY. tesseract-ocr-data-eng supplies the OCR language.
RUN apk add --no-cache \
        chromium \
        nss \
        freetype \
        harfbuzz \
        ca-certificates \
        ttf-freefont \
        ttf-opensans \
        fontconfig \
        poppler-utils \
        ghostscript \
        qpdf \
        tesseract-ocr \
        tesseract-ocr-data-eng && \
    fc-cache -f
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# The runtime never invokes a package manager (CMD is plain `node`), but the
# base image bundles npm/corepack/yarn — and npm vendors its own node_modules
# (tar, glob, ...) that regularly trip the deploy's fail-on-critical Trivy
# gate (e.g. CVE-2026-59873 in npm's bundled tar) even though nothing here
# executes them. Removing the package managers eliminates that attack surface.
# The migrator stage keeps npm — its CMD needs `npm run db:apply`.
RUN rm -rf /usr/local/lib/node_modules/npm \
        /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

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
