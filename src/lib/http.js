import axios from "axios";
import router from "../router";
import { useAuthStore } from "../stores/auth";

// Get API base URL from runtime config (set by nginx) or fallback to build-time env var
// window.__API_BASE_URL__ is set by /config.js at runtime
const apiBaseURL =
  (typeof window !== "undefined" && window.__API_BASE_URL__) ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "" : "/api"); // Dev fallback to Vite proxy

const http = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true, // Important for cookie-based auth
  timeout: 5000, // 5 second timeout to prevent hanging requests
});

// Request interceptor: Add access token from localStorage to Authorization header
// This is a fallback for mobile browsers where cross-domain cookies aren't sent
http.interceptors.request.use(
  (config) => {
    // Get access token from localStorage as fallback for cross-domain scenarios
    // Backend will check cookies first, then Authorization header
    const accessToken = localStorage.getItem("access_token");
    
    if (accessToken && !config.headers.Authorization) {
      // Only add if not already set (to avoid overriding explicit headers)
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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

    // Allow refresh if:
    // 1. Not a login/register/refresh/logout/me endpoint
    // 2. Not already refreshing
    // 3. Not currently logging out
    // Note: We intentionally do NOT require a refresh token in localStorage because
    // the backend can also rely purely on httpOnly cookies. If refresh cannot be
    // performed, the /auth/refresh call will simply fail and we'll handle it below.
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
        console.log("Attempting to refresh token due to 401 error...");
        if (!refreshing) {
          refreshing = auth.refresh().finally(() => {
            refreshing = null;
          });
        }
        await refreshing;
        
        console.log("Token refreshed successfully, retrying original request");
        
        // Update the Authorization header with the new access token
        const newAccessToken = localStorage.getItem("access_token");
        if (newAccessToken) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        
        original._retryCount = retryCount + 1;
        // Retry the original request with the new token
        return http(original);
      } catch (refreshError) {
        console.warn("Token refresh failed:", refreshError);
        // Only logout when refresh actually fails - this means the refresh token is invalid
        // Don't logout if we just couldn't refresh for other reasons (network, etc.)
        if (refreshError?.response?.status === 401 || refreshError?.response?.status === 403) {
          console.warn("Refresh token is invalid (401/403), logging out user");
          auth.logout();
        } else {
          console.warn("Refresh failed for non-auth reason, keeping user logged in:", refreshError.message);
        }
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
