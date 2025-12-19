<template>
  <div class="card p-3 owner-booking-requests-panel">
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h2 class="h5 mb-1">{{ $t('bookingRequests.title') }}</h2>
        <p class="text-muted small mb-0">
          {{ $t('bookingRequests.description') }}
        </p>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <label class="text-muted small mb-0">{{ $t('bookingRequests.filter') }}:</label>
        <select v-model="statusFilter" class="form-select form-select-sm">
          <option value="ALL">{{ $t('bookingRequests.all') }}</option>
          <option value="PENDING_OWNER">{{ $t('bookingRequests.pending') }}</option>
          <option value="AWAITING_PAYMENT">{{ $t('bookingRequests.awaitingPayment') }}</option>
          <option value="CONFIRMED">{{ $t('bookingRequests.confirmed') }}</option>
          <option value="OWNER_DECLINED">{{ $t('bookingRequests.declined') }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-danger mb-0">
      {{ error }}
    </div>

    <!-- Empty -->
    <div v-else-if="filteredRequests.length === 0" class="alert alert-light border text-muted text-center mb-0">
      <i class="bi bi-inbox display-6 d-block mb-2"></i>
      {{ $t('bookingRequests.noRequestsFound') }}
    </div>

    <!-- Requests List -->
    <div v-else class="vstack gap-3">
      <div
        v-for="request in filteredRequests"
        :key="request.id"
        class="card booking-request-card"
        :class="{ 'border-warning': request.status === 'PENDING_OWNER' }"
      >
        <div class="card-body">
          <div class="d-flex flex-column flex-md-row gap-3 align-items-start">
            <!-- Item Info -->
            <div class="flex-grow-1">
              <div class="d-flex align-items-start gap-2 mb-2">
                <img
                  v-if="request.item?.mainPhotoUrl || request.item?.thumbnail"
                  :src="request.item.mainPhotoUrl || request.item.thumbnail"
                  :alt="request.item.title"
                  class="rounded"
                  style="width: 60px; height: 60px; object-fit: cover;"
                />
                <div class="flex-grow-1">
                  <router-link
                    v-if="request.item"
                    :to="{ name: 'item', params: { id: request.item.id } }"
                    class="text-decoration-none"
                  >
                    <h3 class="h6 mb-1">
                      {{ request.item.title }}
                      <i class="bi bi-box-arrow-up-right ms-1 small"></i>
                    </h3>
                  </router-link>
                </div>
              </div>

              <div class="text-muted small mb-2">
                <i class="bi bi-calendar me-1"></i>
                {{ formatDate(request.startDate || request.from) }} → {{ formatDate(request.endDate || request.to) }}
                <span v-if="request.days"> · {{ request.days }} {{ $t('bookingRequests.days') }}</span>
                <span v-else-if="request.startDate && request.endDate">
                  · {{ calculateDays(request.startDate || request.from, request.endDate || request.to) }} {{ $t('bookingRequests.days') }}
                </span>
              </div>

              <!-- Show counterparty (renter if user is owner, owner if user is renter) -->
              <div v-if="request.counterparty || request.renter" class="mb-2">
                <div class="d-flex align-items-center gap-2">
                  <router-link
                    :to="{ name: 'user-profile', params: { id: (request.counterparty || request.renter).id } }"
                    class="text-decoration-none"
                  >
                    <i class="bi bi-person-circle me-1"></i>
                    <strong>{{ (request.counterparty || request.renter).displayName || (request.counterparty || request.renter).username || (request.counterparty || request.renter).name }}</strong>
                  </router-link>
                  <span v-if="(request.counterparty || request.renter).renterRating" class="badge bg-info">
                    <i class="bi bi-star-fill me-1"></i>
                    {{ (request.counterparty || request.renter).renterRating.toFixed(1) }}
                  </span>
                  <span v-if="request.role" class="badge bg-secondary">
                    {{ request.role === 'renter' ? $t('bookingRequests.youAreRenter') : $t('bookingRequests.youAreOwner') }}
                  </span>
                </div>
              </div>

              <div v-if="request.notes" class="alert alert-light small mb-0">
                <i class="bi bi-chat-quote me-1"></i>
                <strong>{{ $t('bookingRequests.notes') }}:</strong> {{ request.notes }}
              </div>
            </div>

            <!-- Status & Actions -->
            <div class="d-flex flex-column align-items-end gap-2 ms-md-3">
              <div class="text-end">
                <div class="fw-semibold mb-1">
                  {{ formatCurrency(request.totalAmount || request.estimatedTotal || request.total, request.currency || 'ILS') }}
                </div>
                <div v-if="request.rentalPrice || request.depositAmount" class="small text-muted mb-1">
                  <div v-if="request.rentalPrice">
                    {{ $t('bookingRequests.rental') }}: {{ formatCurrency(request.rentalPrice, request.currency || 'ILS') }}
                  </div>
                  <div v-if="request.depositAmount">
                    {{ $t('bookingRequests.deposit') }}: {{ formatCurrency(request.depositAmount, request.currency || 'ILS') }}
                  </div>
                </div>
                <div class="small">
                  <span class="badge" :class="getStatusBadgeClass(request.status)">
                    {{ $t(`bookingRequests.status.${request.status}`) }}
                  </span>
                </div>
              </div>

              <!-- Pending Actions - Only show if user is the owner -->
              <div v-if="request.status === 'PENDING_OWNER' && isOwnerOfBooking(request)" class="d-flex gap-2 flex-wrap justify-content-end">
                <button
                  type="button"
                  class="btn btn-sm btn-success"
                  :disabled="actionLoadingId === request.id"
                  @click="openApproveModal(request)"
                >
                  <i class="bi bi-check-circle me-1"></i>
                  {{ $t('bookingRequests.approve') }}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="actionLoadingId === request.id"
                  @click="openRejectModal(request)"
                >
                  <i class="bi bi-x-circle me-1"></i>
                  {{ $t('bookingRequests.decline') }}
                </button>
              </div>

              <!-- Awaiting Payment - Show status + Pay button (only for renter) -->
              <div v-else-if="request.status === 'AWAITING_PAYMENT'" class="d-flex flex-column align-items-end gap-1">
                
                <button
                  v-if="isRenterOfBooking(request)"
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  @click.stop="goToPayment(request)"
                >
                  <i class="bi bi-credit-card me-1"></i>
                  {{ $t('bookingRequests.goToPayment') }}
                </button>
              </div>

              <!-- Confirmed -->
              <div v-else-if="request.status === 'CONFIRMED'" class="small text-primary">
                <i class="bi bi-check-circle me-1"></i>
                {{ $t('bookingRequests.confirmed') }}
              </div>

              <!-- Declined -->
              <div v-else-if="request.status === 'OWNER_DECLINED'" class="small text-danger">
                <i class="bi bi-x-circle me-1"></i>
                {{ $t('bookingRequests.declined') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Approve Modal -->
  <div
    class="modal fade"
    id="approveRequestModal"
    tabindex="-1"
    ref="approveModal"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $t('bookingRequests.approveModal.title') }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div v-if="selectedRequest" class="mb-3">
            <p><strong>{{ $t('bookingRequests.approveModal.renter') }}:</strong> {{ (selectedRequest.counterparty || selectedRequest.renter)?.displayName || (selectedRequest.counterparty || selectedRequest.renter)?.username || (selectedRequest.counterparty || selectedRequest.renter)?.name }}</p>
            <p><strong>{{ $t('bookingRequests.approveModal.dates') }}:</strong> {{ formatDate(selectedRequest.startDate || selectedRequest.from) }} → {{ formatDate(selectedRequest.endDate || selectedRequest.to) }}</p>
            <p><strong>{{ $t('bookingRequests.totalAmount') }}:</strong> {{ formatCurrency(selectedRequest.totalAmount || selectedRequest.estimatedTotal || selectedRequest.total) }}</p>
            <p v-if="selectedRequest.rentalPrice"><strong>{{ $t('bookingRequests.approveModal.rentalPrice') }}:</strong> {{ formatCurrency(selectedRequest.rentalPrice) }}</p>
            <p v-if="selectedRequest.depositAmount"><strong>{{ $t('bookingRequests.deposit') }}:</strong> {{ formatCurrency(selectedRequest.depositAmount) }}</p>
          </div>

          <div class="mb-3">
            <label class="form-label">{{ $t('bookingRequests.approveModal.adjustRentalPrice') }}</label>
            <input
              v-model.number="paymentModifications.rentalPrice"
              type="number"
              class="form-control"
              :placeholder="`${$t('bookingRequests.approveModal.current')}: ${formatCurrency(selectedRequest?.rentalPrice || selectedRequest?.item?.pricePerDay || 0)}`"
              min="0"
              step="0.01"
            />
            <small class="text-muted">{{ $t('bookingRequests.approveModal.leaveEmptyToKeepOriginal', { field: $t('bookingRequests.approveModal.rentalPrice') }) }}</small>
          </div>

          <div class="mb-3">
            <label class="form-label">{{ $t('bookingRequests.approveModal.adjustDepositAmount') }}</label>
            <input
              v-model.number="paymentModifications.depositAmount"
              type="number"
              class="form-control"
              :placeholder="`${$t('bookingRequests.approveModal.current')}: ${formatCurrency(selectedRequest?.depositAmount || selectedRequest?.item?.deposit || 0)}`"
              min="0"
              step="0.01"
            />
            <small class="text-muted">{{ $t('bookingRequests.approveModal.leaveEmptyToKeepOriginal', { field: $t('bookingRequests.deposit') }) }}</small>
          </div>

          <div class="mb-3">
            <label class="form-label">{{ $t('bookingRequests.approveModal.adjustTotalAmount') }}</label>
            <input
              v-model.number="paymentModifications.totalAmount"
              type="number"
              class="form-control"
              :placeholder="`${$t('bookingRequests.approveModal.current')}: ${formatCurrency(selectedRequest?.estimatedTotal || selectedRequest?.total || 0)}`"
              min="0"
              step="0.01"
            />
            <small class="text-muted">{{ $t('bookingRequests.approveModal.leaveEmptyToKeepOriginal', { field: $t('bookingRequests.totalAmount') }) }}</small>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{{ $t('bookingRequests.approveModal.cancel') }}</button>
          <button
            type="button"
            class="btn btn-success"
            :disabled="approving"
            @click="handleApprove"
          >
            <span v-if="approving" class="spinner-border spinner-border-sm me-1"></span>
            {{ approving ? $t('bookingRequests.approveModal.approving') : $t('bookingRequests.approveModal.approveRequest') }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Reject Modal -->
  <div
    class="modal fade"
    id="rejectRequestModal"
    tabindex="-1"
    ref="rejectModal"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $t('bookingRequests.rejectModal.title') }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">{{ $t('bookingRequests.rejectModal.reason') }}</label>
            <textarea
              v-model="rejectionReason"
              class="form-control"
              rows="3"
              :placeholder="$t('bookingRequests.rejectModal.reasonPlaceholder')"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{{ $t('bookingRequests.rejectModal.cancel') }}</button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="rejecting"
            @click="handleReject"
          >
            <span v-if="rejecting" class="spinner-border spinner-border-sm me-1"></span>
            {{ rejecting ? $t('bookingRequests.rejectModal.rejecting') : $t('bookingRequests.rejectModal.rejectRequest') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Modal } from 'bootstrap';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { useI18n } from 'vue-i18n';
import {
  fetchAllBookings,
  approveBookingRequest,
  rejectBookingRequest,
} from '../services/bookingRequestService';

const { t } = useI18n();

const ui = useUiStore();
const router = useRouter();
const auth = useAuthStore();

const requests = ref([]);
const loading = ref(true);
const error = ref('');
const statusFilter = ref('ALL');
const actionLoadingId = ref(null);
const selectedRequest = ref(null);
const approving = ref(false);
const rejecting = ref(false);
const rejectionReason = ref('');
const paymentModifications = ref({ rentalPrice: null, depositAmount: null, totalAmount: null });

const approveModal = ref(null);
const rejectModal = ref(null);
let approveModalInstance = null;
let rejectModalInstance = null;

onMounted(async () => {
  await loadRequests();
  if (approveModal.value) {
    approveModalInstance = new Modal(approveModal.value);
  }
  if (rejectModal.value) {
    rejectModalInstance = new Modal(rejectModal.value);
  }
});

async function loadRequests() {
  loading.value = true;
  error.value = '';
  try {
    // Load all bookings for the current user (both as owner and renter)
    const res = await fetchAllBookings();
    const all = res.bookings || res.requests || [];

    // Sort by createdAt (newest first) if available
    requests.value = [...all].sort((a, b) => {
      const aDate = new Date(a.createdAt || a.created_at || 0).getTime();
      const bDate = new Date(b.createdAt || b.created_at || 0).getTime();
      return bDate - aDate;
    });
  } catch (e) {
    console.error('Failed to load booking requests:', e);
    error.value = e?.message || t('bookingRequests.messages.failedToLoad');
  } finally {
    loading.value = false;
  }
}

// Check if current user is the owner of a booking
function isOwnerOfBooking(booking) {
  if (!auth.user || !booking) return false;
  
  // Use role field if available (new API structure)
  if (booking.role === 'owner') return true;
  if (booking.role === 'renter') return false;
  
  // Fallback to checking ownerId (old API structure)
  const userId = auth.user.id;
  const ownerId = booking.ownerId || booking.owner_id || 
                  booking.item?.ownerId || booking.item?.owner_id ||
                  booking.item?.owner?.id;
  
  return ownerId === userId;
}

// Check if current user is the renter of a booking
function isRenterOfBooking(booking) {
  if (!auth.user || !booking) return false;
  
  // Use role field if available (new API structure)
  if (booking.role === 'renter') return true;
  if (booking.role === 'owner') return false;
  
  // Fallback to checking renterId (old API structure)
  const userId = auth.user.id;
  const renterId = booking.renterId || booking.renter_id ||
                    booking.renter?.id;
  
  return renterId === userId;
}

const filteredRequests = computed(() => {
  if (statusFilter.value === 'ALL') return requests.value;
  return requests.value.filter((r) => r.status === statusFilter.value);
});

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calculateDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

function formatCurrency(amount, currency = 'ILS') {
  if (!amount && amount !== 0) return '';
  // Backend sends in cents
  const amountInCents = typeof amount === 'number' ? amount : parseInt(amount);
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}

function getStatusBadgeClass(status) {
  const classes = {
    PENDING_OWNER: 'bg-warning',
    AWAITING_PAYMENT: 'bg-info',
    CONFIRMED: 'bg-success',
    OWNER_DECLINED: 'bg-danger',
  };
  return classes[status] || 'bg-secondary';
}

function openApproveModal(request) {
  selectedRequest.value = request;
  paymentModifications.value = { rentalPrice: null, depositAmount: null, totalAmount: null };
  if (approveModalInstance) {
    approveModalInstance.show();
  }
}

function openRejectModal(request) {
  selectedRequest.value = request;
  rejectionReason.value = '';
  if (rejectModalInstance) {
    rejectModalInstance.show();
  }
}

async function handleApprove() {
  if (!selectedRequest.value) return;

  approving.value = true;
  try {
    const mods = {};
    
    // Only include fields that have valid numeric values
    // v-model.number can produce null, undefined, NaN, or empty string for empty inputs
    const rentalPrice = paymentModifications.value.rentalPrice;
    if (rentalPrice != null && rentalPrice !== '' && !isNaN(rentalPrice) && rentalPrice > 0) {
      mods.rentalPrice = Math.round(rentalPrice * 100); // Convert to cents
    }
    
    const depositAmount = paymentModifications.value.depositAmount;
    if (depositAmount != null && depositAmount !== '' && !isNaN(depositAmount) && depositAmount >= 0) {
      mods.depositAmount = Math.round(depositAmount * 100); // Convert to cents
    }
    
    const totalAmount = paymentModifications.value.totalAmount;
    if (totalAmount != null && totalAmount !== '' && !isNaN(totalAmount) && totalAmount > 0) {
      mods.totalAmount = Math.round(totalAmount * 100); // Convert to cents
    }

    // Only send modifications if at least one field was provided
    const result = await approveBookingRequest(
      selectedRequest.value.id, 
      Object.keys(mods).length > 0 ? mods : undefined
    );
    
    // Update local state with backend response
    // Backend returns: { booking: { status: 'AWAITING_PAYMENT', ... }, message: "..." }
    const updatedBooking = result.booking || result;
    selectedRequest.value.status = updatedBooking.status || 'AWAITING_PAYMENT';
    if (mods.rentalPrice) selectedRequest.value.rentalPrice = mods.rentalPrice;
    if (mods.depositAmount) selectedRequest.value.depositAmount = mods.depositAmount;
    if (mods.totalAmount) selectedRequest.value.total = mods.totalAmount;
    if (updatedBooking.totalAmount) selectedRequest.value.totalAmount = updatedBooking.totalAmount;
    if (updatedBooking.rentalPrice) selectedRequest.value.rentalPrice = updatedBooking.rentalPrice;
    if (updatedBooking.depositAmount) selectedRequest.value.depositAmount = updatedBooking.depositAmount;

    ui.showToast(t('bookingRequests.messages.approved'), 'success');
    
    if (approveModalInstance) {
      approveModalInstance.hide();
    }
    
    // Reload to get updated data
    await loadRequests();
  } catch (e) {
    console.error('Failed to approve request:', e);
    ui.showToast(e?.message || t('bookingRequests.messages.failedToApprove'), 'danger');
  } finally {
    approving.value = false;
  }
}

async function handleReject() {
  if (!selectedRequest.value) return;

  rejecting.value = true;
  try {
    await rejectBookingRequest(selectedRequest.value.id, rejectionReason.value.trim() || undefined);
    
    // Update local state
    selectedRequest.value.status = 'OWNER_DECLINED';
    selectedRequest.value.reason = rejectionReason.value;

    ui.showToast(t('bookingRequests.messages.declined'), 'info');
    
    if (rejectModalInstance) {
      rejectModalInstance.hide();
    }
    
    // Reload to get updated data
    await loadRequests();
  } catch (e) {
    console.error('Failed to decline request:', e);
    ui.showToast(e?.message || t('bookingRequests.messages.failedToDecline'), 'danger');
  } finally {
    rejecting.value = false;
  }
}

function goToPayment(booking) {
  if (!booking) return;
  const bookingId = booking.bookingId || booking.id;
  if (!bookingId) return;

  router.push({
    name: 'booking-checkout',
    params: { bookingId },
  });
}
</script>

<style scoped>
.booking-request-card {
  transition: all 0.2s ease;
}

.booking-request-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.booking-request-card.border-warning {
  border-left: 4px solid #ffc107;
}
</style>

