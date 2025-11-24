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

# Create startup script that generates nginx config with Railway PORT support
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'set -e' >> /start.sh && \
    echo 'PORT=${PORT:-80}' >> /start.sh && \
    echo 'BACKEND_URL=${BACKEND_URL:-http://backend:4000}' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'cat > /etc/nginx/conf.d/default.conf <<EOFMARKER' >> /start.sh && \
    echo 'server {' >> /start.sh && \
    echo '    resolver 127.0.0.11 valid=30s ipv6=off;' >> /start.sh && \
    echo '    listen $PORT;' >> /start.sh && \
    echo '    server_name _;' >> /start.sh && \
    echo '    root /usr/share/nginx/html;' >> /start.sh && \
    echo '    index index.html;' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '    # Health check endpoint for Railway' >> /start.sh && \
    echo '    location /health { return 200 "OK"; add_header Content-Type text/plain; }' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '    # SPA routing - serve index.html for all routes' >> /start.sh && \
    echo '    location / { try_files $uri $uri/ /index.html; }' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '    # API proxy to backend (resolves at request time)' >> /start.sh && \
    echo '    location /api/ {' >> /start.sh && \
    echo '        set $backend "$BACKEND_URL";' >> /start.sh && \
    echo '        proxy_pass $backend;' >> /start.sh && \
    echo '        proxy_http_version 1.1;' >> /start.sh && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /start.sh && \
    echo '        proxy_set_header Connection "upgrade";' >> /start.sh && \
    echo '        proxy_set_header Host $host;' >> /start.sh && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /start.sh && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /start.sh && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /start.sh && \
    echo '        proxy_set_header X-Forwarded-Host $server_name;' >> /start.sh && \
    echo '        proxy_connect_timeout 60s;' >> /start.sh && \
    echo '        proxy_send_timeout 60s;' >> /start.sh && \
    echo '        proxy_read_timeout 60s;' >> /start.sh && \
    echo '        proxy_buffering off;' >> /start.sh && \
    echo '    }' >> /start.sh && \
    echo '}' >> /start.sh && \
    echo 'EOFMARKER' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'exec nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
