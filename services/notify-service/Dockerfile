FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/notify-service ./services/notify-service

RUN npm ci --workspace=packages/shared --workspace=services/notify-service
RUN npm run build -w packages/shared
RUN npm run build -w services/notify-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3005

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY services/notify-service/package.json ./services/notify-service/package.json
COPY --from=builder /app/services/notify-service/dist ./services/notify-service/dist

RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/notify-service

USER node
EXPOSE 3005

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost:${PORT}/health || exit 1

CMD ["node", "services/notify-service/dist/index.js"]
