# Frontend WebSocket Integration Guide

## 🚀 Quick Start

This guide shows you how to integrate WebSocket real-time messaging into your Vue 3 frontend using Socket.IO.

---

## Step 1: Install Socket.IO Client

```bash
npm install socket.io-client
# or
yarn add socket.io-client
# or
pnpm add socket.io-client
```

---

## Step 2: Create WebSocket Service

Create a new file `src/services/websocketService.js`:

```javascript
// src/services/websocketService.js
import { io } from "socket.io-client";

let socket = null;

/**
 * Clean token by removing "Bearer " prefix if present
 * @param {string} token - JWT token (possibly with Bearer prefix)
 * @returns {string} Clean token without Bearer prefix
 */
function cleanToken(token) {
  if (!token) return token;

  // Remove "Bearer " prefix if present (case insensitive)
  if (token.toLowerCase().startsWith("bearer ")) {
    return token.substring(7).trim();
  }

  return token.trim();
}

/**
 * Connect to WebSocket server
 * @param {string} token - JWT access token
 * @returns {Socket} Socket.IO client instance
 */
export function connectWebSocket(token) {
  if (socket && socket.connected) {
    console.log("WebSocket already connected");
    return socket;
  }

  console.log("🔌 Connecting to WebSocket...");

  // Clean token (remove "Bearer " prefix if present)
  const cleanedToken = cleanToken(token);

  // Connect using Socket.IO client
  socket = io("http://localhost:4000", {
    query: { token: cleanedToken },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ["websocket", "polling"], // Try websocket first, fallback to polling
  });

  // Connection events
  socket.on("connect", () => {
    console.log("✅ WebSocket connected");
    console.log("Socket ID:", socket.id);
  });

  socket.on("connected", (data) => {
    console.log("📡 Server confirmation:", data);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 WebSocket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ WebSocket connection error:", error.message);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("🔄 Reconnected after", attemptNumber, "attempts");
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log("🔄 Reconnection attempt", attemptNumber);
  });

  socket.on("reconnect_error", (error) => {
    console.error("❌ Reconnection error:", error.message);
  });

  socket.on("reconnect_failed", () => {
    console.error("❌ Failed to reconnect after maximum attempts");
  });

  return socket;
}

/**
 * Disconnect from WebSocket server
 */
export function disconnectWebSocket() {
  if (socket) {
    console.log("🔌 Disconnecting WebSocket...");
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get current socket instance
 * @returns {Socket|null} Socket.IO client instance or null
 */
export function getSocket() {
  return socket;
}

/**
 * Check if socket is connected
 * @returns {boolean} True if connected
 */
export function isConnected() {
  return socket && socket.connected;
}

/**
 * Subscribe to new message events
 * @param {Function} callback - Callback function to handle new messages
 */
export function onNewMessage(callback) {
  if (socket) {
    socket.on("new_message", callback);
  }
}

/**
 * Subscribe to message read events
 * @param {Function} callback - Callback function to handle read receipts
 */
export function onMessageRead(callback) {
  if (socket) {
    socket.on("message_read", callback);
  }
}

/**
 * Subscribe to thread update events
 * @param {Function} callback - Callback function to handle thread updates
 */
export function onThreadUpdate(callback) {
  if (socket) {
    socket.on("thread_update", callback);
  }
}

/**
 * Unsubscribe from an event
 * @param {string} eventName - Name of the event
 * @param {Function} callback - Callback function to remove
 */
export function removeListener(eventName, callback) {
  if (socket) {
    socket.off(eventName, callback);
  }
}

/**
 * Manually reconnect
 */
export function reconnect() {
  if (socket && !socket.connected) {
    socket.connect();
  }
}
```

---

## Step 3: Create Chat Store (Pinia)

Create a new file `src/stores/chat.js`:

```javascript
// src/stores/chat.js
import { defineStore } from "pinia";
import {
  connectWebSocket,
  disconnectWebSocket,
  getSocket,
  isConnected,
  onNewMessage,
  onMessageRead,
  onThreadUpdate,
} from "@/services/websocketService";

export const useChatStore = defineStore("chat", {
  state: () => ({
    threads: [],
    currentThread: null,
    messages: {},
    isConnected: false,
    connectionError: null,
  }),

  getters: {
    /**
     * Get messages for a specific thread
     */
    getThreadMessages: (state) => (threadId) => {
      return state.messages[threadId] || [];
    },

    /**
     * Get total unread count across all threads
     */
    totalUnreadCount: (state) => {
      return state.threads.reduce(
        (total, thread) => total + (thread.unreadCount || 0),
        0
      );
    },

    /**
     * Check if thread has unread messages
     */
    hasUnreadMessages: (state) => (threadId) => {
      const thread = state.threads.find((t) => t.id === threadId);
      return thread && thread.unreadCount > 0;
    },
  },

  actions: {
    /**
     * Initialize WebSocket connection
     */
    async initializeWebSocket(token) {
      try {
        console.log("🚀 Initializing WebSocket connection...");

        const socket = connectWebSocket(token);

        // Connection event handlers
        socket.on("connect", () => {
          console.log("✅ WebSocket connected in store");
          this.isConnected = true;
          this.connectionError = null;
        });

        socket.on("disconnect", (reason) => {
          console.log("🔌 WebSocket disconnected in store:", reason);
          this.isConnected = false;
        });

        socket.on("connect_error", (error) => {
          console.error(
            "❌ WebSocket connection error in store:",
            error.message
          );
          this.connectionError = error.message;
        });

        // Message event handlers
        onNewMessage((data) => {
          console.log("📨 New message received:", data);
          this.handleNewMessage(data);
        });

        onMessageRead((data) => {
          console.log("👁️ Messages read:", data);
          this.handleMessageRead(data);
        });

        onThreadUpdate((data) => {
          console.log("🔄 Thread updated:", data);
          this.handleThreadUpdate(data);
        });
      } catch (error) {
        console.error("❌ Failed to initialize WebSocket:", error);
        this.connectionError = error.message;
      }
    },

    /**
     * Handle new message event
     */
    handleNewMessage(data) {
      const { threadId, message } = data;

      // Initialize messages array for thread if it doesn't exist
      if (!this.messages[threadId]) {
        this.messages[threadId] = [];
      }

      // Add message to thread
      this.messages[threadId].push(message);

      // Update thread in list
      const thread = this.threads.find((t) => t.id === threadId);
      if (thread) {
        thread.lastMessage = {
          text: message.text || "📷 Image",
          createdAt: message.createdAt,
        };
        thread.updatedAt = message.createdAt;

        // Increment unread count if not from current user
        if (
          message.senderId !== this.currentUserId &&
          threadId !== this.currentThread?.id
        ) {
          thread.unreadCount = (thread.unreadCount || 0) + 1;
        }

        // Move thread to top of list
        this.threads = [
          thread,
          ...this.threads.filter((t) => t.id !== threadId),
        ];
      }

      // Show notification if not from current user and not viewing the thread
      if (
        message.senderId !== this.currentUserId &&
        threadId !== this.currentThread?.id
      ) {
        this.showMessageNotification(message);
      }

      // Play notification sound
      if (message.senderId !== this.currentUserId) {
        this.playNotificationSound();
      }
    },

    /**
     * Handle message read event
     */
    handleMessageRead(data) {
      const { threadId, messageIds, readAt } = data;

      // Update read status for messages
      if (this.messages[threadId]) {
        this.messages[threadId] = this.messages[threadId].map((msg) => {
          if (messageIds.includes(msg.id)) {
            return { ...msg, readAt };
          }
          return msg;
        });
      }

      // Update thread read status
      const thread = this.threads.find((t) => t.id === threadId);
      if (thread) {
        thread.lastReadAt = readAt;
      }
    },

    /**
     * Handle thread update event
     */
    handleThreadUpdate(data) {
      const { threadId, unreadCount, lastMessage } = data;

      // Update thread in list
      const thread = this.threads.find((t) => t.id === threadId);
      if (thread) {
        thread.unreadCount = unreadCount;
        if (lastMessage) {
          thread.lastMessage = lastMessage;
          thread.updatedAt = lastMessage.createdAt;
        }
      }
    },

    /**
     * Show browser notification for new message
     */
    showMessageNotification(message) {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`New message from ${message.sender.username}`, {
          body: message.text || "📷 Sent an image",
          icon: "/logo.png",
          tag: message.threadId,
        });
      }
    },

    /**
     * Play notification sound
     */
    playNotificationSound() {
      try {
        const audio = new Audio("/notification.mp3");
        audio.volume = 0.5;
        audio.play().catch((err) => console.warn("Could not play sound:", err));
      } catch (error) {
        console.warn("Notification sound error:", error);
      }
    },

    /**
     * Set current thread
     */
    setCurrentThread(thread) {
      this.currentThread = thread;

      // Mark thread as read when opened
      if (thread && thread.unreadCount > 0) {
        this.markThreadAsRead(thread.id);
      }
    },

    /**
     * Mark thread as read (API call)
     */
    async markThreadAsRead(threadId) {
      try {
        await fetch(`http://localhost:4000/threads/${threadId}/read`, {
          method: "PATCH",
          credentials: "include",
        });

        // Update local state
        const thread = this.threads.find((t) => t.id === threadId);
        if (thread) {
          thread.unreadCount = 0;
        }
      } catch (error) {
        console.error("Failed to mark thread as read:", error);
      }
    },

    /**
     * Disconnect WebSocket
     */
    disconnect() {
      disconnectWebSocket();
      this.isConnected = false;
    },

    /**
     * Load threads from API
     */
    async loadThreads() {
      try {
        const response = await fetch("http://localhost:4000/threads", {
          credentials: "include",
        });
        const data = await response.json();
        this.threads = data.data;
      } catch (error) {
        console.error("Failed to load threads:", error);
      }
    },

    /**
     * Load messages for a thread
     */
    async loadThreadMessages(threadId) {
      try {
        const response = await fetch(
          `http://localhost:4000/threads/${threadId}`,
          {
            credentials: "include",
          }
        );
        const data = await response.json();
        this.messages[threadId] = data.messages;
        return data;
      } catch (error) {
        console.error("Failed to load thread messages:", error);
      }
    },

    /**
     * Send a message
     */
    async sendMessage(threadId, messageData) {
      try {
        const response = await fetch(
          `http://localhost:4000/threads/${threadId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(messageData),
          }
        );
        return await response.json();
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      }
    },
  },
});
```

---

## Step 4: Update App.vue

Update your `src/App.vue` to initialize WebSocket on mount:

```vue
<template>
  <div id="app">
    <!-- Connection status indicator -->
    <div
      v-if="showConnectionStatus"
      class="connection-status"
      :class="connectionStatusClass"
    >
      <span class="status-icon">{{ connectionStatusIcon }}</span>
      <span class="status-text">{{ connectionStatusText }}</span>
    </div>

    <!-- Your app content -->
    <router-view />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth"; // Your auth store

const chatStore = useChatStore();
const authStore = useAuthStore();

const showConnectionStatus = ref(true);

// Connection status computed properties
const connectionStatusClass = computed(() => ({
  "status-connected": chatStore.isConnected,
  "status-disconnected": !chatStore.isConnected,
}));

const connectionStatusIcon = computed(() =>
  chatStore.isConnected ? "🟢" : "🔴"
);

const connectionStatusText = computed(() =>
  chatStore.isConnected ? "Connected" : "Disconnected"
);

// Initialize WebSocket when component mounts
onMounted(async () => {
  console.log("🚀 App mounted, initializing WebSocket...");

  // Request notification permission
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  // Get token from auth store
  const token = authStore.token || localStorage.getItem("access_token");

  if (token) {
    console.log("✅ Token found, connecting WebSocket...");
    await chatStore.initializeWebSocket(token);
  } else {
    console.warn("⚠️ No token found, skipping WebSocket connection");
  }

  // Auto-hide connection status after 3 seconds if connected
  setTimeout(() => {
    if (chatStore.isConnected) {
      showConnectionStatus.value = false;
    }
  }, 3000);
});

// Watch for auth changes
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated && !chatStore.isConnected) {
      const token = authStore.token || localStorage.getItem("access_token");
      if (token) {
        chatStore.initializeWebSocket(token);
      }
    } else if (!isAuthenticated && chatStore.isConnected) {
      chatStore.disconnect();
    }
  }
);

// Cleanup on unmount
onUnmounted(() => {
  console.log("🧹 App unmounting, disconnecting WebSocket...");
  chatStore.disconnect();
});
</script>

<style scoped>
.connection-status {
  position: fixed;
  top: 10px;
  right: 10px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.status-connected {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #66bb6a;
}

.status-disconnected {
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ef5350;
}

.status-icon {
  font-size: 12px;
}

.status-text {
  font-size: 13px;
}
</style>
```

---

## Step 5: Create Chat Component

Create a chat component `src/components/ChatView.vue`:

```vue
<template>
  <div class="chat-container">
    <!-- Thread List -->
    <div class="thread-list">
      <div class="thread-list-header">
        <h2>Messages</h2>
        <span v-if="chatStore.totalUnreadCount > 0" class="unread-badge">
          {{ chatStore.totalUnreadCount }}
        </span>
      </div>

      <div
        v-for="thread in chatStore.threads"
        :key="thread.id"
        class="thread-item"
        :class="{ active: currentThreadId === thread.id }"
        @click="selectThread(thread)"
      >
        <div class="thread-avatar">
          {{ thread.otherUser.username.charAt(0).toUpperCase() }}
        </div>
        <div class="thread-content">
          <div class="thread-header">
            <span class="thread-username">{{ thread.otherUser.username }}</span>
            <span class="thread-time">{{ formatTime(thread.updatedAt) }}</span>
          </div>
          <div class="thread-last-message">
            {{ thread.lastMessage?.text || "No messages yet" }}
          </div>
        </div>
        <span v-if="thread.unreadCount > 0" class="thread-unread">
          {{ thread.unreadCount }}
        </span>
      </div>
    </div>

    <!-- Messages View -->
    <div class="messages-view">
      <div v-if="!currentThread" class="no-thread-selected">
        <p>Select a conversation to start messaging</p>
      </div>

      <div v-else class="messages-container">
        <!-- Thread Header -->
        <div class="messages-header">
          <div class="thread-user-info">
            <div class="user-avatar">
              {{ currentThread.otherUser.username.charAt(0).toUpperCase() }}
            </div>
            <div class="user-details">
              <h3>{{ currentThread.otherUser.username }}</h3>
              <span class="user-email">{{
                currentThread.otherUser.email
              }}</span>
            </div>
          </div>
        </div>

        <!-- Messages List -->
        <div ref="messagesContainer" class="messages-list">
          <div
            v-for="message in currentMessages"
            :key="message.id"
            class="message"
            :class="{ 'message-own': message.senderId === currentUserId }"
          >
            <div class="message-bubble">
              <div v-if="message.type === 'TEXT'" class="message-text">
                {{ message.text }}
              </div>
              <div v-else-if="message.type === 'IMAGE'" class="message-image">
                <img :src="message.imageUrl" alt="Image message" />
                <p v-if="message.text">{{ message.text }}</p>
              </div>
              <div class="message-meta">
                <span class="message-time">{{
                  formatTime(message.createdAt)
                }}</span>
                <span
                  v-if="message.senderId === currentUserId"
                  class="message-read-status"
                >
                  {{ message.readAt ? "✓✓" : "✓" }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Message Input -->
        <div class="message-input-container">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Type a message..."
            class="message-input"
            @keyup.enter="sendMessage"
          />
          <button
            class="send-button"
            @click="sendMessage"
            :disabled="!newMessage.trim()"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";

const chatStore = useChatStore();
const authStore = useAuthStore();

const currentThreadId = ref(null);
const newMessage = ref("");
const messagesContainer = ref(null);

const currentUserId = computed(() => authStore.user?.id);
const currentThread = computed(() => chatStore.currentThread);
const currentMessages = computed(() => {
  if (!currentThreadId.value) return [];
  return chatStore.getThreadMessages(currentThreadId.value);
});

// Select a thread
async function selectThread(thread) {
  currentThreadId.value = thread.id;
  chatStore.setCurrentThread(thread);

  // Load messages if not already loaded
  if (!chatStore.messages[thread.id]) {
    await chatStore.loadThreadMessages(thread.id);
  }

  // Scroll to bottom
  await nextTick();
  scrollToBottom();
}

// Send a message
async function sendMessage() {
  if (!newMessage.value.trim() || !currentThreadId.value) return;

  try {
    await chatStore.sendMessage(currentThreadId.value, {
      type: "TEXT",
      text: newMessage.value,
    });

    newMessage.value = "";

    // Scroll to bottom
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error("Failed to send message:", error);
    alert("Failed to send message. Please try again.");
  }
}

// Scroll to bottom of messages
function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

// Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Watch for new messages and scroll to bottom
watch(currentMessages, async () => {
  await nextTick();
  scrollToBottom();
});
</script>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  max-height: 100vh;
}

.thread-list {
  width: 300px;
  border-right: 1px solid #e0e0e0;
  background: #fff;
  overflow-y: auto;
}

.thread-list-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.thread-list-header h2 {
  margin: 0;
  font-size: 20px;
}

.unread-badge {
  background: #ff5252;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: bold;
}

.thread-item {
  display: flex;
  padding: 12px 20px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f5f5f5;
}

.thread-item:hover {
  background: #f5f5f5;
}

.thread-item.active {
  background: #e3f2fd;
}

.thread-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2196f3;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 12px;
}

.thread-content {
  flex: 1;
  min-width: 0;
}

.thread-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.thread-username {
  font-weight: 600;
  font-size: 14px;
}

.thread-time {
  font-size: 12px;
  color: #757575;
}

.thread-last-message {
  font-size: 13px;
  color: #757575;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-unread {
  background: #ff5252;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: bold;
  align-self: center;
}

.messages-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.no-thread-selected {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9e9e9e;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.messages-header {
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.thread-user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2196f3;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 12px;
}

.user-details h3 {
  margin: 0;
  font-size: 16px;
}

.user-email {
  font-size: 12px;
  color: #757575;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message {
  display: flex;
  margin-bottom: 12px;
}

.message-own {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 60%;
  padding: 8px 12px;
  border-radius: 12px;
  background: white;
}

.message-own .message-bubble {
  background: #2196f3;
  color: white;
}

.message-text {
  word-wrap: break-word;
}

.message-image img {
  max-width: 100%;
  border-radius: 8px;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.7;
}

.message-input-container {
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 12px;
}

.message-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 24px;
  outline: none;
  font-size: 14px;
}

.send-button {
  padding: 10px 24px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  font-weight: 500;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

---

## Step 6: Update Environment Variables

Create or update `.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=http://localhost:4000
```

Update websocketService.js to use environment variable:

```javascript
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:4000";

socket = io(WS_URL, {
  // ... rest of config
});
```

---

## Testing Checklist

- [ ] Install Socket.IO client package
- [ ] Create websocketService.js
- [ ] Create or update chat store
- [ ] Update App.vue to initialize WebSocket
- [ ] Create chat component
- [ ] Test connection (check browser console for "✅ WebSocket connected")
- [ ] Test sending messages
- [ ] Test receiving messages in real-time
- [ ] Test read receipts
- [ ] Test unread counts
- [ ] Test reconnection (disconnect network and reconnect)
- [ ] Test with multiple users/tabs

---

## Troubleshooting

### Connection fails

**Check:**

1. Backend is running on `http://localhost:4000`
2. Token is valid and not expired
3. Browser console for error messages
4. Network tab in DevTools for WebSocket connection

**Common Issue: "Bearer " Prefix**

If you see "Invalid token" errors, check if your token has a "Bearer " prefix:

```javascript
// ❌ Wrong - includes Bearer prefix
const token = "Bearer eyJhbGci...";

// ✅ Correct - clean token
const token = "eyJhbGci...";
```

The WebSocket service now automatically removes the "Bearer " prefix if present, so both formats will work. You'll see this log:

```
Token cleaned: ✅
```

### Messages not received

**Check:**

1. Socket is connected (`chatStore.isConnected === true`)
2. Event listeners are set up correctly
3. You're a participant in the thread
4. Browser console for incoming events

### Duplicate messages

**Check:**

1. Remove duplicate event listeners
2. Clean up listeners in component unmount
3. Don't re-subscribe on every render

---

## Production Checklist

- [ ] Use `https://` URL for WebSocket (will use WSS automatically)
- [ ] Store token securely
- [ ] Handle token refresh
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add retry logic
- [ ] Show connection status to users
- [ ] Request notification permissions
- [ ] Add offline message queue
- [ ] Test on mobile devices

---

## Summary

You've now integrated Socket.IO WebSocket for real-time messaging! Your frontend will:

✅ Connect to WebSocket server with JWT authentication  
✅ Receive new messages instantly  
✅ Update read receipts in real-time  
✅ Show unread counts dynamically  
✅ Handle reconnections automatically  
✅ Show connection status to users

**The frontend is ready to communicate with your backend!** 🎉
