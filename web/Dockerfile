# syntax=docker/dockerfile:1
# Next.js dashboard for Cloud Run. Buildpacks symlink node_modules out of the build root,
# which Turbopack's `next build` rejects — so we use a Dockerfile with a real node_modules.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# basePath is baked at build (NEXT_PUBLIC_BASE_PATH) so the public URL stays …/dashboard/
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# next start re-reads next.config at runtime, so NEXT_PUBLIC_BASE_PATH is also provided
# as a runtime env by Cloud Run (--set-env-vars) — keeps build- and run-time basePath in sync.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 8080
CMD ["npm", "run", "start"]
