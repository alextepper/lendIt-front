import { defineStore } from "pinia";

export const useUiStore = defineStore("ui", {
  state: () => ({
    loading: false,
    toast: null, // { variant:'success'|'danger'|'info'|'warning', message:string }
  }),
  actions: {
    setLoading(v) {
      this.loading = v;
    },
    showToast(message, variant = "info", timeout = 3000) {
      this.toast = { message, variant };
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => (this.toast = null), timeout);
    },
    clearToast() {
      this.toast = null;
    },
  },
});
