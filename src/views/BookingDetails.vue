<template>
  <div class="booking-details-view">
    <div class="container-lg py-4">
      <div class="row justify-content-center">
        <div class="col-lg-10">
          <!-- Header -->
          <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 class="mb-1">
                <i class="bi bi-receipt-cutoff me-2"></i>
                Booking Details
              </h2>
              <p class="text-muted mb-0">View and manage your booking information</p>
            </div>
            <button class="btn btn-outline-secondary" @click="goBack">
              <i class="bi bi-arrow-left me-2"></i>
              Back
            </button>
          </div>

          <!-- Loading -->
          <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <div class="mt-3 text-muted">Loading booking details...</div>
          </div>

          <!-- Error -->
          <div v-else-if="error" class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {{ error }}
            <button class="btn btn-sm btn-outline-danger ms-3" @click="loadBooking">
              Try Again
            </button>
          </div>

          <!-- Booking Details -->
          <div v-else-if="booking">
            <BookingDetailsCard :booking="booking" />

            <!-- Actions -->
            <div class="card mt-4">
              <div class="card-body">
                <h6 class="card-title mb-3">
                  <i class="bi bi-gear me-2"></i>
                  Actions
                </h6>
                <div class="d-flex gap-2 flex-wrap">
                  <!-- Cancel Booking Button -->
                  <button 
                    v-if="canCancel"
                    class="btn btn-outline-danger"
                    :disabled="cancelling"
                    @click="handleCancelBooking"
                  >
                    <span v-if="cancelling" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-x-circle me-2"></i>
                    {{ cancelling ? 'Cancelling...' : 'Cancel Booking' }}
                  </button>

                  <!-- View Item Button -->
                  <router-link
                    v-if="booking.item?.id"
                    :to="{ name: 'item', params: { id: booking.item.id } }"
                    class="btn btn-outline-primary"
                  >
                    <i class="bi bi-box-seam me-2"></i>
                    View Item
                  </router-link>

                  <!-- Go to Payment Button (if awaiting payment) -->
                  <router-link
                    v-if="booking.status === 'AWAITING_PAYMENT' && isRenter"
                    :to="{ name: 'booking-checkout', params: { bookingId: booking.id } }"
                    class="btn btn-primary"
                  >
                    <i class="bi bi-credit-card me-2"></i>
                    Go to Payment
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { getBooking } from '../services/bookingService';
import { cancelBooking } from '../services/bookingCalendarService';
import BookingDetailsCard from '../components/BookingDetailsCard.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const booking = ref(null);
const loading = ref(true);
const error = ref('');
const cancelling = ref(false);

const isOwner = computed(() => {
  if (!auth.user || !booking.value) return false;
  
  // Check role field first (new API structure)
  if (booking.value.role === 'owner') return true;
  if (booking.value.role === 'renter') return false;
  
  // Fallback to checking ownerId (old API structure)
  const userId = auth.user.id;
  const ownerId = booking.value.ownerId || 
                  booking.value.owner_id ||
                  booking.value.owner?.id || 
                  booking.value.item?.ownerId || 
                  booking.value.item?.owner_id ||
                  booking.value.item?.owner?.id;
  return ownerId === userId;
});

const isRenter = computed(() => {
  if (!auth.user || !booking.value) return false;
  
  // Check role field first (new API structure)
  if (booking.value.role === 'renter') return true;
  if (booking.value.role === 'owner') return false;
  
  // Fallback to checking renterId (old API structure)
  const userId = auth.user.id;
  const renterId = booking.value.renterId || 
                   booking.value.renter_id ||
                   booking.value.renter?.id ||
                   booking.value.counterparty?.id;
  return renterId === userId;
});

const canCancel = computed(() => {
  if (!booking.value || !auth.user) return false;
  
  // Check if user is owner or renter
  const userIsParticipant = isOwner.value || isRenter.value;
  
  // Can cancel if status is PENDING_OWNER, AWAITING_PAYMENT, or CONFIRMED
  const cancellableStatuses = ['PENDING_OWNER', 'AWAITING_PAYMENT', 'CONFIRMED', 'PENDING'];
  const status = booking.value.status;
  const canCancelStatus = cancellableStatuses.includes(status);
  
  // Debug logging
  console.log('canCancel check:', {
    status,
    canCancelStatus,
    isOwner: isOwner.value,
    isRenter: isRenter.value,
    userIsParticipant,
    booking: {
      id: booking.value.id,
      role: booking.value.role,
      ownerId: booking.value.ownerId,
      renterId: booking.value.renterId,
      owner: booking.value.owner,
      renter: booking.value.renter,
      counterparty: booking.value.counterparty
    },
    authUser: auth.user?.id
  });
  
  return userIsParticipant && canCancelStatus;
});

async function loadBooking() {
  loading.value = true;
  error.value = '';
  
  try {
    const bookingId = route.params.bookingId;
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }
    
    const data = await getBooking(bookingId);
    // Handle both { success: true, data: {...} } and direct response
    booking.value = data.data || data;
  } catch (err) {
    console.error('Failed to load booking:', err);
    error.value = err.message || 'Failed to load booking details';
  } finally {
    loading.value = false;
  }
}

async function handleCancelBooking() {
  if (!booking.value) return;
  
  const confirmed = window.confirm(
    'Are you sure you want to cancel this booking? This action cannot be undone.'
  );
  
  if (!confirmed) return;
  
  cancelling.value = true;
  try {
    await cancelBooking(booking.value.id);
    ui.showToast('Booking cancelled successfully', 'success');
    // Reload booking to get updated status
    await loadBooking();
  } catch (err) {
    console.error('Failed to cancel booking:', err);
    ui.showToast(err.message || 'Failed to cancel booking', 'danger');
  } finally {
    cancelling.value = false;
  }
}

function goBack() {
  router.back();
}

onMounted(() => {
  loadBooking();
});
</script>

<style scoped>
.booking-details-view {
  min-height: 100vh;
  background: #f8f9fa;
}
</style>

