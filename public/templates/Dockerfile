# ===============================================================================
# Global Emissions Dashboard - Multi-stage Docker Build
# ===============================================================================
#
# Build Commands:
#   docker build -t emissions-dashboard .
#   docker build --target api -t emissions-api .
#   docker build --target frontend -t emissions-frontend .
#
# Run Commands:
#   docker run -p 80:80 -e OPENAI_API_KEY=xxx emissions-dashboard
#   docker run -p 8000:8000 emissions-api
#
# Docker Compose (recommended):
#   docker-compose up -d
#
# ===============================================================================

# =============================================================================
# Stage 1: Python Backend Builder
# =============================================================================
FROM python:3.11-slim as python-builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# =============================================================================
# Stage 2: API Only (for microservices deployment)
# =============================================================================
FROM python:3.11-slim as api

LABEL maintainer="Global Emissions Dashboard Team"
LABEL description="FastAPI backend for emissions data"
LABEL version="2.0.0"

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

# Copy Python packages from builder
COPY --from=python-builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy application code
COPY api/ ./api/
COPY data/ ./data/
COPY pipeline/ ./pipeline/

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    ENV=production

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start API server
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Stage 3: Frontend Builder (React/Vite)
# =============================================================================
FROM node:20-alpine as frontend-builder

WORKDIR /build

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies
RUN npm ci --ignore-scripts || npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# =============================================================================
# Stage 4: Frontend Only (for static hosting)
# =============================================================================
FROM nginx:alpine as frontend

LABEL maintainer="Global Emissions Dashboard Team"
LABEL description="React frontend for emissions dashboard"

# Copy built frontend
COPY --from=frontend-builder /build/dist /usr/share/nginx/html

# Custom nginx configuration
RUN echo 'server { \
    listen 80; \
    listen [::]:80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml; \
    \
    # Cache static assets \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # SPA fallback \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Health check \
    location /health { \
        access_log off; \
        return 200 "healthy"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

# =============================================================================
# Stage 5: Production - Full Stack Deployment
# =============================================================================
FROM python:3.11-slim as production

LABEL maintainer="Global Emissions Dashboard Team"
LABEL description="Full-stack emissions dashboard (API + Frontend)"
LABEL version="2.0.0"

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

# Copy Python packages from builder
COPY --from=python-builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY api/ ./api/
COPY data/ ./data/
COPY pipeline/ ./pipeline/

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /build/dist /var/www/html

# =============================================================================
# Nginx Configuration
# =============================================================================
RUN echo 'server { \
    listen 80; \
    listen [::]:80; \
    server_name _; \
    \
    root /var/www/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_proxied any; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml; \
    \
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    \
    # API proxy \
    location /api/ { \
        proxy_pass http://127.0.0.1:8000/; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_connect_timeout 60s; \
        proxy_send_timeout 60s; \
        proxy_read_timeout 60s; \
    } \
    \
    # WebSocket support (for future use) \
    location /ws/ { \
        proxy_pass http://127.0.0.1:8000/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
    } \
    \
    # Static assets caching \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # SPA fallback \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Health check endpoint \
    location /health { \
        access_log off; \
        return 200 "healthy\\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/sites-available/default

# =============================================================================
# Supervisor Configuration
# =============================================================================
RUN mkdir -p /var/log/supervisor && \
    echo '[supervisord] \n\
nodaemon=true \n\
user=root \n\
logfile=/var/log/supervisor/supervisord.log \n\
pidfile=/var/run/supervisord.pid \n\
\n\
[program:nginx] \n\
command=/usr/sbin/nginx -g "daemon off;" \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/var/log/supervisor/nginx.log \n\
stderr_logfile=/var/log/supervisor/nginx_error.log \n\
priority=10 \n\
\n\
[program:api] \n\
command=python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --workers 2 \n\
directory=/app \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/var/log/supervisor/api.log \n\
stderr_logfile=/var/log/supervisor/api_error.log \n\
priority=20 \n\
environment=PYTHONUNBUFFERED="1" \n\
' > /etc/supervisor/conf.d/supervisord.conf

# =============================================================================
# Environment Variables
# =============================================================================
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=80 \
    ENV=production

# Expose ports
EXPOSE 80 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health && curl -f http://localhost:8000/health || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

# =============================================================================
# Stage 6: Development (with hot reload)
# =============================================================================
FROM python:3.11-slim as development

WORKDIR /app

# Install development dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages
COPY --from=python-builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Install additional dev dependencies
RUN pip install --no-cache-dir watchfiles pytest-watch

# Copy application code
COPY . .

ENV PYTHONUNBUFFERED=1 \
    ENV=development

EXPOSE 8000

# Start with hot reload
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
