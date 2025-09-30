<template>
  <div class="card p-3">
    <h3 class="h6 mb-3">Book this item</h3>
    
    <!-- Date Range Picker -->
    <!-- Start Date -->
    <div class="mb-3">
      <label class="form-label">Start Date</label>
      <input
        v-model="startDate"
        type="date"
        :min="minDate"
        :max="maxDate"
        class="form-control"
        :class="{ 'is-invalid': startDateError }"
        @change="onStartDateChange"
      />
      <div v-if="startDateError" class="invalid-feedback d-block">{{ startDateError }}</div>
    </div>

    <!-- Return Date -->
    <div class="mb-3">
      <label class="form-label">Return Date</label>
      <input
        v-model="returnDate"
        type="date"
        :min="startDate || minDate"
        :max="maxDate"
        class="form-control"
        :class="{ 'is-invalid': returnDateError }"
        @change="onReturnDateChange"
      />
      <div v-if="returnDateError" class="invalid-feedback d-block">{{ returnDateError }}</div>
    </div>

    <!-- Duration Display -->
    <div v-if="selectedDuration" class="duration-display mb-3 small">
      <div class="d-flex align-items-center justify-content-between">
        <div class="text-primary">
          <i class="bi bi-clock me-1"></i>
          <strong>Duration:</strong> {{ selectedDuration }}
        </div>
        <div v-if="selectedNights < minStay" class="text-warning">
          <i class="bi bi-exclamation-triangle me-1"></i>
          Min {{ minStay }} night{{ minStay !== 1 ? 's' : '' }}
        </div>
        <div v-if="selectedNights > maxStay" class="text-danger">
          <i class="bi bi-x-circle me-1"></i>
          Max {{ maxStay }} night{{ maxStay !== 1 ? 's' : '' }}
        </div>
      </div>
    </div>

    <!-- Guests Input -->
    <!-- <div class="mb-3">
      <label class="form-label">Guests (optional)</label>
      <input
        v-model.number="guests"
        type="number"
        min="1"
        max="10"
        class="form-control"
        placeholder="Number of guests"
      />
    </div> -->

    <!-- Notes Input -->
    <div class="mb-3">
      <label class="form-label">Special requests (optional)</label>
      <textarea
        v-model="notes"
        class="form-control"
        rows="2"
        placeholder="Any special requests or notes for the owner..."
      ></textarea>
    </div>

    <!-- Check Availability Button -->
    <button
      class="btn btn-primary w-100 mb-3"
      :disabled="!canCheckAvailability || loading"
      @click="checkAvailability"
    >
      <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
      {{ loading ? 'Checking...' : 'Check Availability & Quote' }}
    </button>

    <!-- Error Message -->
    <div v-if="error" class="alert alert-danger mb-3">
      {{ error }}
    </div>

    <!-- Price Breakdown Card -->
    <div v-if="quote" ref="priceBreakdown" class="card bg-light p-3 mb-3">
      <h6 class="card-title mb-3">Price Breakdown</h6>
      
      <div class="d-flex justify-content-between small text-secondary mb-2">
        <span>{{ quote.nights }} night(s) × {{ formatPrice(quote.nightlyPrice) }}</span>
        <span>{{ formatPrice(quote.subtotal) }}</span>
      </div>
      
      <div v-if="quote.fees > 0" class="d-flex justify-content-between small text-secondary mb-2">
        <span>Service fee</span>
        <span>{{ formatPrice(quote.fees) }}</span>
      </div>
      
      <div v-if="quote.discount > 0" class="d-flex justify-content-between small text-success mb-2">
        <span>Discount</span>
        <span>-{{ formatPrice(quote.discount) }}</span>
      </div>
      
      <hr class="my-2">
      
      <div class="d-flex justify-content-between fw-semibold mb-2">
        <span>Total</span>
        <span>{{ formatPrice(quote.total) }}</span>
      </div>

      <div class="small text-muted">
        <i class="bi bi-info-circle me-1"></i>
        Prices in ₪ incl. VAT (if applicable)
      </div>

      <!-- Book Button -->
      <button
        class="btn btn-success w-100 mt-3"
        :disabled="loading"
        @click="bookItem"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
        Book Now - {{ formatPrice(quote.total) }}
      </button>
    </div>

    <!-- Unavailable Message -->
    <div v-if="!loading && !quote && hasCheckedAvailability" class="alert alert-warning">
      <i class="bi bi-exclamation-triangle me-2"></i>
      Those dates are unavailable. Try different dates.
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useUiStore } from '../stores/ui'
import { fetchUnavailableDates, getQuote, createPendingBooking } from '../services/bookingService'

const props = defineProps({
  itemId: { type: String, required: true },
  pricePerDay: { type: Number, required: true },
  currency: { type: String, default: 'USD' }
})

const emit = defineEmits(['book'])

const ui = useUiStore()

// State
const startDate = ref('')
const returnDate = ref('')
const guests = ref(1)
const notes = ref('')
const loading = ref(false)
const error = ref('')
const quote = ref(null)
const unavailableDates = ref([])
const hasCheckedAvailability = ref(false)
const priceBreakdown = ref(null)
const minStay = ref(1)
const maxStay = ref(30)

// Date constraints
const minDate = ref(new Date().toISOString().split('T')[0])
const maxDate = ref(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

// Computed
const canCheckAvailability = computed(() => {
  return startDate.value && returnDate.value && !loading.value
})

const startDateError = computed(() => {
  if (!startDate.value) return ''
  
  const selectedDate = new Date(startDate.value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (selectedDate < today) {
    return 'Start date must be in the future'
  }
  
  return ''
})

const returnDateError = computed(() => {
  if (!returnDate.value) return ''
  
  if (startDate.value && returnDate.value <= startDate.value) {
    return 'Return date must be after start date'
  }
  
  const selectedDate = new Date(returnDate.value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (selectedDate < today) {
    return 'Return date must be in the future'
  }
  
  return ''
})

const selectedDuration = computed(() => {
  if (!startDate.value || !returnDate.value) return null
  
  const start = new Date(startDate.value)
  const end = new Date(returnDate.value)
  const diffMs = end - start
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
})

const selectedNights = computed(() => {
  if (!startDate.value || !returnDate.value) return 0
  const start = new Date(startDate.value)
  const end = new Date(returnDate.value)
  const diffMs = end - start
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
})


const currentMonthDisplay = computed(() => {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'long'
  }).format(currentMonth.value)
})

// Methods
function formatPrice(amount) {
  // Use ILS (₪) for Israeli locale
  const formatter = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
  return formatter.format(amount / 100) // Assuming backend sends amounts in cents
}

function formatDateForAPI(date) {
  // Convert to Asia/Jerusalem timezone and format as ISO date
  const jerusalemDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}))
  return jerusalemDate.toISOString().split('T')[0]
}

function formatDateDisplay(date) {
  // Format date for display in Hebrew locale
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function formatDateTimeDisplay(date) {
  // Format date and time for display in Hebrew locale
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Hebrew locale configuration for date picker
const hebrewLocale = {
  name: 'he',
  weekdays: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  weekdaysShort: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
  weekdaysMin: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
  months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
  monthsShort: ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'],
  weekStart: 0,
  yearStart: 4,
  formats: {
    LT: 'HH:mm',
    LTS: 'HH:mm:ss',
    L: 'DD/MM/YYYY',
    LL: 'D MMMM YYYY',
    LLL: 'D MMMM YYYY HH:mm',
    LLLL: 'dddd, D MMMM YYYY HH:mm'
  }
}

async function loadUnavailableDates(month = null) {
  try {
    const targetMonth = month || currentMonth.value
    const year = targetMonth.getFullYear()
    const monthStr = String(targetMonth.getMonth() + 1).padStart(2, '0')
    
    const data = await fetchUnavailableDates(props.itemId, `${year}-${monthStr}`)
    unavailableDates.value = data.unavailableDates || []
  } catch (err) {
    console.warn('Failed to load unavailable dates:', err)
  }
}

function previousMonth() {
  const newMonth = new Date(currentMonth.value)
  newMonth.setMonth(newMonth.getMonth() - 1)
  currentMonth.value = newMonth
  loadUnavailableDates(newMonth)
}

function nextMonth() {
  const newMonth = new Date(currentMonth.value)
  newMonth.setMonth(newMonth.getMonth() + 1)
  currentMonth.value = newMonth
  loadUnavailableDates(newMonth)
}

function onStartDateChange(newDate) {
  if (newDate) {
    // Reset quote when dates change
    quote.value = null
    hasCheckedAvailability.value = false
    error.value = ''
    
    // If return date is before new start date, clear it
    if (returnDate.value && returnDate.value <= newDate) {
      returnDate.value = ''
    }
  }
}

function onReturnDateChange(newDate) {
  if (newDate) {
    // Reset quote when dates change
    quote.value = null
    hasCheckedAvailability.value = false
    error.value = ''
  }
}

async function checkAvailability() {
  if (!canCheckAvailability.value || startDateError.value || returnDateError.value) return
  
  loading.value = true
  error.value = ''
  quote.value = null
  hasCheckedAvailability.value = true
  
  try {
    const from = startDate.value
    const to = returnDate.value
    
    const data = await getQuote(props.itemId, {
      from,
      to,
      guests: guests.value
    })
    
    if (data.available) {
      quote.value = {
        nights: data.nights,
        nightlyPrice: data.nightlyPrice,
        subtotal: data.subtotal,
        fees: data.fees,
        discount: data.discount || 0,
        total: data.total,
        currency: data.currency || 'ILS',
        vatIncluded: data.vatIncluded || false
      }
      
      // Auto-scroll to price breakdown
      setTimeout(() => {
        if (priceBreakdown.value) {
          priceBreakdown.value.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          })
        }
      }, 100)
    } else {
      error.value = data.message || 'Those dates are unavailable. Try different dates.'
    }
  } catch (err) {
    error.value = err.message || 'Failed to get quote'
    hasCheckedAvailability.value = false
  } finally {
    loading.value = false
  }
}

async function bookItem() {
  if (!quote.value) return
  
  const originalQuote = { ...quote.value }
  const originalStartDate = startDate.value
  const originalReturnDate = returnDate.value
  
  // Optimistic UI update
  loading.value = true
  error.value = ''
  quote.value = null // Clear quote to show loading state
  
  try {
    const bookingData = await createPendingBooking({
      itemId: props.itemId,
      from: startDate.value,
      to: returnDate.value,
      guests: guests.value,
      notes: notes.value.trim() || undefined,
      quote: originalQuote
    })
    
    ui.showToast('Booking created! Redirecting to checkout...', 'success')
    
    // Navigate to checkout with booking ID
    setTimeout(() => {
      window.location.href = `/checkout/${bookingData.bookingId}`
    }, 1000)
  } catch (err) {
    // Revert optimistic update on error
    quote.value = originalQuote
    error.value = err.message || 'Failed to create booking'
    ui.showToast(error.value, 'danger')
  } finally {
    loading.value = false
  }
}

// Watch for date changes to clear quote and update nights count
watch([startDate, returnDate], () => {
  if (quote.value) {
    quote.value = null
    hasCheckedAvailability.value = false
  }
})

// Load unavailable dates on mount
onMounted(() => {
  loadUnavailableDates()
})
</script>

<style scoped>
/* Duration display styling */
.duration-display {
  background-color: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 0.375rem;
  padding: 0.5rem;
}

/* Error states */
.is-invalid {
  border-color: #dc3545 !important;
}

.invalid-feedback {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* Loading states */
.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Quote section styling */
.quote-section {
  border-top: 1px solid #dee2e6;
  padding-top: 1rem;
}

/* DatePicker Wrapper */
.date-picker-wrapper {
  position: relative;
  width: 100%;
  z-index: 1000;
}

/* Vue DatePicker Styles */
:deep(.vue-datepicker) {
  width: 100%;
  position: relative;
  z-index: 1000;
}

/* Ensure the datepicker container doesn't clip the calendar */
.card {
  overflow: visible;
  position: relative;
  z-index: 1;
}

/* Ensure sticky sidebar doesn't interfere with datepicker */
.sticky-top {
  overflow: visible;
  position: relative;
  z-index: 1;
}

/* Calendar positioning - targeting actual mx-datepicker classes */
:deep(.mx-datepicker-main) {
  position: fixed !important;
  z-index: 999999 !important;
  background: white !important;
  border: 1px solid #dee2e6 !important;
  border-radius: 0.375rem !important;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.25) !important;
  max-height: 300px;
  overflow-y: auto;
  transform: translateZ(0) !important;
  will-change: transform !important;
}

:deep(.mx-datepicker-popup) {
  position: fixed !important;
  z-index: 999999 !important;
  background: white !important;
  border: 1px solid #dee2e6 !important;
  border-radius: 0.375rem !important;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.25) !important;
  max-height: 300px;
  overflow-y: auto;
  transform: translateZ(0) !important;
  will-change: transform !important;
}

:deep(.mx-calendar) {
  position: relative !important;
  z-index: 999999 !important;
  background: white !important;
}


:deep(.vue-datepicker .vue-datepicker__input) {
  width: 100%;
  padding: 0.375rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
  background-color: #fff;
  font-size: 1rem;
  line-height: 1.5;
  color: #212529;
}

:deep(.vue-datepicker .vue-datepicker__input:focus) {
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

:deep(.vue-datepicker.is-invalid .vue-datepicker__input) {
  border-color: #dc3545;
}

:deep(.vue-datepicker.is-invalid .vue-datepicker__input:focus) {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.25rem rgba(220, 53, 69, 0.25);
}

/* DatePicker Calendar Styles */
:deep(.vue-datepicker__calendar) {
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  background: white !important;
  border: 1px solid #dee2e6 !important;
  border-radius: 0.375rem !important;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
  margin-top: 0.25rem !important;
  max-height: 300px;
  overflow-y: auto;
}

:deep(.vue-datepicker__calendar-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

:deep(.vue-datepicker__calendar-body) {
  padding: 0.5rem;
}

:deep(.vue-datepicker__calendar-item) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0.125rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

:deep(.vue-datepicker__calendar-item:hover) {
  background-color: #e9ecef;
}

:deep(.vue-datepicker__calendar-item--selected) {
  background-color: #0d6efd;
  color: white;
}

:deep(.vue-datepicker__calendar-item--disabled) {
  background-color: #f8f9fa;
  color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

:deep(.vue-datepicker__calendar-item--disabled:hover) {
  background-color: #f8f9fa;
  color: #6c757d;
}

/* Calendar styling for disabled dates (existing bookings) */
:deep(.vue-datepicker .vue-datepicker__calendar .vue-datepicker__calendar-item--disabled) {
  background-color: #f8f9fa !important;
  color: #6c757d !important;
  cursor: not-allowed !important;
  opacity: 0.6;
}

:deep(.vue-datepicker .vue-datepicker__calendar .vue-datepicker__calendar-item--disabled:hover) {
  background-color: #f8f9fa !important;
  color: #6c757d !important;
}

/* Selected range highlighting */
:deep(.vue-datepicker .vue-datepicker__calendar .vue-datepicker__calendar-item--in-range) {
  background-color: #e3f2fd !important;
  color: #1976d2 !important;
}

:deep(.vue-datepicker .vue-datepicker__calendar .vue-datepicker__calendar-item--range-start),
:deep(.vue-datepicker .vue-datepicker__calendar .vue-datepicker__calendar-item--range-end) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold;
}

/* Month navigation buttons */
.month-nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.month-nav-btn:hover:not(:disabled) {
  background-color: #e9ecef;
  transform: scale(1.05);
}

.month-nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Enhanced error states */
.invalid-feedback {
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.text-warning {
  color: #f0ad4e !important;
}

.text-danger {
  color: #d9534f !important;
}

/* Loading states */
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}

/* Date labels styling */
.date-labels {
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  padding: 0.5rem;
  border: 1px solid #e9ecef;
}

/* Nights count styling */
.nights-display {
  background-color: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 0.375rem;
  padding: 0.5rem;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .card {
    margin-bottom: 1rem;
  }
  
  .month-nav-btn {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }
  
  :deep(.vue-datepicker) {
    font-size: 0.9rem;
  }
  
  .d-flex.justify-content-between {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
