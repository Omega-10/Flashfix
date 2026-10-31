FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/store-service ./services/store-service

RUN npm ci --workspace=packages/shared --workspace=services/store-service
RUN npm run build -w packages/shared
RUN npm run build -w services/store-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3006

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY services/store-service/package.json ./services/store-service/package.json
COPY --from=builder /app/services/store-service/dist ./services/store-service/dist

RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/store-service

USER node
EXPOSE 3006

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost:${PORT}/health || exit 1

CMD ["node", "services/store-service/dist/index.js"]
