import { defineStore } from "pinia";
import http from "../lib/http";
import router from "../router";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    status: "idle", // 'idle' | 'loading' | 'error'
    error: null,
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
      try {
        const { data } = await http.get("/auth/me");
        this.user = data;
        return data;
      } catch (e) {
        console.warn("Failed to fetch user:", e);
        this.user = null;
        throw e;
      }
    },
    async refresh() {
      try {
        // Backend handles refresh via httpOnly cookies
        const { data } = await http.post("/auth/refresh");
        // Cookies are set automatically by backend
        return data;
      } catch (error) {
        // If refresh fails, clear user state and logout
        console.log("Token refresh failed:", error.message);
        this.logout();
        throw error;
      }
    },
    async logout() {
      try {
        // Tell backend to clear cookies
        await http.post("/auth/logout");
      } catch (error) {
        console.warn("Logout request failed:", error);
      } finally {
        // Clear local state regardless
        this.user = null;
        this.status = "idle";
        this.error = null;
        router.replace({ name: "home" });
      }
    },
  },
});

function extractErr(e) {
  return e?.response?.data?.message || e?.message || "Unknown error";
}
