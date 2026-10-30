# Stage 1: Build TypeScript source
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install full dependencies (including devDependencies needed for build)
RUN npm ci

# Copy TypeScript build config and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript into JavaScript (dist)
RUN npm run build

# Stage 2: Minimal production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Create state and log directories with unprivileged ownership
RUN mkdir -p /app/.data /app/logs && chown -R node:node /app

# Run container as unprivileged user
USER node

# Declare volumes for persistent state
VOLUME ["/app/.data", "/app/logs"]

# Default to running the 24/7 daemon
CMD ["node", "dist/cli/index.js", "daemon"]
