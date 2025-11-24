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
      console.log("Socket.IO already connected");
      return;
    }

    try {
      const wsUrl = import.meta.env.VITE_WS_URL;

      console.log("Connecting to Socket.IO server...");

      // Clean token (remove "Bearer " prefix if present)
      const cleanToken = this.cleanToken(token);

      if (cleanToken) {
        console.log("Token provided:", cleanToken ? "✅" : "❌");
      } else {
        console.log("No token provided - using httpOnly cookies 🍪");
      }

      // Create Socket.IO connection config
      const config = {
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

      this.socket = io(wsUrl, config);

      // Connection successful
      this.socket.on("connect", () => {
        console.log("✅ Socket.IO connected:", this.socket.id);
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

      // Connection error
      this.socket.on("connect_error", (error) => {
        console.error("❌ Socket.IO connection error:", error.message);
        this.reconnectAttempts++;
        this.emit("error", error);

        // Stop trying after max attempts
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error("Max reconnection attempts reached");
          this.socket?.disconnect();
        }
      });

      // Disconnection
      this.socket.on("disconnect", (reason) => {
        console.log("🔌 Socket.IO disconnected:", reason);
        this.emit("disconnected");

        // Auto-reconnect is handled by Socket.IO
        if (reason === "io server disconnect") {
          // Server initiated disconnect, manually reconnect
          this.socket?.connect();
        }
      });

      // Reconnection attempt
      this.socket.io.on("reconnect_attempt", (attempt) => {
        console.log(
          `Reconnecting... Attempt ${attempt}/${this.maxReconnectAttempts}`
        );
      });

      // Reconnection successful
      this.socket.io.on("reconnect", (attemptNumber) => {
        console.log(`✅ Reconnected after ${attemptNumber} attempts`);
        this.reconnectAttempts = 0;
      });

      // Reconnection failed
      this.socket.io.on("reconnect_failed", () => {
        console.error("❌ Reconnection failed");
      });
    } catch (error) {
      console.error("Failed to create Socket.IO connection:", error);
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
