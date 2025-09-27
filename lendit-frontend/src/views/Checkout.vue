<script setup>
import { reactive, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CheckoutSteps from '../components/CheckoutSteps.vue'
import OrderSummary from '../components/OrderSummary.vue'
import CheckoutDetailsForm from '../components/CheckoutDetailsForm.vue'
import PaymentForm from '../components/PaymentForm.vue'
import { quoteOrder, createOrder, payOrder } from '../services/checkoutService'
import { useUiStore } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

// Step state
const step = ref(1)
const busy = ref(false)
const error = ref(null)

// Inputs (prefilled from query sent by Item.vue)
const input = reactive({
  item_id: Number(route.query.id) || null,
  title: route.query.title || '', // optional if you pass it
  location: route.query.location || '',
  date_from: route.query.date_from || '',
  date_to: route.query.date_to || ''
})
const details = ref({ name:'', phone:'', method:'pickup', address:'' })
const quote = ref({ days:0, subtotal:0, fee:0, discount:0, total:0, price_per_day: undefined })
const orderId = ref(null)

// Re-quote whenever dates/coupon change
async function runQuote(coupon) {
  if (!input.item_id || !input.date_from || !input.date_to) return
  busy.value = true; error.value = null
  try {
    quote.value = await quoteOrder({
      item_id: input.item_id,
      date_from: input.date_from,
      date_to: input.date_to,
      coupon
    })
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally { busy.value = false }
}

onMounted(() => { if (input.item_id) runQuote() })

function nextFromDates() {
  if (!input.date_from || !input.date_to) { ui.showToast('Please select dates', 'warning'); return }
  step.value = 2
}

async function nextFromDetails() {
  if (!details.value.name || !details.value.phone) { ui.showToast('Please fill contact info', 'warning'); return }
  busy.value = true; error.value = null
  try {
    const { order_id } = await createOrder({
      item_id: input.item_id,
      date_from: input.date_from,
      date_to: input.date_to,
      contact: { name: details.value.name, phone: details.value.phone },
      delivery: { method: details.value.method, address: details.value.address }
    })
    orderId.value = order_id
    step.value = 3
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally { busy.value = false }
}

async function onPay(payload) {
  // payload: { method, card_number, expiry, cvc, accept, coupon }
  await runQuote(payload.coupon) // re-quote with coupon before pay
  if (!orderId.value) return
  busy.value = true; error.value = null
  try {
    const res = await payOrder(orderId.value, payload.method, {
      card_number: payload.card_number, expiry: payload.expiry, cvc: payload.cvc
    })
    if (res.status === 'success') {
      router.replace({ name:'checkout-success', query: { order: orderId.value, total: quote.value.total } })
    } else {
      router.replace({ name:'checkout-failure', query: { order: orderId.value } })
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally { busy.value = false }
}
</script>

<template>
  <h1 class="h4 mb-3">Checkout</h1>
  <CheckoutSteps :step="step" />

  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div class="row g-3">
    <div class="col-12 col-lg-8">
      <!-- Step 1: Dates -->
      <div v-show="step===1" class="card p-3">
        <h2 class="h6 mb-3">Choose dates</h2>
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label">From</label>
            <input v-model="input.date_from" type="date" class="form-control" @change="runQuote()" />
          </div>
          <div class="col-6">
            <label class="form-label">To</label>
            <input v-model="input.date_to" type="date" class="form-control" @change="runQuote()" />
          </div>
        </div>
        <div class="mt-3 d-flex justify-content-end">
          <button class="btn btn-primary" @click="nextFromDates" :disabled="busy">Continue</button>
        </div>
      </div>

      <!-- Step 2: Details -->
      <div v-show="step===2" class="d-flex flex-column gap-3">
        <CheckoutDetailsForm v-model="details" />
        <div class="d-flex justify-content-between">
          <button class="btn btn-outline-secondary" @click="step=1">Back</button>
          <button class="btn btn-primary" :disabled="busy" @click="nextFromDetails">
            <span v-if="busy" class="spinner-border spinner-border-sm me-2"></span>
            Continue to payment
          </button>
        </div>
      </div>

      <!-- Step 3: Payment -->
      <div v-show="step===3" class="d-flex flex-column gap-3">
        <PaymentForm @pay="onPay" />
        <button class="btn btn-outline-secondary" @click="step=2">Back</button>
      </div>
    </div>

    <div class="col-12 col-lg-4">
      <OrderSummary
        :title="input.title"
        :location="input.location"
        :price-per-day="quote.price_per_day"
        :quote="quote"
      />
      <div v-if="busy" class="small text-secondary mt-2">Updating…</div>
    </div>
  </div>
</template>
