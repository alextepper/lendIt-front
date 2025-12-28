/**
 * WebSocket service for real-time messaging using Socket.IO
 */

import { io } from "socket.io-client";

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
  }

  /**
   * Clean token by removing "Bearer " prefix if present
   * @param {string} token - JWT token (possibly with Bearer prefix)
   * @returns {string} Clean token without Bearer prefix
   */
  cleanToken(token) {
    if (!token) return token;

    // Remove "Bearer " prefix if present (case insensitive)
    if (token.toLowerCase().startsWith("bearer ")) {
      return token.substring(7).trim();
    }

    return token.trim();
  }

  connect(token) {
    if (this.socket?.connected) {
      console.log("🔌 Socket.IO already connected, socket ID:", this.socket.id);
      return;
    }

    try {
      // Get WebSocket URL from runtime config or fallback to build-time env var
      const wsUrl =
        (typeof window !== "undefined" && window.__WS_URL__) ||
        import.meta.env.VITE_WS_URL ||
        (import.meta.env.PROD
          ? window.location.origin
          : window.location.origin);

      console.log("🔗 [WebSocket] Starting connection process...");
      console.log("🌐 [WebSocket] URL:", wsUrl);
      console.log(
        "🌐 [WebSocket] window.location.origin:",
        window.location.origin
      );
      console.log("🌐 [WebSocket] window.__WS_URL__:", window.__WS_URL__);
      console.log("🌐 [WebSocket] VITE_WS_URL:", import.meta.env.VITE_WS_URL);
      console.log("🌐 [WebSocket] PROD mode:", import.meta.env.PROD);

      // Clean token (remove "Bearer " prefix if present)
      const cleanToken = this.cleanToken(token);

      if (cleanToken) {
        console.log(
          "🔑 [WebSocket] Token provided: ✅ (length:",
          cleanToken.length,
          ")"
        );
      } else {
        console.log(
          "🔑 [WebSocket] No token provided - using httpOnly cookies 🍪"
        );
      }

      // Create Socket.IO connection config
      const config = {
        path: "/api/socket.io/", // Use /api/socket.io instead of /socket.io
        withCredentials: true, // IMPORTANT: Send httpOnly cookies with request
        transports: ["websocket", "polling"], // Try WebSocket first, fallback to polling
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
      };

      // Only add token if provided (for systems that don't use httpOnly cookies)
      if (cleanToken) {
        config.auth = { token: cleanToken };
        config.query = { token: cleanToken };
      }

      console.log("⚙️ [WebSocket] Connection config:", {
        path: config.path,
        withCredentials: config.withCredentials,
        transports: config.transports,
        reconnection: config.reconnection,
        reconnectionAttempts: config.reconnectionAttempts,
        hasAuth: !!config.auth,
        hasQuery: !!config.query,
      });

      console.log("🚀 [WebSocket] Creating Socket.IO instance...");
      this.socket = io(wsUrl, config);
      console.log(
        "✅ [WebSocket] Socket.IO instance created, socket:",
        this.socket
      );

      // Connection successful
      this.socket.on("connect", () => {
        console.log("✅ [WebSocket] Connected successfully!");
        console.log("   Socket ID:", this.socket.id);
        console.log("   Transport:", this.socket.io.engine.transport.name);
        console.log("   URL:", this.socket.io.uri);
        this.reconnectAttempts = 0;
        this.emit("connected");
      });

      // Handle messages
      this.socket.on("new_message", (data) => {
        console.log("📨 New message received:", data);
        this.emit("new_message", data);
      });

      this.socket.on("message_read", (data) => {
        console.log("👁️ Message read:", data);
        this.emit("message_read", data);
      });

      this.socket.on("thread_update", (data) => {
        console.log("🔄 Thread update:", data);
        this.emit("thread_update", data);
      });

      // Booking events
      this.socket.on("booking_created", (data) => {
        console.log("📅 Booking created:", data);
        this.emit("booking_created", data);
      });

      this.socket.on("booking_updated", (data) => {
        console.log("📅 Booking updated:", data);
        this.emit("booking_updated", data);
      });

      this.socket.on("booking_status_changed", (data) => {
        console.log("📅 Booking status changed:", data);
        this.emit("booking_status_changed", data);
      });

      // Connection error
      this.socket.on("connect_error", (error) => {
        console.error("❌ [WebSocket] Connection error occurred");
        console.error("   Error message:", error.message);
        console.error("   Error type:", error.type);
        console.error("   Error description:", error.description);
        console.error("   Error context:", error.context);
        console.error("   Full error object:", error);
        console.error("   Socket state:", {
          connected: this.socket?.connected,
          disconnected: this.socket?.disconnected,
          transport: this.socket?.io?.engine?.transport?.name,
          readyState: this.socket?.io?.engine?.readyState,
        });
        console.error("   Current URL:", this.socket?.io?.uri);
        console.error(
          "   Reconnect attempt:",
          this.reconnectAttempts + 1,
          "/",
          this.maxReconnectAttempts
        );

        this.reconnectAttempts++;
        this.emit("error", error);

        // Stop trying after max attempts
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error(
            "❌ [WebSocket] Max reconnection attempts reached, stopping reconnection"
          );
          this.socket?.disconnect();
        }
      });

      // Disconnection
      this.socket.on("disconnect", (reason) => {
        console.log("🔌 [WebSocket] Disconnected");
        console.log("   Reason:", reason);
        console.log("   Socket ID:", this.socket?.id);
        console.log("   Reconnect attempts:", this.reconnectAttempts);
        this.emit("disconnected");

        // Auto-reconnect is handled by Socket.IO
        if (reason === "io server disconnect") {
          console.log(
            "🔄 [WebSocket] Server initiated disconnect, manually reconnecting..."
          );
          // Server initiated disconnect, manually reconnect
          this.socket?.connect();
        }
      });

      // Transport upgrade/downgrade
      this.socket.io.engine.on("upgrade", () => {
        console.log(
          "⬆️ [WebSocket] Transport upgraded to:",
          this.socket.io.engine.transport.name
        );
      });

      this.socket.io.engine.on("downgrade", () => {
        console.log(
          "⬇️ [WebSocket] Transport downgraded to:",
          this.socket.io.engine.transport.name
        );
      });

      // Connection state changes
      this.socket.io.engine.on("open", () => {
        console.log("🔓 [WebSocket] Engine opened");
      });

      this.socket.io.engine.on("close", (reason) => {
        console.log("🔒 [WebSocket] Engine closed, reason:", reason);
      });

      this.socket.io.engine.on("error", (error) => {
        console.error("⚠️ [WebSocket] Engine error:", error);
        console.error("   Error details:", {
          message: error.message,
          type: error.type,
          description: error.description,
        });
      });

      // Reconnection attempt
      this.socket.io.on("reconnect_attempt", (attempt) => {
        console.log(
          `🔄 [WebSocket] Reconnecting... Attempt ${attempt}/${this.maxReconnectAttempts}`
        );
        console.log("   Current URL:", this.socket.io.uri);
        console.log("   Transport:", this.socket.io.engine?.transport?.name);
      });

      // Reconnection successful
      this.socket.io.on("reconnect", (attemptNumber) => {
        console.log(
          `✅ [WebSocket] Reconnected successfully after ${attemptNumber} attempts`
        );
        console.log("   Socket ID:", this.socket.id);
        console.log("   Transport:", this.socket.io.engine.transport.name);
        this.reconnectAttempts = 0;
      });

      // Reconnection failed
      this.socket.io.on("reconnect_failed", () => {
        console.error(
          "❌ [WebSocket] Reconnection failed - all attempts exhausted"
        );
        console.error("   Total attempts:", this.reconnectAttempts);
      });
    } catch (error) {
      console.error("❌ [WebSocket] Failed to create Socket.IO connection");
      console.error("   Error:", error);
      console.error("   Error message:", error.message);
      console.error("   Error stack:", error.stack);
    }
  }

  disconnect() {
    if (this.socket) {
      console.log("Disconnecting Socket.IO...");
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }

  send(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
      return true;
    }
    console.warn("Socket.IO is not connected");
    return false;
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return;

    const callbacks = this.listeners.get(eventType);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(eventType, data) {
    if (!this.listeners.has(eventType)) return;

    const callbacks = this.listeners.get(eventType);
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error);
      }
    });
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

// Singleton instance
const websocketService = new WebSocketService();

export default websocketService;
