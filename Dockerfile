

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

# Expose application port (Render ignores EXPOSE but good for documentation)
EXPOSE 5000

# Healthcheck probe using dynamic $PORT injected by Render (default 5000)
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request, os; p=os.environ.get('PORT', '5000'); urllib.request.urlopen(f'http://127.0.0.1:{p}/api/health')" || exit 1

# Launch unified server (Gunicorn for prod on Render, fallback to run_backend.py locally)
CMD ["sh", "-c", "if command -v gunicorn >/dev/null 2>&1; then gunicorn --workers 2 --threads 4 --timeout 120 --bind 0.0.0.0:${PORT:-5000} 'backend.app:app'; else python run_backend.py; fi"]
