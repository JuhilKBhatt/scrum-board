# Stage 1: Build the React frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Python backend and serve
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend static files from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/static

# Render dynamically assigns the PORT environment variable
ENV PORT=8000
EXPOSE $PORT

# Start Uvicorn, binding to the PORT env variable
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
