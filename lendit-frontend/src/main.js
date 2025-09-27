import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";

// Bootstrap CSS & JS
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap"; // JS for components
import "bootstrap-icons/font/bootstrap-icons.css";

import App from "./App.vue";
import { useAuthStore } from "./stores/auth";
import { useThemeStore } from "./stores/theme";
import { useChatStore } from "./stores/chat";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

const theme = useThemeStore();
theme.init();
// existing auth init:
const auth = useAuthStore();
if (auth.token) auth.fetchMe().finally(() => {});

// initialize chat store
const chat = useChatStore();
chat.loadConversations().finally(() => chat.connectSocket());

app.mount("#app");
