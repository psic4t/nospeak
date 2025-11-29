# Use Node.js 20 LTS to build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage with busybox
FROM busybox:latest

# Create www directory
RUN mkdir -p /var/www/html

# Copy the built application
COPY --from=builder /app/build /var/www/html

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start busybox httpd
CMD ["httpd", "-f", "-h", "/var/www/html", "-p", "3000"]