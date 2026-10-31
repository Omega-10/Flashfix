FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/booking-service ./services/booking-service

RUN npm ci --workspace=packages/shared --workspace=services/booking-service
RUN npm run build -w packages/shared
RUN npm run build -w services/booking-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY services/booking-service/package.json ./services/booking-service/package.json
COPY --from=builder /app/services/booking-service/dist ./services/booking-service/dist

RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/booking-service

USER node
EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost:${PORT}/health || exit 1

CMD ["node", "services/booking-service/dist/index.js"]
