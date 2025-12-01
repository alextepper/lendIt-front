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

// Debug helper: mirror console output into alert() for mobile debugging.
// Enabled in development or when URL contains ?debugAlerts=1
if (
  typeof window !== "undefined" &&
  (import.meta.env.DEV ||
    window.location.search.includes("debugAlerts=1"))
) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  function toMessage(args) {
    try {
      return args
        .map((a) =>
          typeof a === "string" ? a : JSON.stringify(a, null, 2)
        )
        .join(" ");
    } catch {
      return args.join(" ");
    }
  }

  console.log = (...args) => {
    originalLog(...args);
    alert("[log] " + toMessage(args));
  };
  console.warn = (...args) => {
    originalWarn(...args);
    alert("[warn] " + toMessage(args));
  };
  console.error = (...args) => {
    originalError(...args);
    alert("[error] " + toMessage(args));
  };
  console.info = (...args) => {
    originalInfo(...args);
    alert("[info] " + toMessage(args));
  };
}

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(i18n);

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
