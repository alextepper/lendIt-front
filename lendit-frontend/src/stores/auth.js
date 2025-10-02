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
        // Try to refresh token first, then fetch user
        try {
          await this.refresh();
          console.log("Token refreshed during initialization");
        } catch (refreshError) {
          // If refresh fails, it's ok - user might not be logged in
          console.log("No valid refresh token during initialization");
        }

        // Now try to fetch user (should work if refresh succeeded)
        try {
          await this.fetchMe();
        } catch (fetchError) {
          // User is not authenticated
          console.log("User not authenticated:", fetchError.message);
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
  },
});

function extractErr(e) {
  return e?.response?.data?.message || e?.message || "Unknown error";
}
