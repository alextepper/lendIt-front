<template>
  <div class="booking-details-card">
    <!-- Booking Status -->
    <div class="text-center mb-4">
      <span class="badge rounded-pill fs-6 px-4 py-2" :class="`bg-${statusColor}`">
        {{ booking.status }}
      </span>
      <div class="small text-muted mt-2">
        Booking #{{ booking.id?.slice(-8) || 'N/A' }}
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
            v-if="booking.item?.photos?.[0] || booking.item?.mainPhotoUrl || booking.item?.thumbnail" 
            :src="getImageUrl(booking.item?.photos?.[0]?.url || booking.item?.mainPhotoUrl || booking.item?.thumbnail)" 
            class="rounded"
            width="80"
            height="80"
            style="object-fit: cover;"
          />
          <div>
            <div class="fw-semibold">{{ booking.item?.title }}</div>
            <div class="small text-muted">{{ booking.item?.category || booking.item?.tags?.join(', ') || '' }}</div>
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
            <div class="fw-semibold">{{ formatDate(booking.startDate || booking.from || booking.start) }}</div>
          </div>
          <div class="col-6">
            <div class="small text-muted">Check-out</div>
            <div class="fw-semibold">{{ formatDate(booking.endDate || booking.to || booking.end) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Participants -->
    <div class="card mb-3">
      <div class="card-body">
        <h6 class="card-title">
          <i class="bi bi-people me-2"></i>
          Renter
        </h6>
        <div class="row g-2">
          <!-- <div class="col-6">
            <div class="small text-muted">Owner</div>
            <div class="fw-semibold">
              {{ booking.owner?.username || booking.owner?.displayName || booking.owner?.name || 'Unknown' }}
            </div>
          </div> -->
          <div class="col-6">
            <div class="fw-semibold">
              {{ booking.renter?.username || booking.renter?.displayName || booking.renter?.name || booking.counterparty?.username || booking.counterparty?.displayName || 'Unknown' }}
            </div>
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
          <span class="fw-bold">{{ formatCurrency(booking.totalAmount || booking.priceTotal || booking.total) }}</span>
        </div>
        <div v-if="booking.item?.deposit || booking.depositAmount" class="d-flex justify-content-between text-warning">
          <span>
            <i class="bi bi-shield-check me-1"></i>
            Security Deposit
          </span>
          <span>{{ formatCurrency(booking.depositAmount || booking.item?.deposit) }}</span>
        </div>
        <div v-if="booking.item?.deposit || booking.depositAmount" class="small text-muted mt-2">
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
              <div class="fw-semibold">Booking Created</div>
              <div class="small text-muted">{{ formatDate(booking.createdAt) }}</div>
            </div>
          </div>
          <div v-if="booking.status !== 'PENDING_OWNER' && booking.status !== 'PENDING'" class="timeline-item">
            <i class="bi bi-circle-fill" :class="`text-${statusColor}`"></i>
            <div>
              <div class="fw-semibold">{{ booking.status }}</div>
              <div class="small text-muted">{{ formatDate(booking.updatedAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getImageUrl } from '../utils/imageUtils';

const props = defineProps({
  booking: { type: Object, required: true },
});

const statusColor = computed(() => {
  const colors = {
    PENDING: 'warning',
    PENDING_OWNER: 'warning',
    AWAITING_PAYMENT: 'info',
    CONFIRMED: 'success',
    PAID: 'info',
    HANDED_OVER: 'primary',
    RETURNED: 'success',
    CANCELLED: 'danger',
    OWNER_DECLINED: 'danger',
  };
  return colors[props.booking.status] || 'secondary';
});

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'N/A';
  // Backend sends prices in cents, so divide by 100 for display
  const currency = props.booking.currency || props.booking.item?.currency || 'ILS';
  const amountInCents = typeof amount === 'number' ? amount : parseInt(amount);
  const mainUnit = amountInCents / 100;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(mainUnit);
}
</script>

<style scoped>
.booking-details-card {
  max-width: 800px;
  margin: 0 auto;
}

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

