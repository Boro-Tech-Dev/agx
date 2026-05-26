# Build compiles worker + suite-core on slim Node. Runtime uses Microsoft's Playwright image
# (Chromium + OS deps) so screenshots/PDF work when enabled in the dashboard.
# Keep playwright version in suite-core/package.json in sync with mcr.microsoft.com/playwright:v* below.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY suite-core/package.json ./suite-core/
RUN npm ci 2>/dev/null || npm install
COPY suite-core/ ./suite-core/
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.60.0-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4317
# Use browsers baked into the Playwright image (must match npm playwright version).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/suite-core/package.json ./suite-core/
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/suite-core/dist ./suite-core/dist
EXPOSE 4317
CMD ["node", "dist/server.js"]
