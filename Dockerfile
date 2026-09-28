FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN corepack enable && corepack prepare pnpm@12.7.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
