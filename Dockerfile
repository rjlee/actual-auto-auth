FROM node:22.14.0-slim AS deps

WORKDIR /app

ENV HUSKY=0

COPY package.json package-lock.json ./
ENV HUSKY=0
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22.14.0-slim AS runner

WORKDIR /app

COPY --from=deps /app /app
COPY . .

RUN chmod +x /app/bin/healthcheck.sh

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD /app/bin/healthcheck.sh

ENTRYPOINT ["node", "src/index.js"]
