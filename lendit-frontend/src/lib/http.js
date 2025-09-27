import axios from "axios";
import router from "../router";
import { useAuthStore } from "../stores/auth";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  withCredentials: true,
});

// Attach token
http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth?.token) config.headers.Authorization = `Bearer ${auth.token}`;
  return config;
});

// Handle 401 with one-shot refresh logic
let refreshing = null;
http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const auth = useAuthStore();
    const original = error.config;

    // If 401 and we have refresh and not retried yet
    if (
      error?.response?.status === 401 &&
      auth?.refreshToken &&
      !original._retry
    ) {
      try {
        if (!refreshing) {
          refreshing = auth.refresh().finally(() => {
            refreshing = null;
          });
        }
        await refreshing;
        original._retry = true;
        return http(original);
      } catch {
        auth.logout();
        return Promise.reject(error);
      }
    }

    // If unauthorised without refresh, kick to login with redirect
    if (error?.response?.status === 401 && !auth?.refreshToken) {
      const to = router.currentRoute.value.fullPath;
      if (!to.includes("/login"))
        router.replace({ name: "login", query: { redirect: to } });
    }

    return Promise.reject(error);
  }
);

export default http;
