# Backend: httpOnly Cookie Authentication Fix

## Problem

The WebSocket connection is being rejected with:

```
[Nest] 1 - 10/01/2025, 1:20:28 PM WARN [MessagingGateway] Connection rejected - No token provided
```

**Root Cause:** The backend is only checking `client.handshake.auth.token` and `client.handshake.query.token`, but the frontend is sending the token in **httpOnly cookies**.

---

## Solution

Update your `MessagingGateway` to extract tokens from cookies:

### ✅ Updated Code

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // 🔑 IMPORTANT: Allow cookies
  },
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Try to extract token from multiple sources
      let token = client.handshake.auth.token || client.handshake.query.token;

      // 🍪 If no token in auth/query, try to extract from cookies (httpOnly)
      if (!token) {
        const cookieHeader = client.handshake.headers.cookie;
        if (cookieHeader) {
          console.log("No token in auth/query, checking cookies...");

          // Parse cookies from header
          const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split("=");
            acc[key] = value;
            return acc;
          }, {});

          token = cookies["access_token"];

          if (token) {
            console.log("✅ Token found in cookies");
          }
        }
      }

      if (!token) {
        console.log("❌ No token provided (checked auth, query, and cookies)");
        console.log("Headers:", client.handshake.headers);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verify(token);
      const userId = payload.sub || payload.userId;

      // Store userId in socket data
      client.data.userId = userId;

      // Join user to their personal room
      client.join(`user:${userId}`);

      console.log(`✅ Client connected: ${client.id} (User: ${userId})`);
    } catch (error) {
      console.log("❌ Invalid token, disconnecting client:", error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
  }
}
```

---

## Key Changes

### 1. Check Multiple Token Sources

```typescript
// Try multiple sources in priority order:
let token =
  client.handshake.auth.token || // Socket.IO auth option
  client.handshake.query.token; // Query parameter

// If not found, check cookies
if (!token) {
  token = extractFromCookies(client.handshake.headers.cookie);
}
```

### 2. Parse Cookie Header

```typescript
const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
  const [key, value] = cookie.trim().split("=");
  acc[key] = value;
  return acc;
}, {});

const token = cookies["access_token"];
```

### 3. Enable CORS with Credentials

```typescript
@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true, // 🔑 Must be true to receive cookies
  },
})
```

---

## Testing

### 1. Check Cookie Header

Add logging to see what's being sent:

```typescript
async handleConnection(client: Socket) {
  console.log('🔍 Debug - Headers:', client.handshake.headers);
  console.log('🔍 Debug - Cookie:', client.handshake.headers.cookie);
  // ... rest of code
}
```

Expected output:

```
🔍 Debug - Cookie: access_token=eyJhbGci...XYZ; refresh_token=eyJhbGci...ABC
```

### 2. Verify Token Extraction

```typescript
if (token) {
  console.log(`✅ Token extracted: ${token.substring(0, 20)}...`);
} else {
  console.log("❌ No token found in any source");
}
```

### 3. Test Connection

From frontend, the connection should now succeed:

```
✅ Socket.IO connected: abc123xyz
WebSocket connected
```

---

## Common Issues

### Issue 1: No Cookie Header

**Symptom:**

```
🔍 Debug - Cookie: undefined
```

**Causes:**

- Frontend not sending `withCredentials: true`
- CORS not configured with `credentials: true`
- Cookies not set on login

**Fix (Frontend):**

```javascript
const socket = io("http://localhost:4000", {
  withCredentials: true, // ← Must be true
});
```

**Fix (Backend CORS):**

```typescript
@WebSocketGateway({
  cors: {
    credentials: true, // ← Must be true
  },
})
```

---

### Issue 2: Cookie Format Different

**Symptom:**
Token not found even though cookies exist

**Debug:**

```typescript
console.log("Cookie header:", client.handshake.headers.cookie);
console.log("Parsed cookies:", cookies);
console.log("access_token:", cookies["access_token"]);
```

**Check:**

- Cookie name might be different (e.g., `accessToken`, `auth_token`)
- Cookie might be URL-encoded
- Multiple cookies might be concatenated

---

### Issue 3: Token Still Invalid

**Symptom:**

```
❌ Invalid token, disconnecting client: jwt malformed
```

**Debug:**

```typescript
console.log("Token length:", token?.length);
console.log("Token preview:", token?.substring(0, 50));
console.log("Token parts:", token?.split(".").length); // Should be 3
```

**Fixes:**

- Verify JWT_SECRET matches
- Check token isn't corrupted
- Ensure token hasn't expired

---

## Helper Method (Optional)

Extract cookie parsing into a helper method:

```typescript
private extractTokenFromCookies(cookieHeader: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  try {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = decodeURIComponent(value); // Handle URL-encoded values
      }
      return acc;
    }, {} as Record<string, string>);

    return cookies['access_token'] || null;
  } catch (error) {
    console.error('Error parsing cookies:', error);
    return null;
  }
}

// Usage in handleConnection:
if (!token) {
  token = this.extractTokenFromCookies(client.handshake.headers.cookie);
}
```

---

## Complete Example with Logging

```typescript
async handleConnection(client: Socket) {
  console.log('\n🔌 New WebSocket connection attempt');
  console.log('Socket ID:', client.id);

  try {
    // 1. Check auth option
    let token = client.handshake.auth.token;
    if (token) {
      console.log('✅ Token found in: auth');
    }

    // 2. Check query parameter
    if (!token) {
      token = client.handshake.query.token as string;
      if (token) {
        console.log('✅ Token found in: query');
      }
    }

    // 3. Check cookies
    if (!token) {
      console.log('🔍 Checking cookies...');
      const cookieHeader = client.handshake.headers.cookie;

      if (!cookieHeader) {
        console.log('❌ No cookie header found');
      } else {
        console.log('📝 Cookie header exists');
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});

        token = cookies['access_token'];
        if (token) {
          console.log('✅ Token found in: cookies');
          console.log('Token preview:', token.substring(0, 20) + '...');
        } else {
          console.log('❌ No access_token in cookies');
          console.log('Available cookies:', Object.keys(cookies));
        }
      }
    }

    // 4. Validate token exists
    if (!token) {
      console.log('❌ Connection rejected: No token in auth, query, or cookies');
      client.disconnect();
      return;
    }

    // 5. Verify token
    console.log('🔐 Verifying token...');
    const payload = await this.jwtService.verify(token);
    const userId = payload.sub || payload.userId;
    console.log('✅ Token verified for user:', userId);

    // 6. Setup connection
    client.data.userId = userId;
    client.join(`user:${userId}`);

    console.log(`✅ Client connected: ${client.id} (User: ${userId})\n`);
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    client.disconnect();
  }
}
```

---

## Summary

✅ **Updated `handleConnection` to check cookies**  
✅ **Parse `cookie` header from `client.handshake.headers`**  
✅ **Extract `access_token` from parsed cookies**  
✅ **Enable CORS with `credentials: true`**  
✅ **Added logging for debugging**

**After this update, your WebSocket connections should work!** 🎉

---

## Quick Checklist

- [ ] Updated `handleConnection` method
- [ ] Added cookie extraction code
- [ ] Enabled `credentials: true` in CORS
- [ ] Tested connection from frontend
- [ ] Verified token is extracted correctly
- [ ] Checked logs show "✅ Token found in cookies"
- [ ] Connection succeeds without errors

---

**Need help?** Check `HTTPONLY_COOKIES_INFO.md` for more details on httpOnly cookie authentication.
