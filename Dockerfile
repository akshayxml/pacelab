# One image for the whole app: Express serves the API and the built frontend.

FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json backend/.npmrc ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=4000 \
    PACELAB_CACHE_DIR=/data
WORKDIR /app/backend
COPY --from=backend /app/backend/package.json ./
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=frontend /app/frontend/dist /app/frontend/dist
# Best-efforts cache; mount a volume here so it survives redeploys.
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=1m --timeout=5s \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "dist/index.js"]
