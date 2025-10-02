# httpOnly Cookies Authentication 🍪

## Overview

Your application uses **httpOnly cookies** for authentication, which is a security best practice!

---

## What are httpOnly Cookies?

httpOnly cookies are cookies that:

- ✅ **Cannot be accessed by JavaScript** (`document.cookie` won't show them)
- ✅ **Are automatically sent by the browser** with every request
- ✅ **Are protected from XSS attacks** (Cross-Site Scripting)
- ✅ **Are more secure** than localStorage or regular cookies

---

## How Authentication Works

### 1. Login Flow

```
User logs in
  → Backend validates credentials
  → Backend sets httpOnly cookies (access_token, refresh_token)
  → Browser stores cookies automatically
  → Frontend cannot access cookies via JavaScript ✅
```

### 2. API Requests

```
Frontend makes API call
  → Browser automatically sends cookies
  → Backend validates cookies
  → Returns response
```

### 3. WebSocket Connection

```
Frontend connects to WebSocket
  → withCredentials: true sends cookies automatically
  → Backend validates cookies from request headers
  → WebSocket connection established
```

---

## Implementation Details

### Frontend Configuration

**HTTP Requests (`lib/http.js`):**

```javascript
import axios from "axios";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000",
  withCredentials: true, // 🔑 KEY: Send httpOnly cookies
});
```

**WebSocket Connection (`services/websocketService.js`):**

```javascript
this.socket = io(wsUrl, {
  withCredentials: true, // 🔑 KEY: Send httpOnly cookies
  transports: ["websocket", "polling"],
  // Note: No token needed - cookies sent automatically!
});
```

### Backend Requirements

**CORS Configuration:**

```typescript
// NestJS example
app.enableCors({
  origin: "http://localhost:3000", // Your frontend URL
  credentials: true, // 🔑 KEY: Allow cookies
});
```

**Cookie Settings:**

```typescript
// When setting cookies on login
res.cookie("access_token", token, {
  httpOnly: true, // 🔑 Cannot be accessed by JavaScript
  secure: false, // Set to true in production (HTTPS only)
  sameSite: "lax", // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

**Socket.IO Authentication:**

```typescript
@WebSocketGateway({
  cors: {
    origin: "http://localhost:3000",
    credentials: true, // 🔑 KEY: Allow cookies
  },
})
export class MessagingGateway {
  async handleConnection(client: Socket) {
    // Extract token from cookies in the handshake
    const cookies = client.handshake.headers.cookie;
    const token = this.extractTokenFromCookies(cookies);

    // Validate token
    const payload = await this.jwtService.verify(token);
    // ... rest of authentication
  }

  extractTokenFromCookies(cookieHeader: string): string {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";");
    const tokenCookie = cookies.find((c) =>
      c.trim().startsWith("access_token=")
    );

    if (!tokenCookie) return null;

    return tokenCookie.split("=")[1];
  }
}
```

---

## Testing WebSocket with httpOnly Cookies

### Using the Test Tool

1. **Open `test-websocket.html`**
2. **Click "Auto-fill from localStorage"** - it will show:
   ```
   ❌ No token found
   💡 Your app uses httpOnly cookies!
   ✅ SOLUTION: The WebSocket will work automatically!
   ```
3. **Just click "Test Connection"** (no token needed!)
4. **Browser will send cookies automatically** 🍪

### Manual Console Test

```javascript
// Load Socket.IO
const script = document.createElement("script");
script.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
document.head.appendChild(script);

// Connect (no token needed!)
const socket = io("http://localhost:4000", {
  withCredentials: true, // 🔑 This is the magic!
  transports: ["websocket", "polling"],
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("❌ Error:", error.message);
});
```

---

## Common Issues & Solutions

### Issue 1: CORS Error

**Error:**

```
Access to XMLHttpRequest blocked by CORS policy:
The value of the 'Access-Control-Allow-Credentials' header
in the response is '' which must be 'true'
```

**Solution (Backend):**

```typescript
app.enableCors({
  origin: "http://localhost:3000",
  credentials: true, // ← Must be true!
});
```

---

### Issue 2: Cookies Not Sent

**Error:** Backend doesn't receive cookies

**Check Frontend:**

```javascript
// Make sure withCredentials is set
axios.create({
  withCredentials: true, // ← Must be true!
});

io("http://localhost:4000", {
  withCredentials: true, // ← Must be true!
});
```

**Check Backend:**

```typescript
// CORS must allow credentials
cors: {
  origin: 'http://localhost:3000',
  credentials: true // ← Must be true!
}
```

---

### Issue 3: Token Not in Cookies

**Check:**

```javascript
// In browser console
document.cookie;
// You WON'T see httpOnly cookies here! That's normal!
```

**To verify cookies exist:**

1. Open DevTools (F12)
2. Go to **Application** tab
3. Look in **Cookies** → `http://localhost:3000`
4. You should see `access_token` listed
5. The **HttpOnly** column should be checked ✅

---

### Issue 4: WebSocket Can't Authenticate

**Problem:** Backend can't extract token from cookies

**Solution (Backend):**

```typescript
async handleConnection(client: Socket) {
  // Get cookies from handshake headers
  const cookieHeader = client.handshake.headers.cookie;

  if (!cookieHeader) {
    console.error('No cookies in handshake');
    client.disconnect();
    return;
  }

  // Parse cookies
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  const token = cookies['access_token'];

  if (!token) {
    console.error('No access_token cookie found');
    client.disconnect();
    return;
  }

  // Validate token
  const payload = await this.jwtService.verify(token);
  // ... continue with authentication
}
```

---

## Security Benefits

### ✅ Advantages

1. **XSS Protection**: JavaScript malware cannot steal tokens
2. **Automatic Management**: Browser handles cookie lifetime
3. **CSRF Protection**: Use `sameSite` attribute
4. **Secure by Default**: Works with HTTPS easily

### ⚠️ Considerations

1. **Cross-Domain**: More complex with multiple domains
2. **Mobile Apps**: May need alternative approach
3. **Third-Party Cookies**: Being phased out by browsers
4. **Testing**: Harder to test manually (can't copy token)

---

## Production Checklist

- [ ] **HTTPS only**: Set `secure: true` on cookies
- [ ] **SameSite**: Set to `'strict'` or `'lax'`
- [ ] **Domain**: Configure cookie domain correctly
- [ ] **CORS**: Only allow trusted origins
- [ ] **Cookie Prefix**: Consider using `__Host-` or `__Secure-`

```typescript
// Production cookie settings
res.cookie("access_token", token, {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: "strict", // Maximum CSRF protection
  domain: ".yourdomain.com", // Your domain
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

---

## Summary

✅ **Your app uses httpOnly cookies** - This is great for security!  
✅ **WebSocket configured correctly** - `withCredentials: true`  
✅ **No token management needed** - Browser handles everything  
✅ **Protected from XSS** - JavaScript cannot access tokens

**Just make sure backend:**

1. Sets cookies correctly (httpOnly, secure in prod)
2. Enables CORS with credentials
3. Extracts tokens from cookie headers
4. Validates tokens properly

---

**🎉 You're all set! The WebSocket will work automatically with your httpOnly cookies!**
