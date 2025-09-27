import { defineStore } from "pinia";
import http from "../lib/http";
import router from "../router";

const TOKEN_KEY = "token";
const REFRESH_KEY = "refresh_token";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    token: localStorage.getItem(TOKEN_KEY) || null,
    refreshToken: localStorage.getItem(REFRESH_KEY) || null,
    status: "idle", // 'idle' | 'loading' | 'error'
    error: null,
  }),
  getters: {
    isAuthed: (s) => !!s.token,
  },
  actions: {
    async register(payload) {
      this.status = "loading";
      this.error = null;
      try {
        // Adjust endpoint/fields to your backend
        const { data } = await http.post("/auth/register", payload);
        await this._afterAuth(data);
        return true;
      } catch (e) {
        this.status = "error";
        this.error = extractErr(e);
        throw e;
      } finally {
        this.status = "idle";
      }
    },
    async login(payload) {
      this.status = "loading";
      this.error = null;
      try {
        const { data } = await http.post("/auth/login", payload);
        await this._afterAuth(data);
        return true;
      } catch (e) {
        this.status = "error";
        this.error = extractErr(e);
        throw e;
      } finally {
        this.status = "idle";
      }
    },
    async _afterAuth(data) {
      // Expected data: { access_token, refresh_token?, user }
      this.token = data.access_token || data.token;
      this.refreshToken = data.refresh_token || null;
      this.user = data.user || null;

      localStorage.setItem(TOKEN_KEY, this.token);
      if (this.refreshToken)
        localStorage.setItem(REFRESH_KEY, this.refreshToken);

      // Optionally fetch /me if backend does not return user
      if (!this.user) await this.fetchMe();

      // Go home or intended route
      if (router.currentRoute.value.query.redirect) {
        router.replace(String(router.currentRoute.value.query.redirect));
      } else {
        router.replace({ name: "home" });
      }
    },
    async fetchMe() {
      if (!this.token) return;
      try {
        const { data } = await http.get("/auth/me");
        this.user = data;
      } catch (e) {
        // Ignore; will be handled by interceptor if unauthorised
      }
    },
    async refresh() {
      if (!this.refreshToken) throw new Error("No refresh token");
      const { data } = await http.post("/auth/refresh", {
        refresh_token: this.refreshToken,
      });
      this.token = data.access_token || data.token;
      localStorage.setItem(TOKEN_KEY, this.token);
      return this.token;
    },
    logout() {
      this.user = null;
      this.token = null;
      this.refreshToken = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      router.replace({ name: "login" });
    },
  },
});

function extractErr(e) {
  return e?.response?.data?.message || e?.message || "Unknown error";
}
