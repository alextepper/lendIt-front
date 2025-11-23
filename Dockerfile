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

# Create nginx config with dynamic backend resolution
# Backend defaults to backend:4000 (can be overridden via env vars in docker-compose)
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    resolver 127.0.0.11 valid=30s ipv6=off;' >> /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name _;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    # SPA routing - serve index.html for all routes' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / { try_files $uri $uri/ /index.html; }' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    # API proxy to backend (resolves at request time)' >> /etc/nginx/conf.d/default.conf && \
    echo '    location /api/ {' >> /etc/nginx/conf.d/default.conf && \
    echo '        set $backend "http://backend:4000";' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_pass $backend;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-Host $server_name;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_connect_timeout 60s;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_send_timeout 60s;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_read_timeout 60s;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_buffering off;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx","-g","daemon off;"]
