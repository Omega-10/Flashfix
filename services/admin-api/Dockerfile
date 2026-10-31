FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/admin-api ./services/admin-api

RUN npm ci --workspace=packages/shared --workspace=services/admin-api
RUN npm run build -w packages/shared
RUN npm run build -w services/admin-api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3007

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY services/admin-api/package.json ./services/admin-api/package.json
COPY --from=builder /app/services/admin-api/dist ./services/admin-api/dist

RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/admin-api

USER node
EXPOSE 3007

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost:${PORT}/health || exit 1

CMD ["node", "services/admin-api/dist/index.js"]
