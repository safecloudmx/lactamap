FROM node:22-alpine AS builder

WORKDIR /app

# Receive build arg from Coolify
ARG EXPO_PUBLIC_API_BASE_URL

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Write .env file so Expo picks up the variable during build
RUN echo "EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}" > .env && \
    echo "EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_BASE_URL}" >> .env && \
    cat .env

# Build for web (increase heap size to avoid OOM during Metro bundling)
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

# Production - serve with Node
FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD serve -s dist -l 3000
