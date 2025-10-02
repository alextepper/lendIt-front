<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { getQuote } from '../services/orderService';
import { checkBookingAvailability } from '../services/itemService';

const props = defineProps({
  item: { type: Object, required: true },
});

const emit = defineEmits(['close', 'booking-created']);

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();

// Form state
const step = ref(1); // 1=dates, 2=quote, 3=confirm
const loading = ref(false);
const dateFrom = ref('');
const dateTo = ref('');
const quote = ref(null);
const availabilityError = ref('');

// Computed
const days = computed(() => {
  if (!dateFrom.value || !dateTo.value) return 0;
  const a = new Date(dateFrom.value);
  const b = new Date(dateTo.value);
  const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
});

const canProceed = computed(() => {
  return dateFrom.value && dateTo.value && days.value > 0 && !availabilityError.value;
});

const minDate = computed(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
});

const minToDate = computed(() => {
  if (!dateFrom.value) return minDate.value;
  const from = new Date(dateFrom.value);
  from.setDate(from.getDate() + 1);
  return from.toISOString().split('T')[0];
});

// Watch dates for validation
watch([dateFrom, dateTo], async ([from, to]) => {
  availabilityError.value = '';
  
  if (from && to && from < to) {
    try {
      const result = await checkBookingAvailability(props.item.id, from, to);
      if (!result.available) {
        availabilityError.value = 'Selected dates are not available';
        if (result.unavailableRanges?.length > 0) {
          const range = result.unavailableRanges[0];
          availabilityError.value += `. Conflict: ${range.from} to ${range.to}`;
        }
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
    }
  }
});

async function getQuoteData() {
  if (!canProceed.value) return;
  
  loading.value = true;
  try {
    quote.value = await getQuote(props.item.id, {
      from: dateFrom.value,
      to: dateTo.value,
    });
    step.value = 2;
  } catch (error) {
    console.error('Failed to get quote:', error);
    ui.showToast(error.response?.data?.message || 'Failed to get price quote', 'danger');
  } finally {
    loading.value = false;
  }
}

function formatCurrency(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  const currency = props.item.currency || 'ILS';
  const mainUnit = amount / 100;
  return `${mainUnit.toFixed(2)} ${currency}`;
}

function formatPriceForBackend(amount) {
  // Convert display price to backend format (multiply by 100)
  return Math.round(amount * 100);
}

function goBack() {
  if (step.value === 2) {
    step.value = 1;
    quote.value = null;
  }
}

function proceedToCheckout() {
  // Navigate to checkout page with order details
  router.push({
    name: 'checkout',
    query: {
      itemId: props.item.id,
      from: dateFrom.value,
      to: dateTo.value,
    }
  });
  emit('close');
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateRange(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  const fromFormatted = fromDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  
  const toFormatted = toDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  return `${fromFormatted} - ${toFormatted}`;
}
</script>

<template>
  <div class="booking-flow">
    <!-- Step 1: Date Selection -->
    <div v-if="step === 1" class="flow-step">
      <!-- Header -->
      <div class="step-header">
        <div class="step-icon">
          <i class="bi bi-calendar3"></i>
        </div>
        <div class="step-info">
          <h3 class="step-title">Select Your Dates</h3>
          <p class="step-subtitle">Choose your rental period and get an instant quote</p>
        </div>
      </div>

      <!-- Date Selection -->
      <div class="date-selection">
        <div class="date-inputs">
          <div class="date-input-group">
            <label class="date-label">Check-in Date</label>
            <input 
              v-model="dateFrom" 
              type="date" 
              class="date-input"
              :min="minDate"
            />
          </div>
          <div class="date-input-group">
            <label class="date-label">Check-out Date</label>
            <input 
              v-model="dateTo" 
              type="date" 
              class="date-input"
              :min="minToDate"
              :disabled="!dateFrom"
            />
          </div>
        </div>

        <!-- Duration Display -->
        <div v-if="days > 0" class="duration-card">
          <div class="duration-content">
            <div class="duration-info">
              <i class="bi bi-clock me-2"></i>
              <span class="duration-text">{{ days }} day{{ days !== 1 ? 's' : '' }}</span>
            </div>
            <div class="duration-dates">
              {{ formatDateRange(dateFrom, dateTo) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div v-if="availabilityError" class="error-alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ availabilityError }}
      </div>

      <!-- Price Preview -->
      <div v-if="days > 0 && !availabilityError" class="price-preview-card">
        <div class="preview-header">
          <h4 class="preview-title">
            <i class="bi bi-calculator me-2"></i>
            Price Preview
          </h4>
        </div>
        
        <div class="preview-details">
          <div class="preview-line">
            <span class="preview-label">{{ days }} day(s) × {{ formatCurrency(props.item.pricePerDay) }}</span>
            <span class="preview-value">{{ formatCurrency(days * props.item.pricePerDay) }}</span>
          </div>
          
          <div v-if="props.item.initialPrice" class="preview-line">
            <span class="preview-label">Initial fee</span>
            <span class="preview-value">{{ formatCurrency(props.item.initialPrice) }}</span>
          </div>
          
          <div class="preview-line">
            <span class="preview-label">Service fee (est. 8%)</span>
            <span class="preview-value">~{{ formatCurrency(Math.round((days * props.item.pricePerDay + (props.item.initialPrice || 0)) * 0.08)) }}</span>
          </div>
          
          <div v-if="props.item.deposit" class="preview-line deposit">
            <span class="preview-label">
              <i class="bi bi-shield-check me-1"></i>
              Security deposit
            </span>
            <span class="preview-value">{{ formatCurrency(props.item.deposit) }}</span>
          </div>

          <div class="preview-divider"></div>

          <div class="preview-total">
            <span class="preview-total-label">Total to Pay</span>
            <span class="preview-total-value">
              {{ formatCurrency((days * props.item.pricePerDay + (props.item.initialPrice || 0)) + Math.round((days * props.item.pricePerDay + (props.item.initialPrice || 0)) * 0.08) + (props.item.deposit || 0)) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="step-actions">
        <button class="cancel-btn" @click="emit('close')">
          <i class="bi bi-x-lg me-2"></i>
          Cancel
        </button>
        <button 
          class="primary-btn" 
          :disabled="!canProceed || loading"
          @click="getQuoteData"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="bi bi-calculator me-2"></i>
          {{ loading ? 'Getting Quote...' : 'Get Price Quote' }}
        </button>
      </div>
    </div>

    <!-- Step 2: Quote Review -->
    <div v-if="step === 2 && quote" class="flow-step">
      <!-- Header -->
      <div class="step-header">
        <div class="step-icon">
          <i class="bi bi-receipt"></i>
        </div>
        <div class="step-info">
          <h3 class="step-title">Review Your Quote</h3>
          <p class="step-subtitle">Confirm your rental details and proceed to checkout</p>
        </div>
      </div>

      <!-- Quote Details -->
      <div class="quote-card">
        <div class="quote-header">
          <h4 class="quote-title">
            <i class="bi bi-calculator me-2"></i>
            Price Breakdown
          </h4>
          <div class="quote-period">
            <span class="period-days">{{ days }} day{{ days !== 1 ? 's' : '' }}</span>
            <span class="period-dates">{{ formatDateRange(dateFrom, dateTo) }}</span>
          </div>
        </div>

        <div class="quote-details">
          <!-- Daily Breakdown -->
          <div v-if="quote.breakdown" class="breakdown-section">
            <div class="breakdown-header">Daily Breakdown</div>
            <div v-for="day in quote.breakdown" :key="day.date" class="breakdown-line">
              <span class="breakdown-date">{{ formatDate(day.date) }}</span>
              <span class="breakdown-price">{{ formatCurrency(day.price) }}</span>
            </div>
          </div>
          <div v-else class="quote-line">
            <span class="quote-label">{{ days }} nights × {{ formatCurrency(props.item.pricePerDay) }}</span>
            <span class="quote-value">{{ formatCurrency(days * props.item.pricePerDay) }}</span>
          </div>

          <div v-if="quote.initialPrice" class="quote-line">
            <span class="quote-label">Initial fee</span>
            <span class="quote-value">{{ formatCurrency(quote.initialPrice) }}</span>
          </div>

          <div v-if="quote.fees" class="quote-line">
            <span class="quote-label">Service fee</span>
            <span class="quote-value">{{ formatCurrency(quote.fees.total) }}</span>
          </div>

          <div class="quote-divider"></div>

          <div class="quote-total">
            <span class="total-label">Rental Total</span>
            <span class="total-value">{{ formatCurrency(quote.total) }}</span>
          </div>

          <div v-if="props.item.deposit" class="deposit-section">
            <div class="deposit-info">
              <i class="bi bi-shield-check me-2"></i>
              <div>
                <div class="deposit-title">Security Deposit</div>
                <div class="deposit-note">Refundable after item return</div>
              </div>
            </div>
            <span class="deposit-amount">{{ formatCurrency(props.item.deposit) }}</span>
          </div>

          <!-- Overall Total -->
          <div class="overall-total-section">
            <div class="overall-total-header">
              <i class="bi bi-credit-card me-2"></i>
              <span>Total Amount to Pay</span>
            </div>
            <div class="overall-total-amount">
              {{ formatCurrency(quote.total + (props.item.deposit || 0)) }}
            </div>
            <div class="overall-total-note">
              Includes rental total + security deposit
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="step-actions">
        <button class="back-btn" @click="goBack">
          <i class="bi bi-arrow-left me-2"></i>
          Back
        </button>
        <button class="checkout-btn" @click="proceedToCheckout">
          <i class="bi bi-credit-card me-2"></i>
          Proceed to Checkout
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Main Container */
.booking-flow {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e8ecf0;
  overflow: hidden;
}

.flow-step {
  padding: 0;
}

/* Step Header */
.step-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  overflow: hidden;
}

.step-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.step-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
}

.step-info {
  position: relative;
  z-index: 1;
}

.step-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.step-subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin: 4px 0 0 0;
}

/* Date Selection */
.date-selection {
  padding: 24px;
  border-bottom: 1px solid #f1f3f4;
}

.date-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
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
}

.date-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  transform: translateY(-1px);
}

.date-input:disabled {
  background-color: #f7fafc;
  color: #a0aec0;
  cursor: not-allowed;
}

/* Duration Card */
.duration-card {
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
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

.duration-dates {
  color: #718096;
  font-size: 14px;
  font-weight: 500;
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

/* Price Preview Card */
.price-preview-card {
  margin: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.preview-header {
  background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
  color: white;
  padding: 16px 20px;
}

.preview-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
}

.preview-details {
  padding: 20px;
}

.preview-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}

.preview-line.deposit {
  color: #d69e2e;
}

.preview-label {
  color: #4a5568;
  font-weight: 500;
}

.preview-value {
  color: #2d3748;
  font-weight: 600;
}

.preview-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
  margin: 16px 0;
}

.preview-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0 8px 0;
  border-top: 2px solid #e2e8f0;
  margin-top: 8px;
}

.preview-total-label {
  font-size: 18px;
  font-weight: 700;
  color: #2d3748;
}

.preview-total-value {
  font-size: 20px;
  font-weight: 800;
  color: #2d3748;
}

/* Quote Card */
.quote-card {
  margin: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.quote-header {
  background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
  color: white;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quote-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
}

.quote-period {
  text-align: right;
}

.period-days {
  display: block;
  font-size: 16px;
  font-weight: 600;
}

.period-dates {
  display: block;
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

.quote-details {
  padding: 24px;
}

.breakdown-section {
  margin-bottom: 16px;
}

.breakdown-header {
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.breakdown-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #f1f3f4;
}

.breakdown-line:last-child {
  border-bottom: none;
}

.breakdown-date {
  color: #718096;
}

.breakdown-price {
  color: #2d3748;
  font-weight: 600;
}

.quote-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}

.quote-label {
  color: #4a5568;
  font-weight: 500;
}

.quote-value {
  color: #2d3748;
  font-weight: 600;
}

.quote-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
  margin: 16px 0;
}

.quote-total {
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

.deposit-section {
  background: #fef5e7;
  border: 1px solid #f6e05e;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.deposit-info {
  display: flex;
  align-items: center;
  color: #c05621;
}

.deposit-title {
  font-weight: 600;
  font-size: 14px;
}

.deposit-note {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

.deposit-amount {
  color: #c05621;
  font-weight: 700;
  font-size: 16px;
}

/* Overall Total Section */
.overall-total-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 16px;
  padding: 24px;
  margin-top: 20px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.overall-total-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.overall-total-header {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.overall-total-amount {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
}

.overall-total-note {
  font-size: 14px;
  opacity: 0.9;
  position: relative;
  z-index: 1;
}

/* Action Buttons */
.step-actions {
  padding: 24px;
  display: flex;
  gap: 12px;
}

.cancel-btn {
  background: #f7fafc;
  color: #4a5568;
  border: 2px solid #e2e8f0;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
}

.cancel-btn:hover {
  background: #edf2f7;
  border-color: #cbd5e0;
  transform: translateY(-1px);
}

.back-btn {
  background: #f7fafc;
  color: #4a5568;
  border: 2px solid #e2e8f0;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
}

.back-btn:hover {
  background: #edf2f7;
  border-color: #cbd5e0;
  transform: translateY(-1px);
}

.primary-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
}

.primary-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.checkout-btn {
  background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
}

.checkout-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(56, 161, 105, 0.3);
}

/* Loading States */
.spinner-border-sm {
  width: 16px;
  height: 16px;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .booking-flow {
    margin: 0;
    border-radius: 0;
    box-shadow: none;
    border: none;
  }
  
  .step-header {
    padding: 20px;
  }
  
  .step-title {
    font-size: 20px;
  }
  
  .date-selection {
    padding: 20px;
  }
  
  .date-inputs {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .duration-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .price-preview-card,
  .quote-card {
    margin: 20px;
  }
  
  .step-actions {
    padding: 20px;
    flex-direction: column;
  }
  
  .primary-btn,
  .checkout-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .step-header {
    padding: 16px;
  }
  
  .date-selection {
    padding: 16px;
  }
  
  .price-preview-card,
  .quote-card {
    margin: 16px;
  }
  
  .step-actions {
    padding: 16px;
  }
}
</style>

