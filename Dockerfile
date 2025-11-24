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
    echo 'BACKEND_URL=${BACKEND_URL:-${VITE_API_BASE_URL}}' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'echo "server {" > /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    resolver 127.0.0.11 valid=30s ipv6=off;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    listen $PORT;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    server_name _;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    root /usr/share/nginx/html;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    index index.html;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    location /health { return 200 \"OK\"; add_header Content-Type text/plain; }" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    location / { try_files \$uri \$uri/ /index.html; }" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    location /api/ {" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        set \$backend \"$BACKEND_URL\";" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_pass \$backend;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_http_version 1.1;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header Upgrade \$http_upgrade;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header Connection \"upgrade\";" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header Host \$host;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header X-Real-IP \$remote_addr;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header X-Forwarded-Proto \$scheme;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header X-Forwarded-Host \$server_name;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_connect_timeout 60s;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_send_timeout 60s;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_read_timeout 60s;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_buffering off;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    }" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "}" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'exec nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
