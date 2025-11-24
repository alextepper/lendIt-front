# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- run ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Create nginx config template with Railway PORT support
RUN echo 'server {' > /etc/nginx/templates/default.conf.template && \
    echo '    resolver 127.0.0.11 valid=30s ipv6=off;' >> /etc/nginx/templates/default.conf.template && \
    echo '    listen ${PORT:-80};' >> /etc/nginx/templates/default.conf.template && \
    echo '    server_name _;' >> /etc/nginx/templates/default.conf.template && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/templates/default.conf.template && \
    echo '    index index.html;' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    # Health check endpoint for Railway' >> /etc/nginx/templates/default.conf.template && \
    echo '    location /health { return 200 "OK"; add_header Content-Type text/plain; }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    # SPA routing - serve index.html for all routes' >> /etc/nginx/templates/default.conf.template && \
    echo '    location / { try_files $uri $uri/ /index.html; }' >> /etc/nginx/templates/default.conf.template && \
    echo '' >> /etc/nginx/templates/default.conf.template && \
    echo '    # API proxy to backend (resolves at request time)' >> /etc/nginx/templates/default.conf.template && \
    echo '    location /api/ {' >> /etc/nginx/templates/default.conf.template && \
    echo '        set $backend "${BACKEND_URL:-http://backend:4000}";' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_pass $backend;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_set_header X-Forwarded-Host $server_name;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_connect_timeout 60s;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_send_timeout 60s;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_read_timeout 60s;' >> /etc/nginx/templates/default.conf.template && \
    echo '        proxy_buffering off;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '}' >> /etc/nginx/templates/default.conf.template

# Create entrypoint script to process templates with envsubst
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'set -e' >> /docker-entrypoint.sh && \
    echo 'envsubst '"'"'$$PORT $$BACKEND_URL'"'"' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 80
CMD ["/docker-entrypoint.sh"]
