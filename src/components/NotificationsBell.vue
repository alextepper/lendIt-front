<template>
  <div class="notifications-wrapper" v-if="auth.isAuthed">
    <button
      type="button"
      class="btn btn-outline-secondary btn-sm navbar-control-btn position-relative"
      @click="toggleOpen"
      :disabled="loading"
    >
      <i class="bi bi-bell"></i>
      <span
        v-if="unreadCount > 0"
        class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <div v-if="open" class="notifications-dropdown shadow-sm">
      <div class="dropdown-header d-flex justify-content-between align-items-center px-3 py-2">
        <span class="fw-semibold">Notifications</span>
        <small class="text-muted">{{ unreadCount }} unread</small>
      </div>

      <div class="dropdown-body">
        <div v-if="loading" class="text-center py-3 small text-muted">
          <span class="spinner-border spinner-border-sm me-1" role="status"></span>
          Loading...
        </div>

        <div v-else-if="items.length === 0" class="text-center py-3 small text-muted">
          No notifications yet.
        </div>

        <ul v-else class="list-unstyled mb-0">
          <li
            v-for="n in items.slice(0, 6)"
            :key="n.id"
            class="notification-item px-3 py-2"
            :class="{ 'notification-unread': !n.read }"
            @click="handleClick(n)"
          >
            <div class="d-flex justify-content-between">
              <div class="me-2 flex-grow-1">
                <div class="fw-semibold small">{{ formatTitle(n) }}</div>
                <div class="text-muted small">{{ formatMessage(n) }}</div>
              </div>
              <small class="text-muted ms-2 align-self-start">
                {{ formatTime(n.createdAt) }}
              </small>
            </div>
          </li>
        </ul>
      </div>

      <div class="dropdown-footer px-3 py-2 d-flex justify-content-between align-items-center">
        <router-link to="/notifications" class="small text-decoration-none" @click="open = false">
          View all
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNotificationsStore } from '../stores/notifications';

const auth = useAuthStore();
const notifications = useNotificationsStore();
const router = useRouter();

const open = ref(false);

const loading = computed(() => notifications.loading);
const items = computed(() => notifications.items);
const unreadCount = computed(() => notifications.unreadCount);

onMounted(async () => {
  if (auth.isAuthed) {
    notifications.load();
  }
});

function toggleOpen() {
  open.value = !open.value;
  if (open.value && !notifications.initialized) {
    notifications.load();
  }
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
  if (open.value && !event.target.closest('.notifications-wrapper')) {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function formatTitle(n) {
  switch (n.type) {
    case 'NEW_BOOKING_REQUEST':
      return 'New booking request';
    case 'BOOKING_APPROVED':
    case 'BOOKING_AWAITING_PAYMENT':
      return 'Booking approved - Payment required';
    case 'BOOKING_REJECTED':
    case 'BOOKING_DECLINED':
      return 'Booking declined';
    case 'BOOKING_CONFIRMED':
      return 'Booking confirmed';
    case 'BOOKING_EXPIRED':
      return 'Booking expired';
    case 'REVIEW_REQUEST':
      return 'Rate your experience';
    default:
      return 'Notification';
  }
}

function formatMessage(n) {
  const payload = n.payload || {};
  const itemName = payload.itemTitle || payload.itemName || '';
  const dates = payload.dates || payload.dateRange || '';
  const renterName = payload.renterName || '';
  
  if (n.type === 'NEW_BOOKING_REQUEST' && renterName) {
    return `${renterName} wants to rent ${itemName || 'your item'}`;
  }
  if ((n.type === 'BOOKING_APPROVED' || n.type === 'BOOKING_AWAITING_PAYMENT') && itemName) {
    return `${itemName} • ${dates || 'Proceed to payment'}`;
  }
  if (itemName && dates) return `${itemName} • ${dates}`;
  if (itemName) return itemName;
  if (dates) return dates;
  return n.message || '';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTargetRoute(n) {
  const payload = n.payload || {};
  if (payload.bookingRequestId) {
    return { name: 'my-bookings' };
  }
  if (payload.bookingId) {
    return { name: 'booking-checkout', params: { bookingId: payload.bookingId } };
  }
  if (payload.itemId) {
    return { name: 'item', params: { id: payload.itemId } };
  }
  if (n.type === 'REVIEW_REQUEST') {
    return { name: 'my-bookings' };
  }
  if (n.type === 'NEW_BOOKING_REQUEST') {
    return { name: 'dashboard', query: { tab: 'booking-requests' } };
  }
  return null;
}

async function handleClick(n) {
  if (!n.read) {
    notifications.markAsRead(n.id); // optimistic
  }
  const target = getTargetRoute(n);
  if (target) {
    open.value = false;
    router.push(target);
  }
}
</script>

<style scoped>
.notifications-wrapper {
  position: relative;
}

.notifications-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  max-width: calc(100vw - 2rem);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  z-index: 1050;
  max-height: 500px;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.02);
}

.dropdown-body {
  overflow-y: auto;
  max-height: 400px;
}

.notification-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.notification-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.notification-item.notification-unread {
  background-color: rgba(13, 110, 253, 0.05);
  border-left: 3px solid #0d6efd;
}

.dropdown-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.02);
}

@media (max-width: 576px) {
  .notifications-dropdown {
    width: calc(100vw - 1rem);
    right: -0.5rem;
  }
}
</style>

