FROM node:20-alpine AS builder

# Instalar OpenSSL para que Prisma funcione en Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first (caching layer)
COPY package*.json ./
RUN npm ci

# Copy rest of the application
COPY . .

# Generate Prisma Client and Build
RUN npx prisma generate
RUN npm run build

# Production image
FROM node:20-alpine

# Instalar OpenSSL también en la imagen final para las migraciones
RUN apk add --no-cache openssl

WORKDIR /app

# Copy from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Start command
CMD npx prisma migrate deploy && node dist/server.js