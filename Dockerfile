FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.28.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY tools/game-cli/package.json tools/game-cli/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src
COPY apps/web/index.html apps/web/vite.config.ts apps/web/tsconfig*.json apps/web/
COPY apps/web/src apps/web/src
COPY packages/game-engine/src packages/game-engine/src
COPY packages/protocol/src packages/protocol/src
RUN pnpm --filter web build && pnpm --filter server build

FROM node:24-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.28.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY tools/game-cli/package.json tools/game-cli/package.json
RUN pnpm --filter server... install --prod --frozen-lockfile

COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/packages/game-engine/src packages/game-engine/src
COPY --from=build /app/packages/protocol/src packages/protocol/src

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
