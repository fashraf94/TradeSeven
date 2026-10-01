FROM node:24.19.0-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && mkdir -p node_modules/.vite
COPY . .
RUN mkdir -p node_modules/.vite-temp

USER node
ENV HOME=/tmp CI=1 TZ=UTC NODE_ENV=test
ENTRYPOINT ["node", "tester/run-backing-offline.mjs"]
