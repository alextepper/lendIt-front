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
        // If backend returns tokens, store them for environments (like mobile / cross-site)
        // where cookies may not be sent reliably. Backend still also sets httpOnly cookies.
        if (data?.accessToken || data?.access_token) {
          localStorage.setItem(
            "access_token",
            data.accessToken || data.access_token
          );
        }
        if (data?.refreshToken || data?.refresh_token) {
          localStorage.setItem(
            "refresh_token",
            data.refreshToken || data.refresh_token
          );
        }

        // Reset refresh token validity on successful login
        this.refreshTokenValid = true;

        // Always call /auth/me after login to ensure auth.user is populated
        // and all components (like the navbar) react immediately.
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

        // Support multiple backend response shapes:
        // - { id, email, ... }
        // - { user: { ... } }
        // - { data: { user: { ... } } }
        const user = data?.user || data?.data?.user || data?.data || data;

        if (!user || !user.id) {
          console.warn("Unexpected /auth/me response shape:", data);
        }

        this.user = user;
        this.status = "idle";
        return user;
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
          // If we're on the OAuth callback route, let the callback page handle tokens
          // to avoid calling /auth/refresh before tokens are stored in localStorage.
          const currentRoute = router.currentRoute.value;
          if (currentRoute?.name === "oauth-callback") {
            console.log(
              "Initialization: on oauth-callback route, skipping automatic refresh"
            );
            return;
          }

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
      // Don't attempt refresh if already refreshing
      if (this.isRefreshing) {
        console.warn(
          "Refresh already in progress, waiting for existing refresh..."
        );
        // Wait for the existing refresh to complete
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (!this.isRefreshing) {
              clearInterval(checkInterval);
              // If refresh succeeded, user should be set
              if (this.user) {
                resolve({ user: this.user });
              } else {
                reject(new Error("Previous refresh failed"));
              }
            }
          }, 100);
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error("Refresh timeout"));
          }, 5000);
        });
      }

      this.isRefreshing = true;
      try {
        // FIRST: try refresh using cookies only (no body / headers)
        try {
          const { data } = await http.post("/auth/refresh");
          console.log("Token refreshed successfully using cookies only", data);

          // Update tokens in localStorage if backend returns them
          if (data.accessToken || data.access_token) {
            localStorage.setItem(
              "access_token",
              data.accessToken || data.access_token
            );
          }
          if (data.refreshToken || data.refresh_token) {
            localStorage.setItem(
              "refresh_token",
              data.refreshToken || data.refresh_token
            );
          }

          if (data.user) {
            this.user = data.user;
            this.status = "idle";
          }

          this.refreshTokenValid = true;

          const currentRoute = router.currentRoute.value;
          if (
            currentRoute.name === "login" ||
            currentRoute.path.includes("/login")
          ) {
            router.replace({ name: "home" });
          }

          return data;
        } catch (cookieError) {
          // If cookies-based refresh fails with 401/403, we'll try token-based below
          if (
            cookieError?.response?.status !== 401 &&
            cookieError?.response?.status !== 403
          ) {
            // Non-auth error – rethrow
            throw cookieError;
          }
          console.warn(
            "Cookie-based refresh failed, trying token-based refresh if available"
          );
        }

        // SECOND: fallback to token-based refresh from localStorage
        const config = {};
        const refreshPayload = {};

        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          refreshPayload.refreshToken = refreshToken;
          refreshPayload.refresh_token = refreshToken;

          config.headers = {
            Authorization: `Bearer ${refreshToken}`,
          };

          console.log(
            "Sending refresh token in body and Authorization header as fallback"
          );
        } else {
          // No token to fallback to – let this fail and be handled below
          console.warn(
            "No refresh token in localStorage for token-based refresh"
          );
        }

        const { data } = await http.post(
          "/auth/refresh",
          refreshPayload,
          config
        );
        // Cookies are set automatically by backend (if same-domain)
        // For cross-domain scenarios, backend may return tokens in response
        console.log("Token refreshed successfully", data);

        // Update tokens in localStorage if backend returns them (for cross-domain scenarios)
        if (data.accessToken || data.access_token) {
          localStorage.setItem(
            "access_token",
            data.accessToken || data.access_token
          );
        }
        if (data.refreshToken || data.refresh_token) {
          localStorage.setItem(
            "refresh_token",
            data.refreshToken || data.refresh_token
          );
        }

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
        // If refresh fails with 401/403, mark token as invalid
        // But don't logout here - let the HTTP interceptor handle it
        if (
          error?.response?.status === 401 ||
          error?.response?.status === 403
        ) {
          console.warn(
            "Token refresh failed with 401/403 - refresh token is invalid:",
            error.response?.data?.message || error.message
          );
          this.refreshTokenValid = false;
        } else {
          // For other errors (network, etc.), don't mark as invalid
          // The token might still be valid, just couldn't refresh due to network issues
          console.warn(
            "Token refresh failed (non-auth error):",
            error.response?.data?.message || error.message
          );
        }
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
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

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
      const isDev =
        import.meta.env.DEV ||
        import.meta.env.MODE === "development" ||
        (typeof window !== "undefined" &&
          window.location.hostname === "localhost" &&
          window.location.port === "5173");

      // In development, always use localhost:4000 unless explicitly overridden with absolute URL
      if (isDev) {
        // Priority 1: Check for explicit absolute URL in env var (overrides dev default)
        if (import.meta.env.VITE_API_BASE_URL) {
          const envURL = import.meta.env.VITE_API_BASE_URL;
          if (envURL.startsWith("http://") || envURL.startsWith("https://")) {
            backendBaseURL = envURL;
          }
        }
        // Priority 2: Development default - always use backend directly
        if (!backendBaseURL) {
          backendBaseURL = "http://localhost:4000";
        }
      } else {
        // Production mode
        // Priority 1: Runtime config (set by nginx in production)
        if (typeof window !== "undefined" && window.__API_BASE_URL__) {
          const runtimeURL = window.__API_BASE_URL__;
          // If it's an absolute URL, use it directly
          if (
            runtimeURL.startsWith("http://") ||
            runtimeURL.startsWith("https://")
          ) {
            backendBaseURL = runtimeURL;
          }
        }

        // Priority 2: Environment variable (absolute URL)
        if (!backendBaseURL && import.meta.env.VITE_API_BASE_URL) {
          const envURL = import.meta.env.VITE_API_BASE_URL;
          // If it's an absolute URL, use it directly
          if (envURL.startsWith("http://") || envURL.startsWith("https://")) {
            backendBaseURL = envURL;
          }
        }

        // Priority 3: Production fallback - use current origin with /api
        if (!backendBaseURL) {
          backendBaseURL = `${window.location.origin}/api`;
        }
      }

      // Build the Google OAuth URL - backendBaseURL should always be absolute at this point
      const oauthUrl = `${backendBaseURL}auth/google`;

      // Build URL object for query params
      const url = new URL(oauthUrl);

      // Add return URL if provided
      if (returnUrl) {
        url.searchParams.set("return_url", returnUrl);
      } else if (router.currentRoute.value.query.redirect) {
        // Use redirect query param if available
        url.searchParams.set(
          "return_url",
          String(router.currentRoute.value.query.redirect)
        );
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
          localStorage.setItem("access_token", accessToken);
        }
        if (refreshToken) {
          localStorage.setItem("refresh_token", refreshToken);
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
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        throw e;
      }
    },
  },
});

function extractErr(e) {
  return e?.response?.data?.message || e?.message || "Unknown error";
}
