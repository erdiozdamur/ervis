FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl libssl3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Defensive cleanup: previous deployments may leave stale route files that
# can cause Next.js "parallel pages resolve to the same path" build errors.
RUN rm -f "app/(admin)/app/admin/page.tsx" "app/(admin)/app/admin/layout.tsx"
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port=process.env.PORT||'3000'; fetch(`http://127.0.0.1:${port}/healthz`).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "run", "start:prod"]
