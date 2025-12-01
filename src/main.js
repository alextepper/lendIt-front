import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import i18n from "./i18n";

// Bootstrap CSS & JS
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap"; // JS for components
import "bootstrap-icons/font/bootstrap-icons.css";

// RTL Support
import "./assets/rtl.css";

import App from "./App.vue";
import { useAuthStore } from "./stores/auth";
import { useThemeStore } from "./stores/theme";
import { useChatStore } from "./stores/chat";
import { useLanguageStore } from "./stores/language";
import { useDebugStore } from "./stores/debug";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(i18n);

// Debug helper: capture console output into Pinia store for in-app log viewer.
// Enabled in development, or when URL contains ?debugLogs=1 (persists in localStorage).
if (typeof window !== "undefined") {
  try {
    const urlHasFlag = window.location.search.includes("debugLogs=1");
    if (urlHasFlag) {
      window.localStorage.setItem("debugLogs", "1");
    }

    const storedFlag = window.localStorage.getItem("debugLogs") === "1";
    const debugLogsEnabled = import.meta.env.DEV || urlHasFlag || storedFlag;

    if (debugLogsEnabled) {
      const debug = useDebugStore();

      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      const originalInfo = console.info;

      console.log = (...args) => {
        originalLog(...args);
        debug.addLog("log", args);
      };
      console.warn = (...args) => {
        originalWarn(...args);
        debug.addLog("warn", args);
      };
      console.error = (...args) => {
        originalError(...args);
        debug.addLog("error", args);
      };
      console.info = (...args) => {
        originalInfo(...args);
        debug.addLog("info", args);
      };
    }
  } catch {
    // If localStorage is not available, just skip debug wiring
  }
}

const theme = useThemeStore();
theme.init();

const language = useLanguageStore();
language.init();

// Initialize auth store - try to fetch user profile (cookies will be sent automatically)
const auth = useAuthStore();
// Initialize auth and chat in the background
auth.initialize().then(() => {
  // If user is authenticated, initialize chat
  if (auth.isAuthed) {
    const chat = useChatStore();
    chat
      .loadConversations()
      .catch(() => {
        // Ignore chat loading errors
      })
      .finally(() => chat.connectWebSocket());
  }
});

app.mount("#app");
