<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { Modal } from 'bootstrap';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import {
  fetchAllBookings,
  approveBookingRequest,
  rejectBookingRequest,
} from '../services/bookingRequestService';
import ReviewModal from './ReviewModal.vue';

const { t } = useI18n();
const router = useRouter();
const ui = useUiStore();
const auth = useAuthStore();

const requests = ref([]);
const loading = ref(false);
const error = ref('');
const statusFilter = ref('ALL');
const selectedRequest = ref(null);
const actionLoadingId = ref(null);
const approveModal = ref(null);
const rejectModal = ref(null);
const reviewModal = ref(null);
const reviewBooking = ref(null);
const approving = ref(false);
const rejecting = ref(false);
const rejectReason = ref('');
const adjustedRentalPrice = ref('');
const adjustedDepositAmount = ref('');

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
    const res = await fetchAllBookings();
    const all = res.bookings || res.requests || [];
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

function isOwnerOfBooking(booking) {
  if (!auth.user || !booking) return false;
  if (booking.role === 'owner') return true;
  if (booking.role === 'renter') return false;
  const userId = auth.user.id;
  const ownerId = booking.ownerId || booking.owner_id || 
                  booking.item?.ownerId || booking.item?.owner_id ||
                  booking.item?.owner?.id;
  return ownerId === userId;
}

function isRenterOfBooking(booking) {
  if (!auth.user || !booking) return false;
  if (booking.role === 'renter') return true;
  if (booking.role === 'owner') return false;
  const userId = auth.user.id;
  const renterId = booking.renterId || booking.renter_id ||
                    booking.renter?.id;
  return renterId === userId;
}

const filteredRequests = computed(() => {
  if (statusFilter.value === 'ALL') return requests.value;
  return requests.value.filter((r) => r.status === statusFilter.value);
});

const ownerRequests = computed(() =>
  filteredRequests.value.filter((r) => isOwnerOfBooking(r))
);

const renterRequests = computed(() =>
  filteredRequests.value.filter((r) => isRenterOfBooking(r))
);

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
  const diff = end - start;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount, currency = 'ILS') {
  if (amount == null) return '—';
  const symbols = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || currency;
  const value = (amount / 100).toFixed(0);
  return `${value}${symbol}`;
}

function getBookingReviews(booking) {
  if (!booking) return [];
  const candidates = [
    booking.reviews,
    booking.booking?.reviews,
    booking.order?.reviews,
    booking.review,
  ];

  const reviews = [];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      reviews.push(...value);
    } else if (value && typeof value === 'object') {
      if (value.rentalExperience || value.renter) {
        if (value.rentalExperience) reviews.push(value.rentalExperience);
        if (value.renter) reviews.push(value.renter);
      } else {
        reviews.push(value);
      }
    }
  }
  return reviews;
}

function hasLeftReview(booking) {
  if (!auth.user || !booking) return false;
  const userId = auth.user.id;
  const reviews = getBookingReviews(booking);
  if (reviews.length === 0) return false;
  return reviews.some(
    (review) =>
      review.reviewerId === userId ||
      review.reviewer?.id === userId ||
      review.user?.id === userId ||
      review.userId === userId
  );
}

function openApproveModal(request) {
  selectedRequest.value = request;
  // Pre-fill with current values (convert from cents to currency units)
  adjustedRentalPrice.value = request.rentalPrice ? (request.rentalPrice / 100).toString() : '';
  adjustedDepositAmount.value = request.depositAmount ? (request.depositAmount / 100).toString() : '';
  if (approveModalInstance) {
    approveModalInstance.show();
  }
}

function openRejectModal(request) {
  selectedRequest.value = request;
  rejectReason.value = '';
  if (rejectModalInstance) {
    rejectModalInstance.show();
  }
}

async function approveRequest() {
  if (!selectedRequest.value) return;
  approving.value = true;
  try {
    const payload = {};
    // Only include values if they are filled (not empty string)
    if (adjustedRentalPrice.value && adjustedRentalPrice.value.toString().trim() !== '') {
      payload.rentalPrice = Math.round(parseFloat(adjustedRentalPrice.value) * 100);
    }
    if (adjustedDepositAmount.value && adjustedDepositAmount.value.toString().trim() !== '') {
      payload.depositAmount = Math.round(parseFloat(adjustedDepositAmount.value) * 100);
    }
    await approveBookingRequest(selectedRequest.value.id, payload);
    ui.showToast(t('bookingRequests.messages.approved'), 'success');
    if (approveModalInstance) {
      approveModalInstance.hide();
    }
    selectedRequest.value = null;
    await loadRequests();
  } catch (e) {
    ui.showToast(e?.message || t('bookingRequests.messages.failedToApprove'), 'danger');
  } finally {
    approving.value = false;
  }
}

async function declineRequest() {
  if (!selectedRequest.value) return;
  rejecting.value = true;
  try {
    await rejectBookingRequest(selectedRequest.value.id, rejectReason.value);
    ui.showToast(t('bookingRequests.messages.declined'), 'info');
    if (rejectModalInstance) {
      rejectModalInstance.hide();
    }
    selectedRequest.value = null;
    await loadRequests();
  } catch (e) {
    ui.showToast(e?.message || t('bookingRequests.messages.failedToDecline'), 'danger');
  } finally {
    rejecting.value = false;
  }
}

function goToPayment(booking) {
  if (!booking) return;
  const bookingId = booking.bookingId || booking.id;
  if (!bookingId) return;
  router.push({ name: 'booking-checkout', params: { bookingId } });
}

function openContactModal(request) {
  const userId = isOwnerOfBooking(request)
    ? (request.counterparty || request.renter)?.id
    : request.item?.owner?.id || request.item?.ownerId;
  const itemId = request.item?.id;
  router.push({
    name: 'messages',
    query: { userId, ...(itemId && { itemId }) },
  });
}

async function openReviewModal(booking) {
  reviewBooking.value = booking;
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 100));
  if (reviewModal.value) {
    reviewModal.value.show();
  }
}

function handleReviewModalClose() {
  setTimeout(() => {
    reviewBooking.value = null;
  }, 300);
}

async function handleReviewSubmit(reviewData) {
  if (!reviewBooking.value) return;
  try {
    if (reviewModal.value) {
      reviewModal.value.hide();
    }
    await loadRequests();
    setTimeout(() => {
      reviewBooking.value = null;
    }, 300);
  } catch (e) {
    console.error('Failed to handle review submission:', e);
  }
}
</script>

<template>
  <div class="owner-booking-requests-panel">
    <div class="panel-header">
      <div>
        <h1 class="panel-title">{{ $t('bookingRequests.title') }}</h1>
        <p class="panel-subtitle">{{ $t('bookingRequests.description') }}</p>
      </div>
      <div class="panel-stats">
        <div class="stat-box stat-pending">
          <div class="stat-icon">
            <i class="bi bi-clock-history"></i>
          </div>
          <div class="stat-content">
            <p class="stat-label">{{ $t('bookingRequests.pending') }}</p>
            <p class="stat-value">{{ requests.filter(r => r.status === 'PENDING_OWNER').length }}</p>
          </div>
        </div>
        <div class="stat-box stat-total">
          <div class="stat-icon">
            <i class="bi bi-check-circle"></i>
          </div>
          <div class="stat-content">
            <p class="stat-label">{{ $t('bookingRequests.total') }}</p>
            <p class="stat-value">{{ requests.length }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-filters">
      <span class="filter-label">{{ $t('bookingRequests.filter') }}:</span>
      <select v-model="statusFilter" class="filter-select">
        <option value="ALL">{{ $t('bookingRequests.all') }}</option>
        <option value="PENDING_OWNER">{{ $t('bookingRequests.pending') }}</option>
        <option value="AWAITING_PAYMENT">{{ $t('bookingRequests.awaitingPayment') }}</option>
        <option value="CONFIRMED">{{ $t('bookingRequests.confirmed') }}</option>
        <option value="OWNER_DECLINED">{{ $t('bookingRequests.declined') }}</option>
        <option value="CANCELLED">{{ $t('bookingRequests.cancelled') }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="empty-state">
      <div class="spinner-border text-primary" role="status"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-danger">
      {{ error }}
    </div>

    <!-- Empty -->
    <div v-else-if="filteredRequests.length === 0" class="empty-state">
      <i class="bi bi-inbox"></i>
      <p>{{ $t('bookingRequests.noRequestsFound') }}</p>
    </div>

    <!-- Requests List -->
    <div v-else class="requests-container">
      <div v-if="ownerRequests.length" class="request-group">
        <div class="group-header">
          <i class="bi bi-house-check"></i>
          <span>{{ $t('bookingRequests.youAreOwner') }}</span>
        </div>
        <div class="requests-list">
          <div
            v-for="request in ownerRequests"
            :key="request.id"
            class="request-card"
          >
            <div class="request-body">
              <div class="request-content">
                <div class="item-thumb">
                  <img
                    v-if="request.item?.mainPhotoUrl || request.item?.thumbnail"
                    :src="request.item.mainPhotoUrl || request.item.thumbnail"
                    :alt="request.item.title"
                  />
                </div>
                <div class="request-info">
                  <router-link
                    v-if="request.item"
                    :to="{ name: 'item', params: { id: request.item.id } }"
                    class="item-title-link"
                  >
                    <h3 class="item-title">
                      {{ request.item.title }}
                      <i class="bi bi-box-arrow-up-right"></i>
                    </h3>
                  </router-link>
                  <div class="request-dates">
                    <i class="bi bi-calendar-range"></i>
                    <span>{{ formatDate(request.startDate || request.from) }} → {{ formatDate(request.endDate || request.to) }}</span>
                    <span class="date-separator">•</span>
                    <span class="days-count">
                      {{ request.days || calculateDays(request.startDate || request.from, request.endDate || request.to) }}
                      {{ $t('bookingRequests.days') }}
                    </span>
                  </div>
                  <div v-if="request.counterparty || request.renter" class="counterparty-info">
                    <img
                      v-if="(request.counterparty || request.renter).avatarUrl || (request.counterparty || request.renter).profilePicture"
                      :src="(request.counterparty || request.renter).avatarUrl || (request.counterparty || request.renter).profilePicture"
                      :alt="(request.counterparty || request.renter).displayName"
                      class="counterparty-avatar"
                    />
                    <div v-else class="counterparty-avatar-placeholder">
                      <i class="bi bi-person"></i>
                    </div>
                    <router-link
                      :to="{ name: 'user-profile', params: { id: (request.counterparty || request.renter).id } }"
                      class="counterparty-name"
                    >
                      {{ (request.counterparty || request.renter).displayName || (request.counterparty || request.renter).username || (request.counterparty || request.renter).name }}
                    </router-link>
                    <span class="counterparty-badge">{{ $t('bookingRequests.borrower') }}</span>
                  </div>
                </div>
                <div class="request-pricing">
                  <div class="price-total">{{ formatCurrency(request.rentalPrice, request.currency || 'ILS') }}</div>
                  
                  <div v-if="request.depositAmount" class="price-detail">
                    {{ $t('bookingRequests.deposit') }}: {{ formatCurrency(request.depositAmount, request.currency || 'ILS') }}
                  </div>
                  <div v-if="request.rentalPrice" class="price-detail">
                    {{ $t('bookingRequests.total') }}: {{ formatCurrency(request.totalAmount || request.estimatedTotal || request.total, request.currency || 'ILS') }}
                  </div>
                  <div class="request-status-wrapper">
                    <span class="status-badge" :class="`status-${request.status.toLowerCase().replace('_', '-')}`">
                      {{ $t(`bookingRequests.status.${request.status}`) }}
                    </span>
                    <div v-if="request.status === 'CONFIRMED'" class="status-info">
                      <i class="bi bi-check-circle-fill"></i>
                      <span>{{ $t('bookingRequests.confirmed') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="request-actions">
              <button
                v-if="request.status === 'PENDING_OWNER'"
                type="button"
                class="btn-action btn-approve"
                :disabled="actionLoadingId === request.id"
                @click="openApproveModal(request)"
              >
                <i class="bi bi-check-circle"></i>
                {{ $t('bookingRequests.approve') }}
              </button>
              <button
                v-if="request.status === 'PENDING_OWNER'"
                type="button"
                class="btn-action btn-decline"
                :disabled="actionLoadingId === request.id"
                @click="openRejectModal(request)"
              >
                <i class="bi bi-x-circle"></i>
                {{ $t('bookingRequests.decline') }}
              </button>
              <button
                v-if="request.status === 'CONFIRMED' && !hasLeftReview(request)"
                type="button"
                class="btn-action btn-review"
                @click.stop="openReviewModal(request)"
              >
                <i class="bi bi-star"></i>
                {{ $t('bookingRequests.leaveReview') }}
              </button>
              <button
                type="button"
                class="btn-action btn-secondary"
                @click="openContactModal(request)"
              >
                {{ $t('bookingRequests.messageBorrower') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="renterRequests.length" class="request-group">
        <div class="group-header">
          <i class="bi bi-box-arrow-in-right"></i>
          <span>{{ $t('bookingRequests.youAreRenter') }}</span>
        </div>
        <div class="requests-list">
          <div
            v-for="request in renterRequests"
            :key="request.id"
            class="request-card"
          >
            <div class="request-body">
              <div class="request-content">
                <div class="item-thumb">
                  <img
                    v-if="request.item?.mainPhotoUrl || request.item?.thumbnail"
                    :src="request.item.mainPhotoUrl || request.item.thumbnail"
                    :alt="request.item.title"
                  />
                </div>
                <div class="request-info">
                  <router-link
                    v-if="request.item"
                    :to="{ name: 'item', params: { id: request.item.id } }"
                    class="item-title-link"
                  >
                    <h3 class="item-title">
                      {{ request.item.title }}
                      <i class="bi bi-box-arrow-up-right"></i>
                    </h3>
                  </router-link>
                  <div class="request-dates">
                    <i class="bi bi-calendar-range"></i>
                    <span>{{ formatDate(request.startDate || request.from) }} → {{ formatDate(request.endDate || request.to) }}</span>
                    <span class="date-separator">•</span>
                    <span class="days-count">
                      {{ request.days || calculateDays(request.startDate || request.from, request.endDate || request.to) }}
                      {{ $t('bookingRequests.days') }}
                    </span>
                  </div>
                  <div v-if="request.counterparty || request.owner" class="counterparty-info">
                    <img
                      v-if="(request.counterparty || request.owner)?.avatarUrl || (request.counterparty || request.owner)?.profilePicture"
                      :src="(request.counterparty || request.owner).avatarUrl || (request.counterparty || request.owner).profilePicture"
                      :alt="(request.counterparty || request.owner).displayName"
                      class="counterparty-avatar"
                    />
                    <div v-else class="counterparty-avatar-placeholder">
                      <i class="bi bi-person"></i>
                    </div>
                    <router-link
                      :to="{ name: 'user-profile', params: { id: (request.counterparty || request.owner || request.item?.owner).id } }"
                      class="counterparty-name"
                    >
                      {{ (request.counterparty || request.owner)?.displayName || (request.counterparty || request.owner)?.username || (request.counterparty || request.owner)?.name || $t('bookingRequests.owner') }}
                    </router-link>
                    <span class="counterparty-badge">{{ $t('bookingRequests.owner') }}</span>
                  </div>
                </div>
                <div class="request-pricing">
                  <div class="price-total">{{ formatCurrency(request.totalAmount || request.estimatedTotal || request.total, request.currency || 'ILS') }}</div>
                  <div v-if="request.rentalPrice" class="price-detail">
                    {{ $t('bookingRequests.rental') }}: {{ formatCurrency(request.rentalPrice, request.currency || 'ILS') }}
                  </div>
                  <div v-if="request.depositAmount" class="price-detail">
                    {{ $t('bookingRequests.deposit') }}: {{ formatCurrency(request.depositAmount, request.currency || 'ILS') }}
                  </div>
                  <div class="request-status-wrapper">
                    <span class="status-badge" :class="`status-${request.status.toLowerCase().replace('_', '-')}`">
                      {{ $t(`bookingRequests.status.${request.status}`) }}
                    </span>
                    <div v-if="request.status === 'CONFIRMED'" class="status-info">
                      <i class="bi bi-check-circle-fill"></i>
                      <span>{{ $t('bookingRequests.confirmed') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="request-actions">
              <button
                v-if="request.status === 'AWAITING_PAYMENT'"
                type="button"
                class="btn-action btn-primary"
                @click.stop="goToPayment(request)"
              >
                <i class="bi bi-credit-card"></i>
                {{ $t('bookingRequests.goToPayment') }}
              </button>
              <button
                v-if="request.status === 'CONFIRMED' && !hasLeftReview(request)"
                type="button"
                class="btn-action btn-review"
                @click.stop="openReviewModal(request)"
              >
                <i class="bi bi-star"></i>
                {{ $t('bookingRequests.leaveReview') }}
              </button>
              <button
                type="button"
                class="btn-action btn-secondary"
                @click="openContactModal(request)"
              >
                {{ $t('bookingRequests.messageOwner') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Approve Modal -->
    <div class="modal fade" id="approveRequestModal" tabindex="-1" ref="approveModal">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header border-0 pb-0">
            <div>
              <h5 class="modal-title mb-1">
                <i class="bi bi-check2-circle text-success me-2"></i>
                {{ $t('bookingRequests.approveModal.title') }}
              </h5>
              <p v-if="selectedRequest" class="text-muted small mb-0">
                {{ formatDate(selectedRequest.startDate || selectedRequest.from) }} →
                {{ formatDate(selectedRequest.endDate || selectedRequest.to) }}
              </p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">{{ $t('bookingRequests.approveModal.adjustRentalPrice') }}</label>
              <input
                v-model="adjustedRentalPrice"
                type="number"
                class="form-control"
                :placeholder="`${$t('bookingRequests.approveModal.current')}: ${formatCurrency(selectedRequest?.rentalPrice || 0)}`"
              />
            </div>
            <div class="mb-3">
              <label class="form-label">{{ $t('bookingRequests.approveModal.adjustDepositAmount') }}</label>
              <input
                v-model="adjustedDepositAmount"
                type="number"
                class="form-control"
                :placeholder="`${$t('bookingRequests.approveModal.current')}: ${formatCurrency(selectedRequest?.depositAmount || 0)}`"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              {{ $t('bookingRequests.approveModal.cancel') }}
            </button>
            <button
              type="button"
              class="btn btn-success"
              :disabled="approving"
              @click="approveRequest"
            >
              <span v-if="approving" class="spinner-border spinner-border-sm me-1"></span>
              {{ approving ? $t('bookingRequests.approveModal.approving') : $t('bookingRequests.approveModal.approveRequest') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div class="modal fade" id="rejectRequestModal" tabindex="-1" ref="rejectModal">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ $t('bookingRequests.rejectModal.title') }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <label class="form-label">{{ $t('bookingRequests.rejectModal.reason') }}</label>
            <textarea
              v-model="rejectReason"
              class="form-control"
              rows="3"
              :placeholder="$t('bookingRequests.rejectModal.reasonPlaceholder')"
            ></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{{ $t('bookingRequests.rejectModal.cancel') }}</button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="rejecting"
              @click="declineRequest"
            >
              <span v-if="rejecting" class="spinner-border spinner-border-sm me-1"></span>
              {{ rejecting ? $t('bookingRequests.rejectModal.rejecting') : $t('bookingRequests.rejectModal.rejectRequest') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <ReviewModal
      v-if="reviewBooking"
      ref="reviewModal"
      :key="`review-${reviewBooking.id}`"
      :order-id="reviewBooking.orderId || reviewBooking.id"
      :booking-id="reviewBooking.id"
      :can-review-renter="false"
      :default-subject-type="isOwnerOfBooking(reviewBooking) ? 'RENTER' : 'RENTAL_EXPERIENCE'"
      @submit="handleReviewSubmit"
      @close="handleReviewModalClose"
    />
  </div>
</template>

<style scoped>
.owner-booking-requests-panel {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.panel-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  color: #0f172a;
}

.panel-subtitle {
  color: #64748b;
  margin: 0;
}

.panel-stats {
  display: flex;
  gap: 1rem;
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 0.75rem 1.5rem;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 20px;
}

.stat-pending .stat-icon {
  background: #fef3c7;
  color: #f59e0b;
}

.stat-total .stat-icon {
  background: #d1fae5;
  color: #10b981;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
  font-weight: 500;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
}

.panel-filters {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.filter-label {
  font-size: 0.875rem;
  color: #64748b;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
}

.filter-select:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 0;
  border-color: #3b82f6;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #94a3b8;
}

.empty-state i {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.requests-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.request-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #64748b;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.875rem;
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.request-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.request-card:hover {
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.request-body {
  padding: 1.5rem;
}

.request-main {
  display: flex;
  gap: 1.5rem;
}

.request-content {
  display: flex;
  gap: 1.5rem;
  flex: 1;
}

.item-thumb {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  overflow: hidden;
  background: #f1f5f9;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.request-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-title-link {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.item-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
  transition: color 0.2s;
}

.item-title-link:hover .item-title {
  color: #3b82f6;
}

.item-title i {
  font-size: 0.875rem;
  color: #3b82f6;
}

.request-dates {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.date-separator {
  margin: 0 0.25rem;
}

.days-count {
  font-weight: 600;
  color: #0f172a;
}

.counterparty-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.counterparty-avatar {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  object-fit: cover;
}

.counterparty-avatar-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 12px;
}

.counterparty-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  text-decoration: none;
  transition: color 0.2s;
}

.counterparty-name:hover {
  color: #3b82f6;
}

.counterparty-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
}

.request-pricing {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.price-total {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.price-detail {
  font-size: 0.75rem;
  color: #64748b;
}

.request-status-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  white-space: nowrap;
}

.status-pending-owner {
  background: #fef3c7;
  color: #92400e;
}

.status-awaiting-payment {
  background: #fef3c7;
  color: #92400e;
}

.status-confirmed {
  background: #d1fae5;
  color: #065f46;
}

.status-owner-declined {
  background: #fee2e2;
  color: #991b1b;
}

.status-cancelled {
  background: #f1f5f9;
  color: #475569;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #10b981;
}

.request-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #f1f5f9;
  background: rgba(248, 250, 252, 0.5);
}

.btn-action {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 700;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-approve {
  background: #10b981;
  color: #ffffff;
}

.btn-approve:hover {
  background: #059669;
}

.btn-decline {
  background: transparent;
  color: #ef4444;
  border: 1px solid #ef4444;
}

.btn-decline:hover {
  background: #ef4444;
  color: #ffffff;
}

.btn-primary {
  background: #3b82f6;
  color: #ffffff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-review {
  background: #f59e0b;
  color: #ffffff;
}

.btn-review:hover {
  background: #d97706;
}

.btn-secondary {
  background: transparent;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #f8fafc;
  color: #0f172a;
}

@media (max-width: 1024px) {
  .request-content {
    flex-direction: column;
  }

  .request-pricing {
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
  }

  .panel-stats {
    width: 100%;
  }

  .stat-box {
    flex: 1;
  }

  .request-actions {
    flex-direction: column;
  }

  .btn-action {
    width: 100%;
  }
}

:global([data-bs-theme="dark"]) .panel-title {
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .panel-subtitle,
:global([data-bs-theme="dark"]) .filter-label {
  color: #94a3b8;
}

:global([data-bs-theme="dark"]) .stat-box,
:global([data-bs-theme="dark"]) .request-card,
:global([data-bs-theme="dark"]) .filter-select {
  background: #1e293b;
  border-color: #334155;
}

:global([data-bs-theme="dark"]) .stat-value,
:global([data-bs-theme="dark"]) .item-title,
:global([data-bs-theme="dark"]) .price-total,
:global([data-bs-theme="dark"]) .counterparty-name {
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .stat-label,
:global([data-bs-theme="dark"]) .price-detail,
:global([data-bs-theme="dark"]) .request-dates,
:global([data-bs-theme="dark"]) .group-header {
  color: #cbd5f5;
}

:global([data-bs-theme="dark"]) .item-thumb {
  background: #0f172a;
}

:global([data-bs-theme="dark"]) .counterparty-badge {
  background: #0f172a;
  color: #94a3b8;
}

:global([data-bs-theme="dark"]) .request-actions {
  background: rgba(15, 23, 42, 0.5);
  border-top-color: #1e293b;
}

:global([data-bs-theme="dark"]) .btn-secondary {
  border-color: #334155;
  color: #cbd5f5;
}

:global([data-bs-theme="dark"]) .btn-secondary:hover {
  background: #0f172a;
  color: #f8fafc;
}
</style>
