FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build for web
RUN npm run web 2>/dev/null || npm run build

# Production - serve with Node
FROM node:18-alpine

WORKDIR /app

# Install serve to serve static files
RUN npm install -g serve

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web-build ./web-build

# Use dist if it exists, otherwise web-build
RUN if [ -d "dist" ]; then echo "dist" > build_dir.txt; else echo "web-build" > build_dir.txt; fi

EXPOSE 3000

# Start command - serve the web build
CMD serve -s dist -l 3000 || serve -s web-build -l 3000
