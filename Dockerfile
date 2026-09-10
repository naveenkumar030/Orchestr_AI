

# Stage 1: Build React 19 Frontend Bundle
FROM node:20-alpine AS frontend-builder
WORKDIR /app/cicd-app

COPY cicd-app/package*.json ./
RUN npm ci

COPY cicd-app/ ./
RUN npm run build

# Stage 2: Python Flask Production Backend & Single-Server Web Host
FROM python:3.13-slim
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application
COPY backend/ ./backend/
COPY run_backend.py ./

# Copy compiled React UI bundle from Stage 1
COPY --from=frontend-builder /app/cicd-app/dist ./cicd-app/dist

# Expose application port
EXPOSE 5000

# Healthcheck probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health')" || exit 1

# Launch unified server
CMD ["python", "run_backend.py"]
