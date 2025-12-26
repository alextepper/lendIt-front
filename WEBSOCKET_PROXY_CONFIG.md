# WebSocket Proxy Configuration Guide

Since your frontend uses a same-origin reverse proxy setup (API calls go through `/api`), you need to configure your reverse proxy (nginx/Apache) to handle WebSocket upgrades for Socket.IO.

## Current Setup

- **Frontend**: Uses `window.location.origin` for WebSocket connections (e.g., `https://www.sharo-app.com`)
- **Socket.IO Path**: Automatically appends `/socket.io/` to the base URL
- **Expected Connection**: `wss://www.sharo-app.com/socket.io/?EIO=4&transport=websocket`

## Nginx Configuration

Add or update your nginx configuration to handle WebSocket connections:

```nginx
server {
    listen 443 ssl http2;
    server_name www.sharo-app.com sharo-app.com;

    # SSL configuration (your existing SSL settings)
    # ssl_certificate ...;
    # ssl_certificate_key ...;

    # Frontend static files
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy (your existing configuration)
    location /api {
        proxy_pass http://backend-server:4000;  # Adjust port/address as needed
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
    }

    # Socket.IO WebSocket proxy - CRITICAL
    location /socket.io/ {
        proxy_pass http://backend-server:4000;  # Same backend as API
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket-specific settings
        proxy_buffering off;
        proxy_read_timeout 86400;  # 24 hours (Socket.IO long polling timeout)
        proxy_send_timeout 86400;
    }
}
```

### Key Points:

1. **`proxy_set_header Upgrade $http_upgrade`**: Tells nginx to upgrade the connection to WebSocket
2. **`proxy_set_header Connection "upgrade"`**: Required for WebSocket upgrade
3. **`proxy_read_timeout 86400`**: Socket.IO uses long polling, so increase timeout (24 hours)
4. **`proxy_buffering off`**: Prevents buffering of WebSocket data
5. **`location /socket.io/`**: Must match Socket.IO's default path (with trailing slash)

## Testing After Configuration

1. **Reload nginx**:
   ```bash
   sudo nginx -t  # Test configuration
   sudo nginx -s reload  # Reload if test passes
   ```

2. **Check browser console**:
   - Should see: `✅ Socket.IO connected: [socket-id]`
   - Should NOT see: `WebSocket connection to 'wss://sharo-app.com/socket.io/...' failed`

3. **Monitor nginx logs**:
   ```bash
   tail -f /var/log/nginx/error.log
   tail -f /var/log/nginx/access.log
   ```

## Apache Configuration (Alternative)

If you're using Apache instead of nginx:

```apache
<VirtualHost *:443>
    ServerName www.sharo-app.com
    
    # SSL configuration
    SSLEngine on
    # SSLCertificateFile ...
    # SSLCertificateKeyFile ...

    # Frontend static files
    DocumentRoot /path/to/frontend/dist
    <Directory /path/to/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # API proxy
    ProxyPreserveHost On
    ProxyPass /api http://backend-server:4000/api
    ProxyPassReverse /api http://backend-server:4000/api

    # Socket.IO WebSocket proxy
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/socket.io/(.*) ws://backend-server:4000/socket.io/$1 [P,L]
    
    ProxyPass /socket.io/ http://backend-server:4000/socket.io/
    ProxyPassReverse /socket.io/ http://backend-server:4000/socket.io/
</VirtualHost>
```

**Apache Modules Required**:
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo systemctl restart apache2
```

## Docker/Container Setup

If using Docker with nginx:

```dockerfile
# In your nginx Dockerfile or docker-compose.yml
# Make sure the nginx config includes the /socket.io/ location block
```

**docker-compose.yml example**:
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend-dist:/usr/share/nginx/html:ro
    depends_on:
      - backend

  backend:
    image: your-backend-image
    ports:
      - "4000:4000"
```

## Troubleshooting

### Issue: Still getting connection errors

1. **Check backend is running on correct port**
   ```bash
   curl http://backend-server:4000/socket.io/
   # Should return Socket.IO handshake response, not 404
   ```

2. **Verify WebSocket module is enabled** (Apache)
   ```bash
   apache2ctl -M | grep proxy_wstunnel
   ```

3. **Check firewall rules** - Ensure WebSocket ports are open

4. **Test direct connection** (bypass proxy)
   - Temporarily connect directly to backend: `wss://backend-server:4000/socket.io/`
   - If this works, the issue is in proxy config
   - If this fails, the issue is in backend Socket.IO setup

### Issue: Connection works but disconnects quickly

- Increase `proxy_read_timeout` and `proxy_send_timeout` values
- Check backend Socket.IO ping/pong timeout settings

### Issue: Mixed content warnings (HTTP/HTTPS)

- Ensure your frontend is served over HTTPS
- Socket.IO will automatically use WSS (secure WebSocket) on HTTPS pages

## Backend Socket.IO Configuration

Make sure your backend Socket.IO server is configured to accept connections from your domain:

```typescript
// NestJS example
const io = new Server(server, {
  cors: {
    origin: ['https://www.sharo-app.com', 'https://sharo-app.com'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
```

## Verification Checklist

- [ ] Nginx/Apache configuration includes `/socket.io/` location block
- [ ] WebSocket upgrade headers are set correctly
- [ ] Timeout values are sufficient (86400 seconds)
- [ ] Proxy passes to correct backend address and port
- [ ] Nginx/Apache has been reloaded after config changes
- [ ] Backend Socket.IO server is running and accessible
- [ ] Backend CORS allows your frontend domain
- [ ] Firewall allows WebSocket connections
- [ ] Browser console shows successful connection (not errors)

## Additional Resources

- [Socket.IO Documentation - Using with nginx](https://socket.io/docs/v4/reverse-proxy/)
- [Nginx WebSocket Proxy](http://nginx.org/en/docs/http/websocket.html)
- [Apache WebSocket Proxy](https://httpd.apache.org/docs/2.4/mod/mod_proxy_wstunnel.html)

