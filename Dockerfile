# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- run ---
FROM caddy:2-alpine
COPY --from=build /app/dist /app/dist
COPY Caddyfile /etc/caddy/Caddyfile

# Create config.js endpoint that serves runtime API URL
RUN echo '#!/bin/sh' > /generate-config.sh && \
    echo 'set -e' >> /generate-config.sh && \
    echo 'API_URL=${VITE_API_BASE_URL:-${BACKEND_URL}}' >> /generate-config.sh && \
    echo 'echo "window.__API_BASE_URL__ = \"$API_URL\";" > /app/dist/config.js' >> /generate-config.sh && \
    echo 'echo "window.__WS_URL__ = \"$API_URL\";" >> /app/dist/config.js' >> /generate-config.sh && \
    chmod +x /generate-config.sh

# Create script to generate Caddyfile at runtime (for Railway dynamic URLs)
RUN echo '#!/bin/sh' > /generate-caddyfile.sh && \
    echo 'set -e' >> /generate-caddyfile.sh && \
    echo 'BACKEND_URL=${BACKEND_URL:-http://backend:4000}' >> /generate-caddyfile.sh && \
    echo '' >> /generate-caddyfile.sh && \
    echo '{' >> /generate-caddyfile.sh && \
    echo '  echo "# Caddyfile for Railway deployment (generated at runtime)"' >> /generate-caddyfile.sh && \
    echo '  echo ":80 {"' >> /generate-caddyfile.sh && \
    echo '  echo "    handle /health {"' >> /generate-caddyfile.sh && \
    echo '  echo "        respond \"OK\" 200"' >> /generate-caddyfile.sh && \
    echo '  echo "    }"' >> /generate-caddyfile.sh && \
    echo '  echo "    handle /api/* {"' >> /generate-caddyfile.sh && \
    echo '  echo "        reverse_proxy $BACKEND_URL {"' >> /generate-caddyfile.sh && \
    echo '  echo "            uri strip_prefix /api"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up Host {host}"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up X-Real-IP {remote}"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up X-Forwarded-For {remote}"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up X-Forwarded-Proto {scheme}"' >> /generate-caddyfile.sh && \
    echo '  echo "        }"' >> /generate-caddyfile.sh && \
    echo '  echo "    }"' >> /generate-caddyfile.sh && \
    echo '  echo "    handle /socket.io/* {"' >> /generate-caddyfile.sh && \
    echo '  echo "        reverse_proxy $BACKEND_URL {"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up Connection \"upgrade\""' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up Upgrade \"websocket\""' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up Host {host}"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up X-Real-IP {remote}"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up X-Forwarded-For {remote}"' >> /generate-caddyfile.sh && \
    echo '  echo "            header_up X-Forwarded-Proto {scheme}"' >> /generate-caddyfile.sh && \
    echo '  echo "        }"' >> /generate-caddyfile.sh && \
    echo '  echo "    }"' >> /generate-caddyfile.sh && \
    echo '  echo "    handle {"' >> /generate-caddyfile.sh && \
    echo '  echo "        root * /app/dist"' >> /generate-caddyfile.sh && \
    echo '  echo "        try_files {path} /index.html"' >> /generate-caddyfile.sh && \
    echo '  echo "        file_server"' >> /generate-caddyfile.sh && \
    echo '  echo "    }"' >> /generate-caddyfile.sh && \
    echo '  echo "}"' >> /generate-caddyfile.sh && \
    echo '} > /etc/caddy/Caddyfile' >> /generate-caddyfile.sh && \
    chmod +x /generate-caddyfile.sh

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'set -e' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '# Generate runtime config.js with API URL' >> /start.sh && \
    echo '/generate-config.sh' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '# Generate Caddyfile at runtime with dynamic backend URL' >> /start.sh && \
    echo '/generate-caddyfile.sh' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'exec caddy run --config /etc/caddy/Caddyfile' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80 443
CMD ["/start.sh"]
