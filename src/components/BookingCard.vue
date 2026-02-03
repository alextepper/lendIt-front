<template>
  <div class="booking-card">
    <!-- Header -->
    <div class="booking-header">
      <div class="d-flex align-items-center gap-2">
        <div class="booking-icon">
          <i class="bi bi-calendar-check"></i>
        </div>
        <div>
          <h3 class="booking-title">{{ $t('bookingCard.title') }}</h3>
          <p class="booking-subtitle">{{ $t('bookingCard.subtitle') }}</p>
        </div>
      </div>
    </div>

    <!-- Date Selection Section -->
    <div class="booking-section">
      <div class="section-header">
        <i class="bi bi-calendar3 me-2"></i>
        <span>{{ $t('bookingCard.selectDates') }}</span>
      </div>
      
      <div class="date-inputs">
        <div class="date-input-group">
          <label class="date-label">{{ $t('bookingCard.checkIn') }}</label>
          <input
            v-model="startDate"
            type="date"
            :min="minDate"
            :max="maxDate"
            class="date-input"
            :class="{ 'is-invalid': startDateError }"
            @change="onStartDateChange"
          />
          <div v-if="startDateError" class="error-message">{{ startDateError }}</div>
        </div>

        <div class="date-input-group">
          <label class="date-label">{{ $t('bookingCard.checkOut') }}</label>
          <input
            v-model="returnDate"
            type="date"
            :min="startDate || minDate"
            :max="maxDate"
            class="date-input"
            :class="{ 'is-invalid': returnDateError }"
            @change="onReturnDateChange"
          />
          <div v-if="returnDateError" class="error-message">{{ returnDateError }}</div>
        </div>
      </div>

      <!-- Duration Display -->
      <div v-if="selectedDuration" class="duration-card">
        <div class="duration-content">
          <div class="duration-info">
            <i class="bi bi-clock me-2"></i>
            <span class="duration-text">{{ selectedDuration }}</span>
          </div>
          <div v-if="selectedNights < minStay" class="duration-warning">
            <i class="bi bi-exclamation-triangle me-1"></i>
            {{ $t('bookingCard.minNights', { count: minStay }) }}
          </div>
          <div v-if="selectedNights > maxStay" class="duration-error">
            <i class="bi bi-x-circle me-1"></i>
            {{ $t('bookingCard.maxNights', { count: maxStay }) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Special Requests Section -->
    <div class="booking-section">
      <div class="section-header">
        <i class="bi bi-chat-text me-2"></i>
        <span>{{ $t('bookingCard.specialRequests') }}</span>
        <span class="optional-badge">{{ $t('bookingCard.optional') }}</span>
      </div>
      <textarea
        v-model="notes"
        class="notes-input"
        rows="3"
        :placeholder="$t('bookingCard.notesPlaceholder')"
      ></textarea>
    </div>

    <!-- Check Availability Button -->
    <button
      class="check-availability-btn"
      :disabled="!canCheckAvailability || loading"
      @click="checkAvailability"
    >
      <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
      <i v-else class="bi bi-search me-2"></i>
      {{ loading ? $t('bookingCard.checkingAvailability') : $t('bookingCard.checkAvailability') }}
    </button>

    <!-- Error Message -->
    <div v-if="error" class="error-alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ error }}
    </div>

    <!-- Price Breakdown Card -->
    <div v-if="quote" ref="priceBreakdown" class="price-breakdown-card">
      <div class="price-header">
        <h4 class="price-title">
          <i class="bi bi-calculator me-2"></i>
          {{ $t('bookingCard.priceBreakdown') }}
        </h4>
        <div class="price-currency">{{ $t('bookingCard.pricesIn', { currency: props.currency }) }}</div>
      </div>
      
      <div class="price-details">
        <div class="price-line">
          <span class="price-label">{{ quote.nights }} {{ quote.nights === 1 ? $t('bookingCard.night') : $t('bookingCard.nights') }} × {{ formatPrice(quote.nightlyPrice) }}</span>
          <span class="price-value">{{ formatPrice(quote.subtotal) }}</span>
        </div>
        
        <div v-if="quote.fees > 0" class="price-line">
          <span class="price-label">{{ $t('bookingCard.serviceFee') }}</span>
          <span class="price-value">{{ formatPrice(quote.fees) }}</span>
        </div>
        
        <div v-if="quote.discount > 0" class="price-line discount">
          <span class="price-label">{{ $t('bookingCard.discount') }}</span>
          <span class="price-value">-{{ formatPrice(quote.discount) }}</span>
        </div>
        
        <div class="price-divider"></div>
        
        <div class="price-total">
          <span class="total-label">{{ $t('bookingCard.total') }}</span>
          <span class="total-value">{{ formatPrice(quote.total) }}</span>
        </div>
      </div>

      <div class="price-footer">
        <div class="price-note">
          <i class="bi bi-info-circle me-1"></i>
          {{ $t('bookingCard.vatNote') }}
        </div>
      </div>

      <!-- Book Button -->
      <button
        class="book-now-btn"
        :disabled="loading"
        @click="bookItem"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
        <i v-else class="bi bi-check-circle me-2"></i>
        {{ $t('bookingCard.bookNow') }} - {{ formatPrice(quote.total) }}
      </button>
    </div>

    <!-- Unavailable Message -->
    <div v-if="!loading && !quote && hasCheckedAvailability" class="unavailable-alert">
      <i class="bi bi-calendar-x me-2"></i>
      <div>
        <strong>{{ $t('bookingCard.datesUnavailableTitle') }}</strong>
        <p class="mb-0">{{ $t('bookingCard.datesUnavailableBody') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '../stores/ui'
import { fetchUnavailableDates, getQuote, createPendingBooking } from '../services/bookingService'

const props = defineProps({
  itemId: { type: String, required: true },
  pricePerDay: { type: Number, required: true },
  currency: { type: String, default: 'USD' }
})

const emit = defineEmits(['book'])

const ui = useUiStore()
const { t } = useI18n()

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
    return t('bookingCard.errors.startDateFuture')
  }
  
  return ''
})

const returnDateError = computed(() => {
  if (!returnDate.value) return ''
  
  if (startDate.value && returnDate.value <= startDate.value) {
    return t('bookingCard.errors.returnAfterStart')
  }
  
  const selectedDate = new Date(returnDate.value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (selectedDate < today) {
    return t('bookingCard.errors.returnDateFuture')
  }
  
  return ''
})

const selectedDuration = computed(() => {
  if (!startDate.value || !returnDate.value) return null
  
  const start = new Date(startDate.value)
  const end = new Date(returnDate.value)
  const diffMs = end - start
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  return `${diffDays} ${diffDays === 1 ? t('bookingCard.day') : t('bookingCard.days')}`
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
  return Math.round(amount * 100)
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
    error.value = data.message || t('bookingCard.errors.datesUnavailable')
    }
  } catch (err) {
    error.value = err.message || t('bookingCard.errors.failedToGetQuote')
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
    
    ui.showToast(t('bookingCard.messages.bookingCreated'), 'success')
    
    // Navigate to checkout with booking ID
    setTimeout(() => {
      window.location.href = `/checkout/${bookingData.bookingId}`
    }, 1000)
  } catch (err) {
    // Revert optimistic update on error
    quote.value = originalQuote
    error.value = err.message || t('bookingCard.errors.failedToCreateBooking')
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
/* Main Card Container */
.booking-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e8ecf0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.booking-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

/* Header Section */
.booking-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.booking-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.booking-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  backdrop-filter: blur(10px);
}

.booking-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  position: relative;
  z-index: 1;
}

.booking-subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin: 4px 0 0 0;
  position: relative;
  z-index: 1;
}

/* Section Styling */
.booking-section {
  padding: 24px;
  border-bottom: 1px solid #f1f3f4;
}

.booking-section:last-of-type {
  border-bottom: none;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 600;
  color: #2d3748;
  font-size: 16px;
}

.optional-badge {
  background: #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: auto;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Date Inputs */
.date-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.date-input-group {
  position: relative;
}

.date-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.date-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #2d3748;
  background: #ffffff;
  transition: all 0.3s ease;
  cursor: pointer;
  /* iOS Safari fixes */
  -webkit-appearance: none;
  appearance: none;
  min-height: 48px; /* Better touch target on mobile */
  box-sizing: border-box;
}

.date-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  transform: translateY(-1px);
}

.date-input.is-invalid {
  border-color: #e53e3e;
  box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1);
}

/* Duration Card */
.duration-card {
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.duration-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.duration-info {
  display: flex;
  align-items: center;
  color: #2d3748;
  font-weight: 600;
}

.duration-text {
  font-size: 16px;
}

.duration-warning {
  color: #d69e2e;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.duration-error {
  color: #e53e3e;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
}

/* Notes Input */
.notes-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  color: #4a5568;
  background: #ffffff;
  transition: all 0.3s ease;
  resize: vertical;
  min-height: 80px;
}

.notes-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.notes-input::placeholder {
  color: #a0aec0;
}

/* Buttons */
.check-availability-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin: 24px;
  width: calc(100% - 48px);
  position: relative;
  overflow: hidden;
}

.check-availability-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.check-availability-btn:hover::before {
  left: 100%;
}

.check-availability-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.check-availability-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Price Breakdown Card */
.price-breakdown-card {
  margin: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.price-header {
  background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
  color: white;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
}

.price-currency {
  font-size: 12px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.price-details {
  padding: 24px;
}

.price-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}

.price-line.discount {
  color: #38a169;
}

.price-label {
  color: #4a5568;
  font-weight: 500;
}

.price-value {
  color: #2d3748;
  font-weight: 600;
}

.price-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
  margin: 16px 0;
}

.price-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0 8px 0;
  border-top: 2px solid #e2e8f0;
  margin-top: 8px;
}

.total-label {
  font-size: 18px;
  font-weight: 700;
  color: #2d3748;
}

.total-value {
  font-size: 20px;
  font-weight: 800;
  color: #2d3748;
}

.price-footer {
  padding: 0 24px 16px 24px;
}

.price-note {
  font-size: 12px;
  color: #718096;
  display: flex;
  align-items: center;
}

/* Book Now Button */
.book-now-btn {
  width: calc(100% - 48px);
  margin: 0 24px 24px 24px;
  background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.book-now-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(56, 161, 105, 0.3);
}

.book-now-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Alerts */
.error-alert {
  background: #fed7d7;
  color: #c53030;
  padding: 16px 20px;
  border-radius: 12px;
  margin: 24px;
  border-left: 4px solid #e53e3e;
  display: flex;
  align-items: center;
  font-weight: 500;
}

.unavailable-alert {
  background: #fef5e7;
  color: #c05621;
  padding: 20px 24px;
  border-radius: 12px;
  margin: 24px;
  border-left: 4px solid #ed8936;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.unavailable-alert i {
  font-size: 20px;
  margin-top: 2px;
}

/* Error Messages */
.error-message {
  color: #e53e3e;
  font-size: 12px;
  margin-top: 4px;
  font-weight: 500;
}

/* Loading States */
.spinner-border-sm {
  width: 16px;
  height: 16px;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .booking-card {
    margin: 0;
    border-radius: 0;
    box-shadow: none;
    border: none;
  }
  
  .booking-header {
    padding: 20px;
  }
  
  .booking-title {
    font-size: 20px;
  }
  
  .booking-section {
    padding: 20px;
  }
  
  .date-inputs {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .date-input {
    padding: 14px 16px;
    font-size: 16px; /* Prevent iOS zoom on focus */
    min-height: 48px;
    -webkit-appearance: none;
    appearance: none;
  }
  
  .date-label {
    font-size: 12px;
    margin-bottom: 6px;
  }
  
  .duration-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .price-breakdown-card {
    margin: 20px;
  }
  
  .check-availability-btn,
  .book-now-btn {
    margin: 20px;
    width: calc(100% - 40px);
  }
  
  .error-alert,
  .unavailable-alert {
    margin: 20px;
  }
}

@media (max-width: 480px) {
  .booking-header {
    padding: 16px;
  }
  
  .booking-section {
    padding: 16px;
  }
  
  .price-breakdown-card {
    margin: 16px;
  }
  
  .check-availability-btn,
  .book-now-btn {
    margin: 16px;
    width: calc(100% - 32px);
    padding: 14px 20px;
    font-size: 14px;
  }
  
  .error-alert,
  .unavailable-alert {
    margin: 16px;
    padding: 16px;
  }
}
</style>
