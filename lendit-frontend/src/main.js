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
// Add a small delay to ensure the app is fully initialized
setTimeout(() => {
  auth
    .fetchMe()
    .then(() => {
      // If user is authenticated, initialize chat
      const chat = useChatStore();
      chat
        .loadConversations()
        .catch(() => {
          // Ignore chat loading errors
        })
        .finally(() => chat.connectSocket());
    })
    .catch((error) => {
      // Ignore errors - user is just not logged in or backend is not available
      console.log(
        "User not authenticated or backend not available:",
        error.message
      );
    });
}, 100); // 100ms delay

app.mount("#app");
