import axios from "axios";
import router from "../router";
import { useAuthStore } from "../stores/auth";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000",
  withCredentials: true, // Important for cookie-based auth
  timeout: 5000, // 5 second timeout to prevent hanging requests
});

// Handle 401 with one-shot refresh logic
let refreshing = null;
http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const auth = useAuthStore();
    const original = error.config;

    // Prevent infinite loops by checking retry count
    const retryCount = original._retryCount || 0;
    if (retryCount >= 3) {
      console.warn("Max retry attempts reached, stopping retry loop");
      return Promise.reject(error);
    }

    // If 401 and not retried yet, try to refresh (only for non-auth endpoints)
    // Don't try to refresh if the request is to auth endpoints or if we don't have a user
    const isAuthEndpoint = original.url?.includes("/auth/");
    const shouldTryRefresh = !isAuthEndpoint && auth.user;

    if (
      error?.response?.status === 401 &&
      retryCount === 0 &&
      shouldTryRefresh
    ) {
      try {
        if (!refreshing) {
          refreshing = auth.refresh().finally(() => {
            refreshing = null;
          });
        }
        await refreshing;
        original._retryCount = retryCount + 1;
        return http(original);
      } catch {
        auth.logout();
        return Promise.reject(error);
      }
    }

    // If unauthorised after retry attempts, kick to login with redirect
    if (error?.response?.status === 401) {
      const to = router.currentRoute.value.fullPath;
      if (!to.includes("/login"))
        router.replace({ name: "login", query: { redirect: to } });
    }

    return Promise.reject(error);
  }
);

export default http;
