import { defineStore } from "pinia";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationsService";

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [],
    loading: false,
    error: null,
    unreadCount: 0,
    page: 1,
    hasMore: false,
    initialized: false,
  }),

  actions: {
    async load({ refresh = false } = {}) {
      if (this.loading) return;
      if (this.initialized && !refresh) return;

      this.loading = true;
      this.error = null;

      try {
        const result = await fetchNotifications({
          page: 1,
          pageSize: 20,
        });
        this.items = result.notifications || [];
        this.hasMore = result.hasMore !== false;
        this.page = 1;
        this.unreadCount = result.unreadCount || this.items.filter((n) => !n.read).length;
        this.initialized = true;
      } catch (e) {
        console.error("Failed to load notifications:", e);
        this.error = e?.message || "Failed to load notifications";
      } finally {
        this.loading = false;
      }
    },

    async loadMore() {
      if (this.loading || !this.hasMore) return;
      this.loading = true;
      this.error = null;
      try {
        const nextPage = (this.page || 1) + 1;
        const result = await fetchNotifications({
          page: nextPage,
          pageSize: 20,
        });
        this.items = [...this.items, ...(result.notifications || [])];
        this.hasMore = result.hasMore !== false;
        this.page = nextPage;
        this.unreadCount = this.items.filter((n) => !n.read).length;
      } catch (e) {
        console.error("Failed to load more notifications:", e);
        this.error = e?.message || "Failed to load notifications";
      } finally {
        this.loading = false;
      }
    },

    async markAsRead(id) {
      const n = this.items.find((n) => n.id === id);
      if (!n || n.read) return;

      // Optimistic update
      n.read = true;
      this.unreadCount = Math.max(
        0,
        this.items.filter((i) => !i.read).length
      );

      try {
        await markNotificationRead(id);
      } catch (e) {
        console.error("Failed to mark notification as read:", e);
        // Revert on error
        n.read = false;
        this.unreadCount = this.items.filter((i) => !i.read).length;
      }
    },

    async markAllAsRead() {
      const unreadItems = this.items.filter((n) => !n.read);
      if (unreadItems.length === 0) return;

      // Optimistic update
      this.items.forEach((n) => {
        n.read = true;
      });
      this.unreadCount = 0;

      try {
        await markAllNotificationsRead();
      } catch (e) {
        console.error("Failed to mark all notifications as read:", e);
        // Revert on error
        unreadItems.forEach((n) => {
          n.read = false;
        });
        this.unreadCount = unreadItems.length;
      }
    },

    addNotification(notification) {
      // Add new notification (e.g., from WebSocket)
      this.items.unshift(notification);
      if (!notification.read) {
        this.unreadCount++;
      }
    },
  },
});

