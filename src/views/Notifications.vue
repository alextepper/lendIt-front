<template>
  <div class="container py-4 notifications-page">
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h1 class="h4 mb-0">Notifications</h1>
      <div class="d-flex gap-2">
        <button
          v-if="store.unreadCount > 0"
          type="button"
          class="btn btn-outline-secondary btn-sm"
          :disabled="store.loading"
          @click="markAllRead"
        >
          Mark all as read
        </button>
        <router-link to="/dashboard" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-arrow-left me-1"></i>
          Back to dashboard
        </router-link>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div class="small text-muted">
            {{ store.unreadCount }} unread • {{ store.items.length }} loaded
          </div>
        </div>

        <div v-if="store.loading && !store.items.length" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
          <div class="small text-muted mt-2">Loading notifications...</div>
        </div>

        <div v-else-if="store.error" class="alert alert-danger mb-0">
          {{ store.error }}
        </div>

        <div v-else-if="!store.items.length" class="text-center py-5 text-muted">
          <i class="bi bi-bell-slash display-5 d-block mb-2"></i>
          <div>No notifications yet</div>
        </div>

        <div v-else class="list-group list-group-flush">
          <button
            v-for="n in store.items"
            :key="n.id"
            type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-start"
            :class="{ 'bg-light': !n.read }"
            @click="handleClick(n)"
          >
            <div class="me-3 flex-grow-1">
              <div class="fw-semibold small">{{ formatTitle(n) }}</div>
              <div class="small text-muted">{{ formatMessage(n) }}</div>
            </div>
            <div class="text-end small text-muted">
              <div>{{ formatTime(n.createdAt) }}</div>
              <div v-if="!n.read" class="badge bg-primary mt-1">New</div>
            </div>
          </button>
        </div>

        <div v-if="store.hasMore" class="text-center mt-3">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="store.loading"
            @click="store.loadMore()"
          >
            <span v-if="store.loading" class="spinner-border spinner-border-sm me-1"></span>
            Load more
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '../stores/notifications';

const store = useNotificationsStore();
const router = useRouter();

onMounted(() => {
  store.load({ refresh: true });
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
  return d.toLocaleString();
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
    store.markAsRead(n.id);
  }
  const target = getTargetRoute(n);
  if (target) {
    router.push(target);
  }
}

async function markAllRead() {
  await store.markAllAsRead();
}
</script>

<style scoped>
.list-group-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.list-group-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.list-group-item.bg-light {
  border-left: 3px solid #0d6efd;
}
</style>

