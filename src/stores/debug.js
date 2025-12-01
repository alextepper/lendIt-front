import { defineStore } from "pinia";

// Simple debug log store to collect console output in the UI
export const useDebugStore = defineStore("debug", {
  state: () => ({
    logs: [], // { id, level, message, raw, timestamp }
    enabled: true,
    maxEntries: 500,
  }),
  actions: {
    addLog(level, args) {
      if (!this.enabled) return;

      const timestamp = new Date().toISOString();
      let message = "";
      try {
        message = args
          .map((a) =>
            typeof a === "string" ? a : JSON.stringify(a, null, 2)
          )
          .join(" ");
      } catch {
        message = args.join(" ");
      }

      this.logs.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        message,
        raw: args,
        timestamp,
      });

      // Trim to maxEntries
      if (this.logs.length > this.maxEntries) {
        this.logs.splice(0, this.logs.length - this.maxEntries);
      }
    },
    clear() {
      this.logs = [];
    },
  },
});


