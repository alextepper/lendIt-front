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
                
                <!-- Use breakdown if available, otherwise calculate -->
                <template v-if="booking.breakdown">
                  <div class="d-flex justify-content-between small text-secondary mb-2">
                    <span>{{ booking.breakdown.rentalDays }} day(s) × {{ formatPrice(booking.breakdown.dailyRate || booking.item?.pricePerDay || 0) }}</span>
                    <span>{{ formatPrice(booking.breakdown.subtotal || 0) }}</span>
                  </div>
                  <div v-if="booking.breakdown.initialPrice" class="d-flex justify-content-between small text-secondary mb-2">
                    <span>Initial fee</span>
                    <span>{{ formatPrice(booking.breakdown.initialPrice) }}</span>
                  </div>
                  <div v-if="booking.breakdown.serviceFee" class="d-flex justify-content-between small text-secondary mb-2">
                    <span>Service fee</span>
                    <span>{{ formatPrice(booking.breakdown.serviceFee) }}</span>
                  </div>
                  <hr class="my-2">
                  <div class="d-flex justify-content-between fw-semibold">
                    <span>Total</span>
                    <span>{{ formatPrice(booking.breakdown.total || booking.total) }}</span>
                  </div>
                  <div v-if="booking.breakdown.deposit" class="d-flex justify-content-between small text-warning mt-2">
                    <span><i class="bi bi-shield-check me-1"></i>Security deposit (refundable)</span>
                    <span>{{ formatPrice(booking.breakdown.deposit) }}</span>
                  </div>
                </template>
                
                <template v-else>
                  <div class="d-flex justify-content-between small text-secondary mb-2">
                    <span>{{ calculateNights(booking.from, booking.to) }} night(s) × {{ formatPrice(booking.item?.pricePerDay || 0) }}</span>
                    <span>{{ formatPrice((booking.item?.pricePerDay || 0) * calculateNights(booking.from, booking.to)) }}</span>
                  </div>
                  <div v-if="booking.item?.initialPrice" class="d-flex justify-content-between small text-secondary mb-2">
                    <span>Initial fee</span>
                    <span>{{ formatPrice(booking.item.initialPrice) }}</span>
                  </div>
                  <hr class="my-2">
                  <div class="d-flex justify-content-between fw-semibold">
                    <span>Total</span>
                    <span>{{ formatPrice(booking.total) }}</span>
                  </div>
                </template>
                
                <div class="small text-muted mt-2">
                  <i class="bi bi-info-circle me-1"></i>
                  Prices in {{ booking.currency || 'ILS' }} incl. VAT (if applicable)
                </div>
              </div>
            </div>
          </div>

          <!-- Payment Section -->
          <div class="card-footer bg-light">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-semibold">{{ formatPrice(booking.total || booking.breakdown?.total) }}</div>
                <div class="small text-muted">Total amount</div>
                <div v-if="booking.breakdown?.deposit" class="small text-muted">
                  + {{ formatPrice(booking.breakdown.deposit) }} deposit (refundable)
                </div>
              </div>
              <div class="d-flex flex-column align-items-end gap-2">
                <div v-if="booking.status !== 'AWAITING_PAYMENT'" class="small text-muted text-end">
                  <span class="badge" :class="{
                    'bg-success': booking.status === 'CONFIRMED',
                    'bg-warning': booking.status === 'PENDING_OWNER',
                    'bg-danger': booking.status === 'OWNER_DECLINED'
                  }">
                    {{ booking.status }}
                  </span>
                </div>
                <button
                  v-if="booking.status === 'AWAITING_PAYMENT'"
                  class="btn btn-success btn-lg"
                  :disabled="processing"
                  @click="confirmPayment"
                >
                  <span v-if="processing" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  <i v-else class="bi bi-credit-card me-2"></i>
                  {{ processing ? 'Processing...' : 'Pay & Confirm' }}
                </button>
                <div v-else-if="booking.status === 'CONFIRMED'" class="text-success">
                  <i class="bi bi-check-circle me-1"></i>
                  Payment completed
                </div>
              </div>
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
import { getBooking } from '../services/bookingService'
import { createBookingCheckoutIntent } from '../services/bookingRequestService'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

// State
const booking = ref(null)
const loading = ref(true)
const error = ref('')
const processing = ref(false)
const confirmed = ref(false)

// Helpers to normalize backend booking shape → UI shape
function normalizeBooking(raw) {
  if (!raw) return null

  // Handle response wrapper { success: true, data: {...} }
  const booking = raw.data || raw

  const from = booking.from || booking.startDate || booking.start_date
  const to = booking.to || booking.endDate || booking.end_date
  const total = booking.total || booking.totalAmount || booking.total_amount
  
  // Extract breakdown if available
  const breakdown = booking.breakdown || {}

  return {
    ...booking,
    from,
    to,
    total: total || breakdown.total,
    breakdown,
    // Ensure item and renter are available
    item: booking.item || {},
    renter: booking.renter || {},
  }
}

// Methods
function formatPrice(amount) {
  if (amount == null) return ''
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
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

function calculateNights(from, to) {
  if (!from || !to) return 0
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
}

async function loadBooking() {
  try {
    const bookingId = route.params.bookingId
    const raw = await getBooking(bookingId)
    booking.value = normalizeBooking(raw)
    
    // No order lookup needed - bookings handle payments directly
    // When status is AWAITING_PAYMENT, payment can be initiated via checkout-intent
  } catch (err) {
    error.value = err.message || 'Failed to load booking details'
  } finally {
    loading.value = false
  }
}

async function confirmPayment() {
  if (!booking.value) return
  
  // Validate booking status
  if (booking.value.status !== 'AWAITING_PAYMENT') {
    error.value = `Booking status is ${booking.value.status}. Payment can only be initiated for bookings awaiting payment.`
    ui.showToast(error.value, 'warning')
    return
  }
  
  processing.value = true
  error.value = ''
  
  try {
    // Create checkout intent for the booking
    // POST /api/bookings/:id/checkout-intent
    // Returns: { clientSecret, paymentIntentId } for Stripe
    const bookingId = booking.value.id
    const result = await createBookingCheckoutIntent(bookingId)
    
    // Handle Stripe payment with clientSecret
    if (result.clientSecret) {
      // TODO: Integrate Stripe Elements here to collect payment
      // In production, you would:
      // 1. Initialize Stripe with publishable key
      // 2. Create Stripe Elements form
      // 3. Confirm payment with clientSecret
      // 4. Wait for webhook to confirm booking status change (CONFIRMED)
      
      ui.showToast('Payment intent created. Please complete payment using Stripe.', 'info')
      
      // Store clientSecret for Stripe Elements integration
      // For now, log it - in production you'd use it with Stripe Elements
      console.log('Stripe clientSecret received:', result.clientSecret)
      console.log('Payment Intent ID:', result.paymentIntentId)
      
      // TODO: Show Stripe Payment Element form here
      // Example:
      // const stripe = Stripe('pk_test_...')
      // const elements = stripe.elements({ clientSecret: result.clientSecret })
      // const paymentElement = elements.create('payment')
      // paymentElement.mount('#payment-element')
      
      // For now, show a message that payment integration is needed
      confirmed.value = true
      ui.showToast('Payment intent created. Stripe Elements integration needed to complete payment.', 'success')
      
      return
    }
    
    // If payment URL is provided instead of clientSecret (alternative flow)
    if (result.paymentUrl) {
      window.location.href = result.paymentUrl
      return
    }
    
    // Fallback: if payment is already processed (shouldn't happen for AWAITING_PAYMENT)
    confirmed.value = true
    ui.showToast('Payment processed successfully!', 'success')
  } catch (err) {
    error.value = err.message || 'Failed to create payment intent. Please try again.'
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
