# ── base: install Node dependencies ───────────────────────────────────────────
FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── dev: Angular dev server with hot-reload ────────────────────────────────────
FROM base AS dev

COPY . .

EXPOSE 4200

CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]

# ── build: production Angular build ───────────────────────────────────────────
FROM base AS build

COPY . .
RUN npx ng build --configuration production

# ── prod: Nginx serving the production build ───────────────────────────────────
FROM nginx:1.27-alpine AS prod

COPY --from=build /app/dist/labhive-ui/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
