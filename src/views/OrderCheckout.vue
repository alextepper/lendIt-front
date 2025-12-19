<script setup>
import { getImageUrl } from '../utils/imageUtils';
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import { useAuthModal } from '../composables/useAuthModal';
import { fetchItem } from '../services/itemService';
import { getQuote, createOrder, mockPayment } from '../services/orderService';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();
const { openLoginModal } = useAuthModal();

// Steps
const step = ref(1); // 1=review, 2=payment, 3=success
const loading = ref(true);
const processing = ref(false);

// Data
const item = ref(null);
const quote = ref(null);
const order = ref(null);
const dateFrom = ref(route.query.from || '');
const dateTo = ref(route.query.to || '');
const itemId = ref(route.query.itemId || '');

// Mock payment mode (set to false to use real Stripe)
const useMockPayment = ref(true);

const days = computed(() => {
  if (!dateFrom.value || dateTo.value) return 0;
  const a = new Date(dateFrom.value);
  const b = new Date(dateTo.value);
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
});

onMounted(async () => {
  // Check auth
  if (!auth.isAuthed) {
    openLoginModal(route.fullPath);
    return;
  }

  // Load data
  try {
    // Load item
    item.value = await fetchItem(itemId.value);
    
    // Get quote
    quote.value = await getQuote(itemId.value, {
      from: dateFrom.value,
      to: dateTo.value,
    });
    
  } catch (error) {
    console.error('Failed to load checkout data:', error);
    ui.showToast(error.response?.data?.message || 'Failed to load checkout', 'danger');
    router.push({ name: 'home' });
  } finally {
    loading.value = false;
  }
});

async function createOrderAndProceed() {
  processing.value = true;
  try {
    // Create order
    order.value = await createOrder({
      itemId: itemId.value,
      from: dateFrom.value,
      to: dateTo.value,
    });

    ui.showToast('Order created successfully', 'success');
    step.value = 2;
  } catch (error) {
    console.error('Failed to create order:', error);
    ui.showToast(error.response?.data?.message || 'Failed to create order', 'danger');
  } finally {
    processing.value = false;
  }
}

async function handlePayment() {
  processing.value = true;
  try {
    if (useMockPayment.value) {
      // Use mock payment (for testing)
      const updatedOrder = await mockPayment(order.value.id);
      
      ui.showToast('Payment successful!', 'success');
      
      // Redirect to success page
      setTimeout(() => {
        router.push({ 
          name: 'checkout-success', 
          query: { orderId: order.value.id } 
        });
      }, 1500);
    } else {
      // Real Stripe payment would go here
      ui.showToast('Stripe integration coming soon', 'info');
    }
  } catch (error) {
    console.error('Payment failed:', error);
    ui.showToast(error.response?.data?.message || 'Payment failed', 'danger');
  } finally {
    processing.value = false;
  }
}

function formatCurrency(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  const currency = item.value?.currency || 'ILS';
  const mainUnit = amount / 100;
  return `${mainUnit.toFixed(2)} ${currency}`;
}

function formatPriceForBackend(amount) {
  // Convert display price to backend format (multiply by 100)
  return Math.round(amount * 100);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
</script>

<template>
  <div class="checkout-page container py-4">
    <!-- Loading -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <!-- Content -->
    <div v-else class="row g-4">
      <!-- Main Content -->
      <div class="col-lg-8">
        <!-- Step 1: Review Order -->
        <div v-if="step === 1" class="card">
          <div class="card-header bg-white">
            <h5 class="mb-0">Review Your Order</h5>
          </div>
          <div class="card-body">
            <!-- Item Info -->
            <div class="d-flex gap-3 mb-4">
              <img
                v-if="item.photos?.[0]"
                :src="getImageUrl(item.photos[0].url)"
                class="rounded"
                width="120"
                height="120"
                style="object-fit: cover;"
              />
              <div>
                <h6 class="mb-1">{{ item.title }}</h6>
                <div class="text-muted small">{{ item.category }}</div>
                <div class="text-muted small mt-2">
                  <i class="bi bi-geo-alt me-1"></i>
                  {{ item.address || item.location }}
                </div>
              </div>
            </div>

            <!-- Rental Dates -->
            <div class="row g-3 mb-4">
              <div class="col-6">
                <label class="small text-muted">Check-in</label>
                <div class="fw-semibold">{{ formatDate(dateFrom) }}</div>
              </div>
              <div class="col-6">
                <label class="small text-muted">Check-out</label>
                <div class="fw-semibold">{{ formatDate(dateTo) }}</div>
              </div>
            </div>

            <!-- Owner Info -->
            <div class="border-top pt-3">
              <label class="small text-muted">Owner</label>
              <div class="fw-semibold">{{ item.owner?.username }}</div>
            </div>
          </div>
          <div class="card-footer bg-white">
            <button 
              class="btn btn-primary w-100"
              :disabled="processing"
              @click="createOrderAndProceed"
            >
              <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-arrow-right me-2"></i>
              Proceed to Payment
            </button>
          </div>
        </div>

        <!-- Step 2: Payment -->
        <div v-if="step === 2" class="card">
          <div class="card-header bg-white">
            <h5 class="mb-0">
              <i class="bi bi-credit-card me-2"></i>
              Payment
            </h5>
          </div>
          <div class="card-body">
            <div class="alert alert-info mb-4">
              <i class="bi bi-info-circle me-2"></i>
              Order #{{ order.id.slice(-8) }} created. Complete payment to confirm your booking.
            </div>

            <!-- Mock Payment Info -->
            <div v-if="useMockPayment" class="alert alert-warning mb-4">
              <i class="bi bi-info-circle me-2"></i>
              <strong>Test Mode:</strong> This is a simulated payment. No real charges will be made.
            </div>

            <!-- Payment Summary -->
            <div class="payment-details mb-4">
              <h6 class="mb-3">Payment Details</h6>
              <div class="d-flex justify-content-between mb-2">
                <span>Rental Total:</span>
                <span class="fw-bold">{{ formatCurrency(quote.total) }}</span>
              </div>
              <div v-if="item.deposit" class="d-flex justify-content-between text-warning mb-2">
                <span>Security Deposit:</span>
                <span class="fw-bold">{{ formatCurrency(item.deposit) }}</span>
              </div>
              <hr>
              <div class="d-flex justify-content-between fs-5 fw-bold">
                <span>Total to Pay:</span>
                <span class="text-success">{{ formatCurrency(quote.total + (item.deposit || 0)) }}</span>
              </div>
            </div>

            <button
              class="btn btn-success w-100 btn-lg"
              :disabled="processing"
              @click="handlePayment"
            >
              <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-check-circle me-2"></i>
              {{ processing ? 'Processing Payment...' : 'Complete Payment' }}
            </button>

            <div class="text-center mt-3 small text-muted">
              <i class="bi bi-shield-check me-1"></i>
              {{ useMockPayment ? 'Simulated secure payment' : 'Secure payment powered by Stripe' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar: Price Summary -->
      <div class="col-lg-4">
        <div class="card position-sticky" style="top: 1rem;">
          <div class="card-header bg-white">
            <h6 class="mb-0">Price Summary</h6>
          </div>
          <div class="card-body">
            <div v-if="quote" class="price-breakdown">
              <div class="d-flex justify-content-between mb-2">
                <span>{{ quote.nights }} nights × {{ formatCurrency(item.pricePerDay) }}</span>
                <span>{{ formatCurrency(quote.nights * item.pricePerDay) }}</span>
              </div>
              
              <div v-if="quote.initialPrice" class="d-flex justify-content-between mb-2">
                <span>Initial fee</span>
                <span>{{ formatCurrency(quote.initialPrice) }}</span>
              </div>

              <div class="d-flex justify-content-between mb-2 text-muted">
                <span>Service fee</span>
                <span>{{ formatCurrency(quote.fees?.total || 0) }}</span>
              </div>

              <hr>

              <div class="d-flex justify-content-between fw-bold mb-3">
                <span>Rental Total</span>
                <span>{{ formatCurrency(quote.total) }}</span>
              </div>

              <div v-if="item.deposit" class="alert alert-warning mb-0">
                <div class="small fw-bold mb-1">
                  <i class="bi bi-shield-check me-1"></i>
                  Security Deposit
                </div>
                <div class="d-flex justify-content-between">
                  <span class="small">Refundable</span>
                  <span class="fw-bold">{{ formatCurrency(item.deposit) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkout-page {
  max-width: 1200px;
}

.card-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.125);
}

.payment-details {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.375rem;
}
</style>

