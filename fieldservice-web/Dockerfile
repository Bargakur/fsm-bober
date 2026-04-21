# ============================================================
# Frontend build — React + Vite → nginx
# ============================================================

# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# API URL — w Railway ustawić na URL backendu (np. https://fsm-api.up.railway.app)
# Lokalnie domyślnie puste = używa /api (proxy przez Vite)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
# nginx:alpine automatycznie podmienia ${PORT} z env vars w /etc/nginx/templates/
# Domyślny port 80 jeśli PORT nie ustawiony
ENV PORT=80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
