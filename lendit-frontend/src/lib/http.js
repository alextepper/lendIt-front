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

    // Wait for auth initialization to complete before processing errors
    // This prevents race conditions on page refresh
    if (!auth.initialized && auth.status === "initializing") {
      // Wait a bit for initialization to complete
      await new Promise((resolve) => {
        const checkInit = setInterval(() => {
          if (auth.initialized) {
            clearInterval(checkInit);
            resolve();
          }
        }, 50);
        // Timeout after 3 seconds
        setTimeout(() => {
          clearInterval(checkInit);
          resolve();
        }, 3000);
      });
    }

    // Prevent infinite loops by checking retry count
    const retryCount = original._retryCount || 0;
    if (retryCount >= 2) {
      console.warn("Max retry attempts reached, stopping retry loop");
      return Promise.reject(error);
    }

    // If 401 and not retried yet, try to refresh
    // Skip refresh for login/register, refresh endpoint, logout endpoint, and /me endpoint
    const isLoginOrRegister =
      original.url?.includes("/auth/login") ||
      original.url?.includes("/auth/register");
    const isRefreshEndpoint = original.url?.includes("/auth/refresh");
    const isLogoutEndpoint = original.url?.includes("/auth/logout");
    const isMeEndpoint = original.url?.includes("/auth/me");

    // Special handling for refresh endpoint - if it fails, logout immediately
    if (error?.response?.status === 401 && isRefreshEndpoint) {
      console.warn("Refresh token endpoint returned 401 - logging out user");
      auth.logout();
      return Promise.reject(error);
    }

    // Skip interceptor logic for logout endpoint and /me endpoint to prevent loops
    if (isLogoutEndpoint) {
      return Promise.reject(error);
    }

    // Special handling for /me endpoint - don't redirect to login, just fail silently
    if (error?.response?.status === 401 && isMeEndpoint) {
      console.log("/auth/me returned 401 - user not authenticated");
      return Promise.reject(error);
    }

    // Allow refresh even if auth.user is currently null (e.g. initial load),
    // as long as we haven't marked the refresh token invalid yet and not already refreshing
    const shouldTryRefresh =
      !isLoginOrRegister &&
      !isRefreshEndpoint &&
      !isLogoutEndpoint &&
      !isMeEndpoint &&
      auth.refreshTokenValid &&
      !auth.isRefreshing &&
      !auth.isLoggingOut;

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
      } catch (refreshError) {
        console.warn("Token refresh failed:", refreshError);
        // Always logout when refresh fails - this means the refresh token is invalid
        auth.logout();
        return Promise.reject(error);
      }
    }

    // If unauthorised after retry attempts, kick to login with redirect
    // But only if we've already tried to refresh or shouldn't refresh
    if (error?.response?.status === 401) {
      // Only redirect if:
      // 1. We've already retried (retryCount > 0), OR
      // 2. We shouldn't try to refresh (e.g., login/register endpoints)
      const shouldRedirect = retryCount > 0 || !shouldTryRefresh;

      if (shouldRedirect) {
        const currentRoute = router.currentRoute.value;
        if (!currentRoute.path.includes("/login")) {
          const to = currentRoute.fullPath;
          router.replace({ name: "login", query: { redirect: to } });
        }
      }
    }

    return Promise.reject(error);
  }
);

export default http;
