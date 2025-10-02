# WebSocket Backend Implementation Guide

## Overview

This document provides complete instructions for implementing WebSocket support for real-time messaging in the backend.

## Requirements

- WebSocket server running on `ws://localhost:4000` (or configurable URL)
- Authentication via JWT token (sent as query parameter)
- Real-time message broadcasting
- Support for multiple event types

---

## 1. WebSocket Server Setup

### Technology Stack Options

**Option A: Socket.IO (Recommended)**

```bash
npm install socket.io
npm install @nestjs/websockets @nestjs/platform-socket.io  # If using NestJS
```

**Option B: Native WebSocket (ws library)**

```bash
npm install ws
npm install @types/ws --save-dev
```

---

## 2. Authentication

### WebSocket Connection with Token

The frontend sends the JWT token as a query parameter when connecting:

```javascript
// Frontend connects like this:
const ws = new WebSocket("ws://localhost:4000?token=JWT_TOKEN_HERE");
```

### Backend Token Validation

**Example (NestJS with Socket.IO):**

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
    credentials: true,
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

      // If no token in auth/query, try to extract from cookies (httpOnly)
      if (!token) {
        const cookieHeader = client.handshake.headers.cookie;
        if (cookieHeader) {
          console.log("No token in auth/query, checking cookies...");
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
      console.log("Invalid token, disconnecting client:", error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
  }
}
```

**Example (Native WS):**

```typescript
import { WebSocketServer, WebSocket } from "ws";
import { verify } from "jsonwebtoken";

const wss = new WebSocketServer({ port: 4000 });

wss.on("connection", (ws: WebSocket, req) => {
  try {
    // Extract token from URL query parameters
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "No token provided");
      return;
    }

    // Verify JWT
    const payload = verify(token, process.env.JWT_SECRET);
    const userId = payload.sub || payload.userId;

    // Store userId in WebSocket object
    (ws as any).userId = userId;

    console.log(`✅ Client connected: User ${userId}`);

    ws.on("close", () => {
      console.log(`🔌 Client disconnected: User ${userId}`);
    });
  } catch (error) {
    console.log("Invalid token:", error.message);
    ws.close(1008, "Invalid token");
  }
});
```

---

## 3. Event Types to Implement

The frontend expects these WebSocket events:

### Event 1: `new_message`

**When to emit:** When a new message is created in a thread

**Payload:**

```typescript
{
  type: 'new_message',
  threadId: string,
  message: {
    id: string,
    senderId: string,
    sender: {
      id: string,
      username: string,
      email?: string
    },
    type: 'TEXT' | 'IMAGE',
    text: string,
    imageUrl?: string,
    readAt: string | null,
    createdAt: string
  }
}
```

**Who receives:** Both participants in the thread

---

### Event 2: `message_read`

**When to emit:** When messages are marked as read

**Payload:**

```typescript
{
  type: 'message_read',
  threadId: string,
  messageIds: string[],
  readBy: string, // userId who read the messages
  readAt: string
}
```

**Who receives:** The other participant in the thread

---

### Event 3: `thread_update`

**When to emit:** When thread metadata changes (unread count, etc.)

**Payload:**

```typescript
{
  type: 'thread_update',
  threadId: string,
  unreadCount: number,
  lastMessage?: {
    text: string,
    createdAt: string
  }
}
```

**Who receives:** The user whose unread count changed

---

## 4. Implementation Examples

### Broadcasting New Messages

**Example (NestJS with Socket.IO):**

```typescript
@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Thread)
    private threadRepository: Repository<Thread>,
    private messagingGateway: MessagingGateway
  ) {}

  async createMessage(
    threadId: string,
    senderId: string,
    dto: CreateMessageDto
  ): Promise<Message> {
    // Get thread with participants
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      relations: ["userA", "userB"],
    });

    if (!thread) {
      throw new NotFoundException("Thread not found");
    }

    // Create message
    const message = this.messageRepository.create({
      threadId,
      senderId,
      type: dto.type,
      text: dto.text,
      imageUrl: dto.imageUrl,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Load message with sender info
    const fullMessage = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ["sender"],
    });

    // Broadcast to both participants
    const participants = [thread.userA.id, thread.userB.id];

    participants.forEach((userId) => {
      this.messagingGateway.server.to(`user:${userId}`).emit("new_message", {
        type: "new_message",
        threadId: thread.id,
        message: {
          id: fullMessage.id,
          senderId: fullMessage.senderId,
          sender: {
            id: fullMessage.sender.id,
            username: fullMessage.sender.username,
            email: fullMessage.sender.email,
          },
          type: fullMessage.type,
          text: fullMessage.text,
          imageUrl: fullMessage.imageUrl,
          readAt: fullMessage.readAt,
          createdAt: fullMessage.createdAt.toISOString(),
        },
      });
    });

    return fullMessage;
  }
}
```

**Example (Native WS):**

```typescript
function broadcastToUser(userId: string, data: any) {
  wss.clients.forEach((client: WebSocket) => {
    if (
      client.readyState === WebSocket.OPEN &&
      (client as any).userId === userId
    ) {
      client.send(JSON.stringify(data));
    }
  });
}

async function createMessage(
  threadId: string,
  senderId: string,
  dto: CreateMessageDto
) {
  // ... create message in database ...

  // Get thread participants
  const thread = await getThread(threadId);
  const participants = [thread.userAId, thread.userBId];

  // Broadcast to both participants
  const payload = {
    type: "new_message",
    threadId,
    message: {
      id: message.id,
      senderId: message.senderId,
      sender: {
        id: sender.id,
        username: sender.username,
        email: sender.email,
      },
      type: message.type,
      text: message.text,
      imageUrl: message.imageUrl,
      readAt: message.readAt,
      createdAt: message.createdAt.toISOString(),
    },
  };

  participants.forEach((userId) => {
    broadcastToUser(userId, payload);
  });

  return message;
}
```

---

### Broadcasting Read Receipts

**Example:**

```typescript
async markThreadAsRead(threadId: string, userId: string) {
  // Get unread messages
  const messages = await this.messageRepository.find({
    where: {
      threadId,
      senderId: Not(userId),
      readAt: IsNull(),
    },
  });

  if (messages.length === 0) {
    return { success: true, markedCount: 0 };
  }

  // Mark messages as read
  const messageIds = messages.map(m => m.id);
  const now = new Date();

  await this.messageRepository.update(
    { id: In(messageIds) },
    { readAt: now }
  );

  // Get thread and find other user
  const thread = await this.threadRepository.findOne({
    where: { id: threadId },
    relations: ['userA', 'userB'],
  });

  const otherUserId = thread.userAId === userId ? thread.userBId : thread.userAId;

  // Broadcast read receipt to the sender
  this.messagingGateway.server
    .to(`user:${otherUserId}`)
    .emit('message_read', {
      type: 'message_read',
      threadId,
      messageIds,
      readBy: userId,
      readAt: now.toISOString(),
    });

  return { success: true, markedCount: messages.length };
}
```

---

### Broadcasting Thread Updates

**Example:**

```typescript
async updateThreadUnreadCount(threadId: string, userId: string) {
  // Calculate unread count for user
  const unreadCount = await this.messageRepository.count({
    where: {
      threadId,
      senderId: Not(userId),
      readAt: IsNull(),
    },
  });

  // Get last message
  const lastMessage = await this.messageRepository.findOne({
    where: { threadId },
    order: { createdAt: 'DESC' },
  });

  // Broadcast to user
  this.messagingGateway.server
    .to(`user:${userId}`)
    .emit('thread_update', {
      type: 'thread_update',
      threadId,
      unreadCount,
      lastMessage: lastMessage ? {
        text: lastMessage.text,
        createdAt: lastMessage.createdAt.toISOString(),
      } : null,
    });
}
```

---

## 5. Testing WebSocket Implementation

### Using wscat (WebSocket CLI client)

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket server
wscat -c "ws://localhost:4000?token=YOUR_JWT_TOKEN"

# You should see connection confirmation
# Test by sending messages through your API and watching for events
```

### Using Browser Console

```javascript
// In browser console
const ws = new WebSocket("ws://localhost:4000?token=YOUR_JWT_TOKEN");

ws.onopen = () => console.log("Connected");
ws.onmessage = (event) => console.log("Message:", JSON.parse(event.data));
ws.onerror = (error) => console.error("Error:", error);
ws.onclose = () => console.log("Disconnected");
```

---

## 6. Integration Checklist

- [ ] WebSocket server running on correct port
- [ ] JWT authentication implemented for connections
- [ ] User rooms created on connection (`user:${userId}`)
- [ ] `new_message` event broadcasting when messages created
- [ ] `message_read` event broadcasting when messages marked as read
- [ ] `thread_update` event broadcasting when unread counts change
- [ ] Proper error handling for invalid tokens
- [ ] Connection/disconnection logging
- [ ] CORS configured for frontend origin
- [ ] WebSocket URL documented/configurable

---

## 7. Environment Configuration

Add to your `.env`:

```bash
# WebSocket Configuration
WS_PORT=4000
WS_PATH=/
FRONTEND_URL=http://localhost:3000

# JWT Configuration (if not already set)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

---

## 8. Common Issues & Solutions

### Issue 1: CORS errors

**Solution:** Configure CORS in WebSocket server

```typescript
cors: {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}
```

### Issue 2: Token not received

**Solution:** Check that frontend sends token in correct format

```javascript
// Frontend should use query parameter
const ws = new WebSocket("ws://localhost:4000?token=JWT_TOKEN");
```

### Issue 3: Messages not broadcasting

**Solution:** Ensure both participants join their user rooms

```typescript
client.join(`user:${userId}`);
```

### Issue 4: Duplicate messages

**Solution:** Frontend handles duplicates, but avoid sending to sender twice

```typescript
// Only send to OTHER participant, not sender
const otherUserId =
  thread.userAId === senderId ? thread.userBId : thread.userAId;
```

---

## 9. Performance Considerations

1. **Room Management:** Use user-specific rooms (`user:${userId}`) for targeted broadcasting
2. **Connection Pooling:** Limit connections per user (typically 1-2 per user)
3. **Message Queueing:** For offline users, store messages for delivery when they reconnect
4. **Heartbeat/Ping:** Implement ping/pong to detect dead connections
5. **Rate Limiting:** Limit message sending rate per user

---

## 10. Example Complete NestJS Module

```typescript
// messaging.gateway.ts
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
    credentials: true,
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

      // If no token in auth/query, try to extract from cookies (httpOnly)
      if (!token) {
        const cookieHeader = client.handshake.headers.cookie;
        if (cookieHeader) {
          const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split("=");
            acc[key] = value;
            return acc;
          }, {});
          token = cookies["access_token"];
        }
      }

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verify(token);
      const userId = payload.sub || payload.userId;

      client.data.userId = userId;
      client.join(`user:${userId}`);

      console.log(`✅ Client connected: ${client.id} (User: ${userId})`);
    } catch (error) {
      console.log("Invalid token, disconnecting client");
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
  }

  // Helper methods for broadcasting
  broadcastNewMessage(userIds: string[], payload: any) {
    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit("new_message", payload);
    });
  }

  broadcastMessageRead(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit("message_read", payload);
  }

  broadcastThreadUpdate(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit("thread_update", payload);
  }
}
```

---

## Questions or Issues?

Contact the frontend team if you need clarification on:

- Event payload structures
- Expected behavior
- Frontend WebSocket implementation details

---

## Summary

1. ✅ Set up WebSocket server on `ws://localhost:4000`
2. ✅ Authenticate connections using JWT from query parameter
3. ✅ Create user-specific rooms (`user:${userId}`)
4. ✅ Broadcast `new_message` when messages are created
5. ✅ Broadcast `message_read` when messages are marked as read
6. ✅ Broadcast `thread_update` when unread counts change
7. ✅ Handle connection/disconnection properly
8. ✅ Test with wscat or browser console

**The frontend is ready and waiting for these WebSocket events!**
