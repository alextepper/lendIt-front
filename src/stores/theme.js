import { defineStore } from "pinia";

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
    mode: "light",
  }),
  actions: {
    init() {
      this.mode = "light";
      applyTheme("light");
      // react to system changes when in auto
      if (this._listener)
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .removeEventListener("change", this._listener);
      this._listener = () => {
        // Theme locked to light
        applyTheme("light");
      };
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", this._listener);
    },
    setMode(mode) {
      if (mode !== "light") {
        this.mode = "light";
        applyTheme("light");
        return;
      }
      this.mode = "light";
      applyTheme("light");
    },
  },
});
