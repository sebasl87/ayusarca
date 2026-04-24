FROM node:20-slim

# Playwright / Chromium system dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation libglib2.0-0t64 libnss3 libnspr4 \
    libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libdbus-1-3 \
    libxcb1 libxkbcommon0 libx11-6 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64 \
    libatspi2.0-0t64 libwayland-client0 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@3.6.3 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN yarn install --immutable

# Install Playwright Chromium (uses already-installed system libs above)
RUN npx playwright install chromium

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/

ENV NODE_ENV=production
ENV ARCA_HEADLESS=true

CMD ["node", "--import=tsx/esm", "apps/worker/src/index.ts"]
