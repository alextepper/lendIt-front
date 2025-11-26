import { defineStore } from "pinia";
import http from "../lib/http";
import router from "../router";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    status: "idle", // 'idle' | 'loading' | 'error' | 'initializing'
    error: null,
    initialized: false, // Track if we've attempted to fetch user on app start
    refreshTokenValid: true, // Track if refresh token is still valid
    isRefreshing: false, // Track if refresh is currently in progress
    isLoggingOut: false, // Track if logout is currently in progress
  }),
  getters: {
    isAuthed: (s) => !!s.user,
  },
  actions: {
    async register(payload) {
      this.status = "loading";
      this.error = null;
      try {
        // Backend expects: { email, password, username }
        const { data } = await http.post("/auth/register", {
          email: payload.email,
          password: payload.password,
          username: payload.name, // Map name to username
        });
        // After registration, automatically log in
        await this.login({ email: payload.email, password: payload.password });
        this.status = "idle";
        return true;
      } catch (e) {
        this.status = "error";
        this.error = extractErr(e);
        throw e;
      }
    },
    async login(payload) {
      this.status = "loading";
      this.error = null;
      try {
        // Backend expects: { email, password }
        const { data } = await http.post("/auth/login", {
          email: payload.email,
          password: payload.password,
        });
        // Reset refresh token validity on successful login
        this.refreshTokenValid = true;
        // Backend sets httpOnly cookies, so we just fetch user profile
        await this.fetchMe();
        this.status = "idle";

        // Go home or intended route
        if (router.currentRoute.value.query.redirect) {
          router.replace(String(router.currentRoute.value.query.redirect));
        } else {
          router.replace({ name: "home" });
        }
        return true;
      } catch (e) {
        this.status = "error";
        this.error = extractErr(e);
        throw e;
      }
    },
    async fetchMe() {
      this.status = "loading";
      try {
        const { data } = await http.get("/auth/me");
        this.user = data;
        this.status = "idle";
        return data;
      } catch (e) {
        console.warn("Failed to fetch user:", e);
        this.user = null;
        this.status = "error";
        throw e;
      }
    },
    async initialize() {
      if (this.initialized) return;
      this.status = "initializing";
      try {
        // First, try to fetch user with existing cookies (if any)
        // This avoids unnecessary refresh requests when user already has valid session
        try {
          await this.fetchMe();
          console.log("User authenticated with existing session");
          return; // Success! User is authenticated, no need to refresh
        } catch (fetchError) {
          // If /auth/me fails with 401, try to refresh token
          if (fetchError?.response?.status === 401 && this.refreshTokenValid) {
            try {
              await this.refresh();
              console.log("Token refreshed during initialization");
              // After refresh, try to fetch user again
              try {
                await this.fetchMe();
                console.log("User authenticated after refresh");
              } catch (secondFetchError) {
                // Still failed after refresh - user is not authenticated
                console.log(
                  "User not authenticated after refresh:",
                  secondFetchError.message
                );
              }
            } catch (refreshError) {
              // Refresh failed - user is not logged in
              console.log("No valid refresh token during initialization");
            }
          } else {
            // Not a 401 or refresh token is invalid - user is not authenticated
            console.log("User not authenticated:", fetchError.message);
          }
        }
      } catch (e) {
        console.log("Initialization error:", e.message);
        this.status = "idle";
      } finally {
        this.initialized = true;
        this.status = "idle";
      }
    },
    async refresh() {
      // Don't attempt refresh if we know the token is invalid or already refreshing
      if (!this.refreshTokenValid || this.isRefreshing) {
        console.warn(
          "Refresh token is invalid or refresh already in progress, skipping refresh attempt"
        );
        throw new Error("Refresh token invalid or already refreshing");
      }

      this.isRefreshing = true;
      try {
        // Backend handles refresh via httpOnly cookies
        const { data } = await http.post("/auth/refresh");
        // Cookies are set automatically by backend
        console.log("Token refreshed successfully", data);

        // Update user data from the refresh response
        if (data.user) {
          this.user = data.user;
          this.status = "idle";
        }

        this.refreshTokenValid = true; // Reset flag on successful refresh

        // Redirect to home page on successful refresh only if user is on login page
        const currentRoute = router.currentRoute.value;
        if (
          currentRoute.name === "login" ||
          currentRoute.path.includes("/login")
        ) {
          router.replace({ name: "home" });
        }

        return data;
      } catch (error) {
        // If refresh fails, mark token as invalid immediately
        console.warn(
          "Token refresh failed:",
          error.response?.data?.message || error.message
        );
        this.refreshTokenValid = false;
        this.user = null;
        this.status = "error";
        // Don't call this.logout() here to avoid infinite loops
        // The HTTP interceptor will handle the logout
        throw error;
      } finally {
        this.isRefreshing = false;
      }
    },
    async logout() {
      // Prevent multiple logout attempts
      if (this.isLoggingOut) {
        return;
      }

      this.isLoggingOut = true;

      // Clear local state immediately to prevent any further requests
      this.user = null;
      this.status = "idle";
      this.error = null;
      this.refreshTokenValid = false; // Mark as invalid to prevent refresh attempts
      this.isRefreshing = false; // Reset refresh state

      // Clear localStorage tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      try {
        // Tell backend to clear cookies (but don't wait for it)
        http.post("/auth/logout").catch(() => {
          // Ignore logout request failures - we've already cleared local state
        });
      } catch (error) {
        // Ignore any errors - we've already cleared local state
      }

      // Navigate to home page
      router.replace({ name: "home" });

      // Reset logout flag after a short delay
      setTimeout(() => {
        this.isLoggingOut = false;
      }, 1000);
    },
    // Google OAuth sign in - redirects to backend
    signInWithGoogle(returnUrl = null) {
      // Get backend base URL - for OAuth we need the actual backend URL, not the proxy path
      let backendBaseURL;
      
      // Check if we're in development mode first
      const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || (typeof window !== "undefined" && window.location.hostname === 'localhost' && window.location.port === '5173');
      
      // In development, always use localhost:4000 unless explicitly overridden with absolute URL
      if (isDev) {
        // Priority 1: Check for explicit absolute URL in env var (overrides dev default)
        if (import.meta.env.VITE_API_BASE_URL) {
          const envURL = import.meta.env.VITE_API_BASE_URL;
          if (envURL.startsWith('http://') || envURL.startsWith('https://')) {
            backendBaseURL = envURL;
          }
        }
        // Priority 2: Development default - always use backend directly
        if (!backendBaseURL) {
          backendBaseURL = 'http://localhost:4000';
        }
      } else {
        // Production mode
        // Priority 1: Runtime config (set by nginx in production)
        if (typeof window !== "undefined" && window.__API_BASE_URL__) {
          const runtimeURL = window.__API_BASE_URL__;
          // If it's an absolute URL, use it directly
          if (runtimeURL.startsWith('http://') || runtimeURL.startsWith('https://')) {
            backendBaseURL = runtimeURL;
          }
        }
        
        // Priority 2: Environment variable (absolute URL)
        if (!backendBaseURL && import.meta.env.VITE_API_BASE_URL) {
          const envURL = import.meta.env.VITE_API_BASE_URL;
          // If it's an absolute URL, use it directly
          if (envURL.startsWith('http://') || envURL.startsWith('https://')) {
            backendBaseURL = envURL;
          }
        }
        
        // Priority 3: Production fallback - use current origin with /api
        if (!backendBaseURL) {
          backendBaseURL = `${window.location.origin}/api`;
        }
      }
      
      // Build the Google OAuth URL - backendBaseURL should always be absolute at this point
      const oauthUrl = `${backendBaseURL}/auth/google`;
      
      // Build URL object for query params
      const url = new URL(oauthUrl);
      
      // Add return URL if provided
      if (returnUrl) {
        url.searchParams.set('return_url', returnUrl);
      } else if (router.currentRoute.value.query.redirect) {
        // Use redirect query param if available
        url.searchParams.set('return_url', String(router.currentRoute.value.query.redirect));
      }
      
      // Redirect to backend Google OAuth endpoint
      window.location.href = url.toString();
    },
    // Handle OAuth callback - called from OAuthCallback component
    async handleOAuthCallback(accessToken, refreshToken) {
      this.status = "loading";
      this.error = null;
      
      try {
        // Store tokens in localStorage as fallback (backend also sets cookies)
        if (accessToken) {
          localStorage.setItem('access_token', accessToken);
        }
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }

        // Fetch user data
        await this.fetchMe();
        
        // Reset refresh token validity on successful OAuth
        this.refreshTokenValid = true;
        this.status = "idle";
        
        return true;
      } catch (e) {
        this.status = "error";
        this.error = extractErr(e);
        
        // Clear tokens on error
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        
        throw e;
      }
    },
  },
});

function extractErr(e) {
  return e?.response?.data?.message || e?.message || "Unknown error";
}
