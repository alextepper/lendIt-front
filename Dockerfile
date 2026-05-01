# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- run ---
FROM nginx:1.27-alpine

# Install Node.js so the sitemap can be regenerated at container startup
# (with the real BACKEND_URL injected by the platform), then served as a
# static file by nginx alongside the SPA.
RUN apk add --no-cache nodejs

COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/scripts /app/scripts

# Create config.js endpoint that serves runtime API URL
RUN echo '#!/bin/sh' > /generate-config.sh && \
    echo 'set -e' >> /generate-config.sh && \
    echo '# Note: In production, frontend uses window.location.origin for same-origin connections' >> /generate-config.sh && \
    echo '# This config.js is mainly for API base URL, not WebSocket URL' >> /generate-config.sh && \
    echo 'API_URL=${VITE_API_BASE_URL:-${BACKEND_URL}}' >> /generate-config.sh && \
    echo 'echo "window.__API_BASE_URL__ = \"$API_URL\";" > /usr/share/nginx/html/config.js' >> /generate-config.sh && \
    echo '# WebSocket URL should match current origin (frontend will use window.location.origin)' >> /generate-config.sh && \
    echo 'echo "window.__WS_URL__ = window.location.origin;" >> /usr/share/nginx/html/config.js' >> /generate-config.sh && \
    chmod +x /generate-config.sh

# Generate the sitemap AND per-item static HTML pages at container startup
# with the real backend URL. Runs in the background so a slow/unreachable API
# never blocks nginx from starting. Per-item pages are what makes Google show
# the right title (e.g. "Action camera") in search results for /item/:id —
# nginx's `try_files $uri $uri/ /index.html` serves the matching file when
# present, falling back to the SPA shell otherwise.
RUN echo '#!/bin/sh' > /generate-seo.sh && \
    echo 'API_URL="${VITE_API_BASE_URL:-${BACKEND_URL}}"' >> /generate-seo.sh && \
    echo 'export VITE_API_BASE_URL="$API_URL"' >> /generate-seo.sh && \
    echo 'export SITEMAP_API_BASE_URL="$API_URL"' >> /generate-seo.sh && \
    echo 'export SITE_URL="${SITE_URL:-https://www.sharo-app.com}"' >> /generate-seo.sh && \
    echo 'export SITEMAP_OUTPUT_DIR="/usr/share/nginx/html"' >> /generate-seo.sh && \
    echo 'echo "🗺️  Generating sitemap (API: $API_URL, SITE: $SITE_URL)..."' >> /generate-seo.sh && \
    echo 'node /app/scripts/generate-sitemap.mjs || echo "⚠️  Sitemap generation reported issues."' >> /generate-seo.sh && \
    echo 'echo "📄 Generating per-item static HTML pages..."' >> /generate-seo.sh && \
    echo 'node /app/scripts/generate-static-pages.mjs || echo "⚠️  Per-item page generation reported issues."' >> /generate-seo.sh && \
    chmod +x /generate-seo.sh

# Create startup script that generates nginx config with Railway PORT support
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'set -e' >> /start.sh && \
    echo 'PORT=${PORT:-80}' >> /start.sh && \
    echo 'BACKEND_URL=${BACKEND_URL:-${VITE_API_BASE_URL}}' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '# Generate runtime config.js with API URL' >> /start.sh && \
    echo '/generate-config.sh' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '# Refresh sitemap.xml + per-item HTML in the background with the real backend URL' >> /start.sh && \
    echo '/generate-seo.sh &' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'echo "🔧 Frontend startup configuration:"' >> /start.sh && \
    echo 'echo "   PORT: $PORT"' >> /start.sh && \
    echo 'echo "   BACKEND_URL: $BACKEND_URL"' >> /start.sh && \
    echo 'echo "   Frontend files location: /usr/share/nginx/html"' >> /start.sh && \
    echo 'ls -la /usr/share/nginx/html/ | head -10 || echo "   ⚠️  Frontend files not found!"' >> /start.sh && \
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
    echo 'echo "    # WebSocket proxy for Socket.IO (via /api/socket.io) - MUST come before /api/ and /" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    location /api/socket.io {" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        set \$backend \"$BACKEND_URL\";" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        # Rewrite /api/socket.io to /socket.io" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        rewrite ^/api/socket.io(.*)\$ /socket.io\$1 break;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_pass \$backend;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_http_version 1.1;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header Upgrade \$http_upgrade;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header Connection \"upgrade\";" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header Host \$host;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header X-Real-IP \$remote_addr;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_set_header X-Forwarded-Proto \$scheme;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_cache_bypass \$http_upgrade;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "        proxy_read_timeout 86400;" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    }" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
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
    echo 'echo "" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    # Static files - MUST come last (catch-all)" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "    location / { try_files \$uri \$uri/ /index.html; }" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'echo "}" >> /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'echo "✅ Nginx configuration generated" >> /start.sh && \
    echo 'echo "📋 Testing nginx configuration..." >> /start.sh && \
    echo 'nginx -t || (echo "❌ Nginx configuration test failed!" && cat /etc/nginx/conf.d/default.conf && exit 1)' >> /start.sh && \
    echo 'echo "✅ Nginx configuration is valid" >> /start.sh && \
    echo 'echo "🚀 Starting nginx..." >> /start.sh && \
    echo 'exec nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
