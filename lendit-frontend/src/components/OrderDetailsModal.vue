<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { updateOrderStatus } from '../services/orderService';

const props = defineProps({
  order: { type: Object, required: true },
});

const emit = defineEmits(['close', 'updated']);

const auth = useAuthStore();
const ui = useUiStore();
const updating = ref(false);

const isOwner = computed(() => {
  return auth.user?.id === props.order.item?.owner?.id || auth.user?.id === props.order.item?.ownerId;
});

const isRenter = computed(() => {
  return auth.user?.id === props.order.renterId || auth.user?.id === props.order.renter?.id;
});

const statusColor = computed(() => {
  const colors = {
    PENDING: 'warning',
    PAID: 'info',
    HANDED_OVER: 'primary',
    RETURNED: 'success',
    CANCELLED: 'danger',
  };
  return colors[props.order.status] || 'secondary';
});

const canHandOver = computed(() => {
  return isOwner.value && props.order.status === 'PAID';
});

const canMarkReturned = computed(() => {
  return isOwner.value && props.order.status === 'HANDED_OVER';
});

const canCancel = computed(() => {
  return (isOwner.value || isRenter.value) && 
         ['PENDING', 'PAID'].includes(props.order.status);
});

async function updateStatus(newStatus) {
  updating.value = true;
  try {
    await updateOrderStatus(props.order.id, newStatus);
    ui.showToast(`Order status updated to ${newStatus}`, 'success');
    emit('updated');
    emit('close');
  } catch (error) {
    console.error('Failed to update order status:', error);
    ui.showToast(error.response?.data?.message || 'Failed to update order status', 'danger');
  } finally {
    updating.value = false;
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  const currency = props.order.currency || 'ILS';
  const mainUnit = amount / 100;
  return `${mainUnit.toFixed(2)} ${currency}`;
}

function formatPriceForBackend(amount) {
  // Convert display price to backend format (multiply by 100)
  return Math.round(amount * 100);
}
</script>

<template>
  <div class="modal-content">
    <div class="modal-header">
      <h5 class="modal-title">
        <i class="bi bi-receipt-cutoff me-2"></i>
        Order Details
      </h5>
      <button type="button" class="btn-close" @click="emit('close')"></button>
    </div>

    <div class="modal-body">
      <!-- Order Status -->
      <div class="text-center mb-4">
        <span class="badge rounded-pill fs-6 px-4 py-2" :class="`bg-${statusColor}`">
          {{ order.status }}
        </span>
        <div class="small text-muted mt-2">
          Order #{{ order.id.slice(-8) }}
        </div>
      </div>

      <!-- Item Info -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">
            <i class="bi bi-box-seam me-2"></i>
            Item
          </h6>
          <div class="d-flex align-items-center gap-3">
            <img 
              v-if="order.item?.photos?.[0]" 
              :src="order.item.photos[0].url" 
              class="rounded"
              width="80"
              height="80"
              style="object-fit: cover;"
            />
            <div>
              <div class="fw-semibold">{{ order.item?.title }}</div>
              <div class="small text-muted">{{ order.item?.category }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rental Period -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">
            <i class="bi bi-calendar-range me-2"></i>
            Rental Period
          </h6>
          <div class="row g-2">
            <div class="col-6">
              <div class="small text-muted">Check-in</div>
              <div class="fw-semibold">{{ formatDate(order.start) }}</div>
            </div>
            <div class="col-6">
              <div class="small text-muted">Check-out</div>
              <div class="fw-semibold">{{ formatDate(order.end) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Participants -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">
            <i class="bi bi-people me-2"></i>
            Participants
          </h6>
          <div class="row g-2">
            <div class="col-6">
              <div class="small text-muted">Owner</div>
              <div class="fw-semibold">{{ order.owner?.username || 'Unknown' }}</div>
            </div>
            <div class="col-6">
              <div class="small text-muted">Renter</div>
              <div class="fw-semibold">{{ order.renter?.username || 'Unknown' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pricing -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">
            <i class="bi bi-cash-stack me-2"></i>
            Pricing
          </h6>
          <div class="d-flex justify-content-between mb-2">
            <span>Rental Total</span>
            <span class="fw-bold">{{ formatCurrency(order.priceTotal) }}</span>
          </div>
          <div v-if="order.item?.deposit" class="d-flex justify-content-between text-warning">
            <span>
              <i class="bi bi-shield-check me-1"></i>
              Security Deposit
            </span>
            <span>{{ formatCurrency(order.item.deposit) }}</span>
          </div>
          <div v-if="order.item?.deposit" class="small text-muted mt-2">
            * Deposit will be refunded after item return
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="card">
        <div class="card-body">
          <h6 class="card-title">
            <i class="bi bi-clock-history me-2"></i>
            Timeline
          </h6>
          <div class="timeline">
            <div class="timeline-item">
              <i class="bi bi-circle-fill text-success"></i>
              <div>
                <div class="fw-semibold">Order Created</div>
                <div class="small text-muted">{{ formatDate(order.createdAt) }}</div>
              </div>
            </div>
            <div v-if="order.status !== 'PENDING'" class="timeline-item">
              <i class="bi bi-circle-fill" :class="`text-${statusColor}`"></i>
              <div>
                <div class="fw-semibold">{{ order.status }}</div>
                <div class="small text-muted">{{ formatDate(order.updatedAt) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <!-- Owner Actions -->
      <template v-if="isOwner">
        <button 
          v-if="canHandOver" 
          class="btn btn-success"
          :disabled="updating"
          @click="updateStatus('HANDED_OVER')"
        >
          <i class="bi bi-hand-thumbs-up me-2"></i>
          Confirm Handover
        </button>
        <button 
          v-if="canMarkReturned" 
          class="btn btn-primary"
          :disabled="updating"
          @click="updateStatus('RETURNED')"
        >
          <i class="bi bi-check-circle me-2"></i>
          Confirm Return
        </button>
      </template>

      <!-- Cancel (Both)-->
      <button 
        v-if="canCancel" 
        class="btn btn-outline-danger"
        :disabled="updating"
        @click="updateStatus('CANCELLED')"
      >
        <i class="bi bi-x-circle me-2"></i>
        Cancel Order
      </button>

      <button class="btn btn-secondary ms-auto" @click="emit('close')">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline-item {
  display: flex;
  align-items: start;
  gap: 0.75rem;
}

.timeline-item i {
  font-size: 0.5rem;
  margin-top: 0.5rem;
}

.card-title {
  font-size: 0.9rem;
  color: var(--bs-secondary);
  margin-bottom: 1rem;
}
</style>

