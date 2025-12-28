# Socket.IO Setup Guide for Proxy

This guide explains how to configure your **backend** and **frontend** to work with Socket.IO through the Caddy reverse proxy.

---

## Frontend Configuration

### 1. Install Socket.IO Client

```bash
npm install socket.io-client
```

### 2. Configure Socket.IO Connection

**Important**: Use `window.location.origin` to connect through the proxy (same origin).

```typescript
// frontend/src/lib/socket.ts or similar
import { io, Socket } from 'socket.io-client';

// Use the same origin (proxy domain) - NOT the backend URL directly
const socket: Socket = io(window.location.origin, {
  // Socket.IO will automatically append /socket.io/ to the base URL
  // So this becomes: wss://www.sharo-app.com/socket.io/
  
  // Use WebSocket transport (with polling fallback)
  transports: ['websocket', 'polling'],
  
  // Enable automatic reconnection
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  
  // Optional: Add authentication token if needed
  auth: {
    token: localStorage.getItem('authToken'), // or your auth method
  },
  
  // Optional: Add query parameters
  query: {
    // Add any custom query params here
  },
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Socket.IO connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket.IO disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.IO connection error:', error);
});

export default socket;
```

### 3. React/Vue/Angular Example

**React Example:**

```tsx
// frontend/src/components/Chat.tsx
import { useEffect, useState } from 'react';
import socket from '../lib/socket';

function Chat() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    // Listen for messages
    socket.on('message', (data: string) => {
      setMessages(prev => [...prev, data]);
    });

    // Cleanup on unmount
    return () => {
      socket.off('message');
    };
  }, []);

  const sendMessage = (message: string) => {
    socket.emit('message', message);
  };

  return (
    <div>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>
      <input 
        type="text" 
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}
```

### 4. Environment Configuration

**DO NOT** hardcode the backend URL in the frontend. Always use the proxy:

```typescript
// ❌ WRONG - Don't do this
const socket = io('https://lendit-production.up.railway.app');

// ✅ CORRECT - Use same origin (proxy)
const socket = io(window.location.origin);

// ✅ CORRECT - Or use environment variable for development
const socket = io(import.meta.env.VITE_PROXY_URL || window.location.origin);
```

### 5. Frontend Checklist

- [ ] Socket.IO client installed (`socket.io-client`)
- [ ] Connection uses `window.location.origin` (not backend URL)
- [ ] Transports include `'websocket'` and `'polling'`
- [ ] Reconnection is enabled
- [ ] Error handlers are implemented
- [ ] Connection status is logged for debugging

---

## Backend Configuration

### 1. Install Socket.IO Server

```bash
npm install socket.io
```

### 2. Configure Socket.IO Server (NestJS Example)

```typescript
// backend/src/main.ts or app.module.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server } from 'socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get the HTTP server
  const server = app.getHttpServer();
  
  // Configure Socket.IO
  const io = new Server(server, {
    // CORS: Allow your proxy domain
    cors: {
      origin: [
        'https://www.sharo-app.com',
        'https://sharo-app.com',
        // Add your Railway proxy URL for testing
        'https://your-proxy-service.up.railway.app',
      ],
      credentials: true, // Important for cookies/auth
      methods: ['GET', 'POST'],
    },
    
    // Transports: WebSocket and polling
    transports: ['websocket', 'polling'],
    
    // Path: Must match proxy path
    path: '/socket.io/',
    
    // Connection timeout
    connectTimeout: 45000,
    
    // Ping/pong for keep-alive
    pingTimeout: 20000,
    pingInterval: 25000,
    
    // Allow CORS credentials
    allowEIO3: true,
  });
  
  // Make Socket.IO available to NestJS
  app.useWebSocketAdapter(new IoAdapter(io));
  
  await app.listen(process.env.PORT || 4000);
}
bootstrap();
```

### 3. Socket Gateway (NestJS)

```typescript
// backend/src/gateways/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/', // Default namespace
  cors: {
    origin: [
      'https://www.sharo-app.com',
      'https://sharo-app.com',
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log('✅ Client connected:', client.id);
    
    // Optional: Authenticate client
    const token = client.handshake.auth.token;
    if (!token) {
      client.disconnect();
      return;
    }
    
    // Join user to a room
    client.join(`user:${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log('❌ Client disconnected:', client.id);
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: string) {
    // Broadcast to all clients
    this.server.emit('message', {
      id: client.id,
      message: payload,
      timestamp: new Date(),
    });
    
    // Or send to specific room
    // this.server.to('room:123').emit('message', payload);
  }
}
```

### 4. Express/Node.js Example

```javascript
// backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      'https://www.sharo-app.com',
      'https://sharo-app.com',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  // Handle authentication
  const token = socket.handshake.auth.token;
  if (!token) {
    socket.disconnect();
    return;
  }
  
  // Handle messages
  socket.on('message', (data) => {
    console.log('Message received:', data);
    // Broadcast to all clients
    io.emit('message', {
      id: socket.id,
      message: data,
      timestamp: new Date(),
    });
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

server.listen(process.env.PORT || 4000, () => {
  console.log('Server running on port', process.env.PORT || 4000);
});
```

### 5. Backend CORS Configuration

**Important**: Your backend must allow CORS from your proxy domain:

```typescript
// NestJS
app.enableCors({
  origin: [
    'https://www.sharo-app.com',
    'https://sharo-app.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Express
app.use(cors({
  origin: [
    'https://www.sharo-app.com',
    'https://sharo-app.com',
  ],
  credentials: true,
}));
```

### 6. Backend Checklist

- [ ] Socket.IO server installed (`socket.io`)
- [ ] CORS configured to allow proxy domain
- [ ] `credentials: true` set in CORS
- [ ] Path set to `/socket.io/` (matches proxy)
- [ ] Transports include `'websocket'` and `'polling'`
- [ ] Authentication handled in `connection` event
- [ ] Error handling implemented
- [ ] Connection/disconnection logged

---

## Testing the Connection

### 1. Test from Browser Console

Open your frontend in the browser and run:

```javascript
// Test WebSocket connection
const socket = io(window.location.origin, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected!', socket.id);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});
```

### 2. Check Network Tab

1. Open browser DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Look for connection to `/socket.io/`
4. Status should be "101 Switching Protocols"
5. You should see frames being exchanged

### 3. Check Backend Logs

You should see:

```
✅ Client connected: [socket-id]
```

### 4. Test Message Sending

```javascript
// Frontend
socket.emit('message', 'Hello from frontend!');

// Backend should receive and broadcast
```

---

## Troubleshooting

### Frontend: "WebSocket connection failed"

**Causes:**
- Proxy not configured correctly
- Backend not running
- CORS blocking connection

**Solutions:**
1. Check proxy logs for WebSocket upgrade requests
2. Verify backend is running and accessible
3. Check backend CORS configuration
4. Try polling transport: `transports: ['polling']`

### Backend: "CORS policy blocked"

**Causes:**
- CORS not configured for proxy domain
- `credentials: true` not set

**Solutions:**
1. Add proxy domain to CORS `origin` array
2. Set `credentials: true` in CORS config
3. Check backend logs for CORS errors

### Connection drops immediately

**Causes:**
- Authentication failing
- Backend disconnecting client
- Network timeout

**Solutions:**
1. Check authentication logic
2. Increase timeout values
3. Check backend logs for disconnect reasons

### 502 Bad Gateway

**Causes:**
- Backend not running
- Proxy can't reach backend
- Backend not accepting WebSocket upgrades

**Solutions:**
1. Verify backend is running
2. Test backend directly: `https://lendit-production.up.railway.app/socket.io/`
3. Check proxy configuration
4. Check Railway logs for connection errors

---

## Summary

**Frontend:**
- Use `window.location.origin` (proxy domain)
- Socket.IO automatically appends `/socket.io/`
- Enable WebSocket and polling transports

**Backend:**
- Configure CORS for proxy domain
- Set `credentials: true`
- Use path `/socket.io/`
- Handle authentication in connection event

**Proxy:**
- Routes `/socket.io/*` to backend
- Sets `Upgrade: websocket` and `Connection: upgrade` headers
- Proxies WebSocket frames bidirectionally

The proxy handles all the WebSocket upgrade complexity - your frontend and backend just need to connect through it!

