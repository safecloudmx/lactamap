FROM node:22-alpine AS builder

WORKDIR /app

# Declare build args so Docker passes them from Coolify at build time
ARG EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build for web (EXPO_PUBLIC_* gets inlined into the bundle here)
RUN npm run build

# Production - serve with Node
FROM node:22-alpine

WORKDIR /app

# Install serve to serve static files
RUN npm install -g serve

# Copy built app from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Start command - serve the web build
CMD serve -s dist -l 3000
