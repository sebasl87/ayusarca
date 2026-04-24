FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare yarn@3.6.3 --activate

WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN yarn install --immutable

# playwright install --with-deps maneja los paquetes de sistema correctamente según el OS
RUN node_modules/.bin/playwright install chromium --with-deps

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/

ENV NODE_ENV=production
ENV ARCA_HEADLESS=true

CMD ["node", "--import=tsx/esm", "apps/worker/src/index.ts"]
