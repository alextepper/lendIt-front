/**
 * WebSocket Connection Test Script
 *
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 *
 * The script will automatically test your WebSocket connection
 */

(async function testWebSocketConnection() {
  console.log("🧪 Starting WebSocket Connection Test...\n");
  console.log("═══════════════════════════════════════\n");

  // Load Socket.IO dynamically if not already loaded
  if (typeof io === "undefined") {
    console.log("📦 Loading Socket.IO client...");
    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
    script.onload = () => {
      console.log("✅ Socket.IO loaded\n");
      runTest();
    };
    script.onerror = () => {
      console.error("❌ Failed to load Socket.IO");
      console.log(
        "\nPlease load Socket.IO manually or run this in the main app"
      );
    };
    document.head.appendChild(script);
    return;
  }

  runTest();

  function runTest() {
    // Step 1: Get token
    console.log("Step 1: Getting JWT token from localStorage...");
    let token = localStorage.getItem("access_token");

    if (!token) {
      console.error("❌ No token found in localStorage");
      console.log("\n💡 Solutions:");
      console.log("1. Make sure you're logged in");
      console.log(
        '2. Check that token is stored in localStorage as "access_token"'
      );
      console.log("3. Try logging in again\n");
      return;
    }

    console.log("✅ Token found");
    console.log(`📝 Raw token: ${token.substring(0, 50)}...`);
    console.log(`📏 Length: ${token.length} characters\n`);

    // Step 2: Clean token
    console.log("Step 2: Cleaning token...");
    const originalToken = token;

    // Remove "Bearer " prefix if present
    if (token.toLowerCase().startsWith("bearer ")) {
      token = token.substring(7).trim();
      console.log('✅ Removed "Bearer " prefix');
    } else {
      console.log('ℹ️ No "Bearer " prefix found (token is clean)');
    }

    token = token.trim();
    console.log(`📝 Clean token: ${token.substring(0, 50)}...`);
    console.log(`📏 New length: ${token.length} characters\n`);

    // Step 3: Validate token format
    console.log("Step 3: Validating token format...");
    const parts = token.split(".");

    console.log(`📊 Token parts: ${parts.length} (expected: 3)`);

    if (parts.length !== 3) {
      console.error("❌ Invalid JWT format");
      console.log("\n💡 JWT tokens should have 3 parts separated by dots:");
      console.log("   header.payload.signature\n");
      return;
    }

    console.log("✅ Token format is valid\n");

    // Step 4: Try to decode (just for info, don't use in production)
    try {
      console.log("Step 4: Decoding token payload (for debugging)...");
      const payload = JSON.parse(atob(parts[1]));
      console.log("📋 Token payload:");
      console.log(payload);

      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const now = new Date();
        const isExpired = expDate < now;

        console.log(`⏰ Expires: ${expDate.toLocaleString()}`);
        console.log(`📅 Current: ${now.toLocaleString()}`);
        console.log(
          `${isExpired ? "❌ Token is EXPIRED" : "✅ Token is still valid"}\n`
        );

        if (isExpired) {
          console.error("⚠️ Your token has expired. Please log in again.\n");
          return;
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not decode token payload (not critical)");
      console.log(`   Error: ${e.message}\n`);
    }

    // Step 5: Test connection
    console.log("Step 5: Testing WebSocket connection...");
    console.log("🔌 Connecting to http://localhost:4000...\n");

    const socket = io("http://localhost:4000", {
      auth: {
        token: token,
      },
      query: {
        token: token,
      },
      transports: ["websocket", "polling"],
      reconnection: false, // Disable for testing
      timeout: 10000,
    });

    // Success handlers
    socket.on("connect", () => {
      console.log("═══════════════════════════════════════");
      console.log("🎉 SUCCESS! WebSocket Connected");
      console.log("═══════════════════════════════════════\n");
      console.log(`✅ Socket ID: ${socket.id}`);
      console.log(`✅ Connected to: http://localhost:4000`);
      console.log(`✅ Transport: ${socket.io.engine.transport.name}\n`);

      console.log("📡 Connection is working perfectly!");
      console.log("\n💡 You can now:");
      console.log("1. Test sending messages in the app");
      console.log("2. Open another browser tab to test real-time updates");
      console.log("3. Check for incoming events\n");

      // Listen for events
      console.log("👂 Listening for WebSocket events...\n");

      socket.on("new_message", (data) => {
        console.log("📨 Received new_message event:", data);
      });

      socket.on("message_read", (data) => {
        console.log("👁️ Received message_read event:", data);
      });

      socket.on("thread_update", (data) => {
        console.log("🔄 Received thread_update event:", data);
      });

      // Keep connection open
      console.log("Connection will remain open. Close this tab to disconnect.");

      // Make socket available globally for manual testing
      window.testSocket = socket;
      console.log("\n💡 Socket available as: window.testSocket");
      console.log('   Try: window.testSocket.emit("ping")');
    });

    socket.on("connected", (data) => {
      console.log("📡 Received server confirmation:", data);
    });

    socket.on("disconnect", (reason) => {
      console.log(`\n🔌 Disconnected: ${reason}`);
    });

    // Error handlers
    socket.on("connect_error", (error) => {
      console.log("═══════════════════════════════════════");
      console.log("❌ CONNECTION FAILED");
      console.log("═══════════════════════════════════════\n");
      console.error(`Error: ${error.message}\n`);

      console.log("🔍 Troubleshooting:");

      if (
        error.message.includes("xhr poll error") ||
        error.message.includes("timeout")
      ) {
        console.log("\n1️⃣ Backend Server Issue:");
        console.log("   ❌ Backend is not responding");
        console.log(
          "   ✅ Fix: Make sure backend is running on http://localhost:4000"
        );
        console.log("   ✅ Check: Backend logs for errors");
        console.log("   ✅ Test: curl http://localhost:4000/health");
      } else if (
        error.message.includes("websocket error") ||
        error.message.includes("401")
      ) {
        console.log("\n2️⃣ Authentication Issue:");
        console.log("   ❌ Token validation failed on backend");
        console.log("   ✅ Fix: Check token is correct");
        console.log("   ✅ Fix: Verify JWT secret matches on backend");
        console.log("   ✅ Fix: Check token hasn't expired");
        console.log("   ✅ Test: Log in again to get fresh token");
      } else if (error.message.includes("CORS")) {
        console.log("\n3️⃣ CORS Issue:");
        console.log("   ❌ Backend blocked the request");
        console.log("   ✅ Fix: Configure CORS on backend Socket.IO gateway");
        console.log("   ✅ Add: origin: 'http://localhost:3000'");
      } else {
        console.log("\n4️⃣ Other Issues:");
        console.log("   ❌ Unknown error");
        console.log("   ✅ Check: Browser console for more details");
        console.log("   ✅ Check: Network tab in DevTools");
        console.log("   ✅ Check: Backend logs");
      }

      console.log("\n📋 Debug Info:");
      console.log(`   Token length: ${token.length}`);
      console.log(`   Token preview: ${token.substring(0, 50)}...`);
      console.log(`   Backend URL: http://localhost:4000`);
      console.log(`   Transport attempted: websocket, polling`);

      socket.disconnect();
    });

    socket.on("error", (error) => {
      console.error("⚠️ Socket error:", error);
    });

    // Timeout
    setTimeout(() => {
      if (!socket.connected) {
        console.log("\n⏱️ Connection attempt timed out after 10 seconds");
        console.log("Backend might be slow or not responding");
        socket.disconnect();
      }
    }, 10000);
  }
})();

console.log("\n═══════════════════════════════════════");
console.log("Test complete! Check the output above.");
console.log("═══════════════════════════════════════\n");
