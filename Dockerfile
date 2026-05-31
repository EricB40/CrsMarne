# Monolith: Vite frontend + Express API. Build from repo root 

# --- Stage 1: build the SPA (Vite) ---
# Produces static HTML/JS/CSS under dist/ — copied into the final image as ./public.
FROM node:18-alpine AS build
WORKDIR /app
COPY . .
WORKDIR /app/Frontend
RUN npm install
RUN npm run build
# --- Stage 2: compile the API (TypeScript → JavaScript) ---
# Produces dist/ with index.js and the rest of the server bundle.
WORKDIR /app/Backend
RUN npm install
RUN npm run build
# --- Stage 3: final image with the compiled API and the built SPA ---
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/Backend/dist ./dist
COPY --from=build /app/Frontend/dist ./public
WORKDIR /app/dist
RUN npm install --production
EXPOSE 3001
CMD ["node", "index.js"]