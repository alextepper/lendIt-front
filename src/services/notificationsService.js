import http from "../lib/http";

const USE_MOCK = false;

/**
 * Fetch notifications for the current user
 * @param {Object} params - { page, pageSize, unreadOnly }
 */
export async function fetchNotifications(params = {}) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      notifications: [],
      total: 0,
      unreadCount: 0,
      hasMore: false,
    };
  }

  try {
    const { data } = await http.get("/me/notifications", { params });
    // Backend may return { notifications: [...]} or a plain array
    if (Array.isArray(data)) {
      return {
        notifications: data,
        total: data.length,
        unreadCount: data.filter((n) => !n.read).length,
        hasMore: false,
      };
    }
    return {
      notifications: data.notifications || data.items || [],
      total: data.total || 0,
      unreadCount: data.unreadCount || 0,
      hasMore: data.hasMore !== false,
    };
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to fetch notifications"
    );
  }
}

/**
 * Mark a single notification as read
 * @param {string} notificationId - Notification ID
 */
export async function markNotificationRead(notificationId) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { id: notificationId, read: true };
  }

  try {
    const { data } = await http.post(`/notifications/${notificationId}/read`);
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to mark notification as read"
    );
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { success: true };
  }

  try {
    const { data } = await http.post("/notifications/read-all");
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to mark all notifications as read"
    );
  }
}

