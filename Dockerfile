FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@12.3.4
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/artifacts/api-server/dist ./dist
USER node
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
