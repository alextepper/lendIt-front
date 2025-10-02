<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-lg-8">
        <!-- Header -->
        <div class="text-center mb-4">
          <h1 class="h3 mb-2">Complete Your Booking</h1>
          <p class="text-muted">Review your booking details and confirm payment</p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border" role="status"></div>
          <div class="small text-secondary mt-2">Loading booking details...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          {{ error }}
        </div>

        <!-- Booking Summary -->
        <div v-else-if="booking" class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Booking Summary</h5>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <!-- Item Details -->
              <div class="col-md-6">
                <div class="d-flex align-items-start">
                  <img 
                    v-if="booking.item?.thumbnail" 
                    :src="booking.item.thumbnail" 
                    :alt="booking.item.title"
                    class="rounded me-3"
                    style="width: 80px; height: 60px; object-fit: cover;"
                  />
                  <div>
                    <h6 class="mb-1">{{ booking.item?.title || 'Item' }}</h6>
                    <p class="small text-muted mb-0">
                      <i class="bi bi-geo-alt me-1"></i>
                      {{ booking.item?.location || 'Location' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Booking Details -->
              <div class="col-md-6">
                <div class="row g-2">
                  <div class="col-6">
                    <label class="small text-muted">Check-in</label>
                    <div class="fw-semibold">{{ formatDate(booking.from) }}</div>
                  </div>
                  <div class="col-6">
                    <label class="small text-muted">Check-out</label>
                    <div class="fw-semibold">{{ formatDate(booking.to) }}</div>
                  </div>
                  <div class="col-6">
                    <label class="small text-muted">Guests</label>
                    <div class="fw-semibold">{{ booking.guests }}</div>
                  </div>
                  <div class="col-6">
                    <label class="small text-muted">Nights</label>
                    <div class="fw-semibold">{{ calculateNights(booking.from, booking.to) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <hr class="my-3">

            <!-- Price Breakdown -->
            <div class="row">
              <div class="col-md-8">
                <h6 class="mb-3">Price Breakdown</h6>
                <div class="d-flex justify-content-between small text-secondary mb-2">
                  <span>{{ calculateNights(booking.from, booking.to) }} night(s) × {{ formatPrice(booking.nightlyPrice || 5000) }}</span>
                  <span>{{ formatPrice(booking.subtotal || booking.total * 0.92) }}</span>
                </div>
                <div class="d-flex justify-content-between small text-secondary mb-2">
                  <span>Service fee</span>
                  <span>{{ formatPrice(booking.fees || booking.total * 0.08) }}</span>
                </div>
                <hr class="my-2">
                <div class="d-flex justify-content-between fw-semibold">
                  <span>Total</span>
                  <span>{{ formatPrice(booking.total) }}</span>
                </div>
                <div class="small text-muted mt-2">
                  <i class="bi bi-info-circle me-1"></i>
                  Prices in ₪ incl. VAT (if applicable)
                </div>
              </div>
            </div>
          </div>

          <!-- Payment Section -->
          <div class="card-footer bg-light">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-semibold">{{ formatPrice(booking.total) }}</div>
                <div class="small text-muted">Total amount</div>
              </div>
              <button
                class="btn btn-success btn-lg"
                :disabled="processing"
                @click="confirmPayment"
              >
                <span v-if="processing" class="spinner-border spinner-border-sm me-2" role="status"></span>
                <i v-else class="bi bi-credit-card me-2"></i>
                {{ processing ? 'Processing...' : 'Pay & Confirm' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Success State -->
        <div v-if="confirmed" class="text-center py-5">
          <div class="alert alert-success">
            <i class="bi bi-check-circle-fill me-2"></i>
            <strong>Booking Confirmed!</strong>
            <p class="mb-0 mt-2">Your booking has been successfully confirmed. You'll receive a confirmation email shortly.</p>
          </div>
          <router-link to="/dashboard" class="btn btn-primary">
            <i class="bi bi-house me-2"></i>
            Go to Dashboard
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { getBooking, confirmBooking } from '../services/bookingService'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

// State
const booking = ref(null)
const loading = ref(true)
const error = ref('')
const processing = ref(false)
const confirmed = ref(false)

// Methods
function formatPrice(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  const formatter = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
  return formatter.format(amount / 100)
}

function formatPriceForBackend(amount) {
  // Convert display price to backend format (multiply by 100)
  return Math.round(amount * 100);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(dateString))
}

function calculateNights(from, to) {
  const start = new Date(from)
  const end = new Date(to)
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
}

async function loadBooking() {
  try {
    const bookingId = route.params.bookingId
    booking.value = await getBooking(bookingId)
  } catch (err) {
    error.value = err.message || 'Failed to load booking details'
  } finally {
    loading.value = false
  }
}

async function confirmPayment() {
  if (!booking.value) return
  
  processing.value = true
  error.value = ''
  
  try {
    const result = await confirmBooking(booking.value.bookingId)
    confirmed.value = true
    ui.showToast('Payment successful! Booking confirmed.', 'success')
  } catch (err) {
    error.value = err.message || 'Payment failed. Please try again.'
    ui.showToast(error.value, 'danger')
  } finally {
    processing.value = false
  }
}

// Load booking on mount
onMounted(() => {
  loadBooking()
})
</script>

<style scoped>
.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1.1rem;
}
</style>
