FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/auth-service ./services/auth-service

RUN npm ci --workspace=packages/shared --workspace=services/auth-service
RUN npm run build -w packages/shared
RUN npm run build -w services/auth-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY services/auth-service/package.json ./services/auth-service/package.json
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist

RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/auth-service

USER node
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost:${PORT}/health || exit 1

CMD ["node", "services/auth-service/dist/index.js"]
