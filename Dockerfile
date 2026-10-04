# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps — install once, cached on package-lock.json alone
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build needs DATABASE_URL to exist but never connects during the build;
# a placeholder keeps the module-level guard in src/db/client.ts satisfied.
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder-not-used-at-runtime"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

# Chromium for PDF rendering, plus the fonts it needs for Devanagari.
#
# fonts-noto-core is what carries Devanagari here: it ships
# NotoSansDevanagari and NotoSerifDevanagari. There is no
# `fonts-noto-devanagari` package in Debian bookworm — naming it failed the
# build with "Unable to locate package", which is also what would have
# happened on the server had this not been built locally first.
#
# System fonts matter even though the app embeds its own face for the
# certificate: Chromium still needs them for anything rendered outside our
# stylesheet, and a container with no Devanagari at all produces tofu with no
# warning.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-noto-core \
      ca-certificates \
      postgresql-client \
      tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/assets ./src/assets
COPY --from=build /app/drizzle ./drizzle
COPY package.json next.config.ts drizzle.config.ts ./

# Never run the app as root. Chromium in particular should not be.
RUN useradd --system --uid 1001 --create-home shaala \
    && mkdir -p /app/uploads \
    && chown -R shaala:shaala /app
USER shaala

EXPOSE 3000

# tini reaps the zombie processes Chromium leaves behind; without it a
# long-running container accumulates defunct renderers until it runs out of
# process slots.
ENTRYPOINT ["/usr/bin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
