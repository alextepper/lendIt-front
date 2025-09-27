import { defineStore } from "pinia";

const THEME_KEY = "theme"; // 'light' | 'dark' | 'auto'

function applyTheme(mode) {
  let theme = mode;
  if (mode === "auto") {
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).matches;
    theme = prefersDark ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-bs-theme", theme);
}

export const useThemeStore = defineStore("theme", {
  state: () => ({
    mode: localStorage.getItem(THEME_KEY) || "auto",
  }),
  actions: {
    init() {
      applyTheme(this.mode);
      // react to system changes when in auto
      if (this._listener)
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .removeEventListener("change", this._listener);
      this._listener = () => {
        if (this.mode === "auto") applyTheme("auto");
      };
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", this._listener);
    },
    setMode(mode) {
      this.mode = mode;
      localStorage.setItem(THEME_KEY, mode);
      applyTheme(mode);
    },
  },
});
