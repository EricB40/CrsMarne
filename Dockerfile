# Monolith: Vite frontend + Express API. Build from repo root

# --- Stage 1: build the SPA (Vite) ---
# Produces static HTML/JS/CSS under dist/ — copied into the final image as ./public.
FROM node:22-alpine AS frontend-build
WORKDIR /app/Frontend
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm install --no-audit --no-fund
COPY Frontend ./
RUN npm run build

# --- Stage 2: compile the API (TypeScript → JavaScript) ---
# Produces dist/ with index.js and the rest of the server bundle.
FROM node:22-alpine AS backend-build
WORKDIR /app/Backend
COPY Backend/package.json Backend/package-lock.json ./
RUN npm install --no-audit --no-fund
COPY Backend ./
RUN npm run build

# --- Stage 3: final image with the compiled API and the built SPA ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=backend-build /app/Backend/dist ./dist
COPY --from=frontend-build /app/Frontend/dist ./public
COPY Backend/package.json Backend/package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]