FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps (important for three.js compatibility)
RUN npm install --legacy-peer-deps

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable to disable source map warnings
ENV GENERATE_SOURCEMAP=false

# Start development server
CMD ["npm", "start"]