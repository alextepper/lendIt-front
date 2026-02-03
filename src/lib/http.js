import axios from "axios";
import router from "../router";
import { useAuthStore } from "../stores/auth";

// API base URL configuration
//
// In production the SPA is served from https://www.sharo-app.com and the backend
// is exposed on the *same origin* under /api via a reverse proxy.
//
// We therefore use a relative base URL so all requests go to:
//   https://www.sharo-app.com/api/...
//
// In development we optionally allow an absolute VITE_API_BASE_URL
// (e.g. http://localhost:3000/api). If not provided, we also use "/api" and rely
// on the Vite dev server proxy to forward /api to the backend.
let apiBaseURL = "/api";

if (import.meta.env.DEV && import.meta.env.VITE_API_BASE_URL) {
  apiBaseURL = import.meta.env.VITE_API_BASE_URL;
}

const http = axios.create({
  baseURL: apiBaseURL,
  // We rely on HttpOnly cookies for auth; this ensures cookies are sent with
  // all API calls to the same-origin /api endpoints.
  withCredentials: true,
  timeout: 5000, // 5 second timeout to prevent hanging requests
});

// Handle 401s with one-shot refresh logic and redirect to login when needed.
// We do not deal with tokens directly here – everything comes from HttpOnly cookies.
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

    // Allow refresh if:
    // 1. Not a login/register/refresh/logout/me endpoint
    // 2. Not already refreshing
    // 3. Not currently logging out
    const shouldTryRefresh =
      !isLoginOrRegister &&
      !isRefreshEndpoint &&
      !isLogoutEndpoint &&
      !isMeEndpoint &&
      !auth.isRefreshing &&
      !auth.isLoggingOut;

    if (
      error?.response?.status === 401 &&
      retryCount === 0 &&
      shouldTryRefresh
    ) {
      try {
        console.log("Attempting to refresh session due to 401 error...");
        if (!refreshing) {
          refreshing = auth.refresh().finally(() => {
            refreshing = null;
          });
        }
        await refreshing;

        console.log("Session refreshed successfully, retrying original request");

        original._retryCount = retryCount + 1;
        // Retry the original request – cookies now contain the refreshed session.
        return http(original);
      } catch (refreshError) {
        console.warn("Session refresh failed:", refreshError);
        // If refresh fails with auth errors, clear local auth state and redirect to login.
        if (
          refreshError?.response?.status === 401 ||
          refreshError?.response?.status === 403
        ) {
          console.warn(
            "Refresh failed with 401/403, clearing auth state and redirecting to login"
          );
          auth.logout();
        }
        return Promise.reject(error);
      }
    }

    // If a refresh is already in progress, wait for it before deciding to redirect.
    if (error?.response?.status === 401 && retryCount === 0 && refreshing) {
      try {
        await refreshing;
        original._retryCount = retryCount + 1;
        return http(original);
      } catch (refreshError) {
        console.warn("Session refresh failed while waiting:", refreshError);
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
        if (!currentRoute.path.includes("/login") && !currentRoute.query.modal) {
          const to = currentRoute.fullPath;
          router.replace({ path: currentRoute.path, query: { ...currentRoute.query, modal: 'login', redirect: to } });
        }
      }
    }

    return Promise.reject(error);
  }
);

export default http;
