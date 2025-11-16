# Backend Dockerfile
FROM node:22-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci

# Copy backend source
COPY backend/ ./

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Frontend Dockerfile stage
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend to www
RUN npm run build

# Final production image
FROM node:22-alpine

WORKDIR /app

# Copy backend dependencies and build
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/package*.json ./
COPY backend/prisma ./prisma

# Copy frontend build
COPY --from=frontend-builder /www ./www

# Install production dependencies only
RUN npm ci --production && npm cache clean --force

# Generate Prisma client in production
RUN npx prisma generate

EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
