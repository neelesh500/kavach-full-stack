FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy the backend files specifically
COPY backend/package*.json ./backend/

# Install the dependencies inside the backend folder
WORKDIR /app/backend
RUN npm install --production

# Move back to root and copy all backend source code
WORKDIR /app
COPY backend/ ./backend/
COPY shared/ ./shared/ || true

# Change to the backend directory where the server lives
WORKDIR /app/backend

# Expose the correct port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
