# Use the official Node.js runtime as base image
FROM node:22-slim AS base

# Set working directory
WORKDIR /app

# Install security updates and required system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r nodeuser && useradd -r -g nodeuser nodeuser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . ./

# Copy functions source (if needed for shared utilities)
# Uncomment if you need to import from functions/src
# COPY functions/src ./functions/src

# Change ownership to non-root user
RUN chown -R nodeuser:nodeuser /app

# Switch to non-root user
USER nodeuser

# Expose port (Cloud Run sets PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server.js"]
