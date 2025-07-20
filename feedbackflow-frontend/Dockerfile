# Use Node.js 22 Alpine for better security and performance
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --force

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S feedbackflow -u 1001

# Change ownership of the app directory
RUN chown -R feedbackflow:nodejs /app
USER feedbackflow

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
# Next.js doesn't have a simple healthcheck endpoint by default.
# This can be added later if needed.

# Start the application
CMD ["npm", "start"]
