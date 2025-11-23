<script setup>
import { reactive, computed } from 'vue'
const emit = defineEmits(['pay'])
const form = reactive({ method:'card', card_number:'', expiry:'', cvc:'', accept:false, coupon:'' })
const canPay = computed(() => {
  if (!form.accept) return false
  if (form.method === 'card') {
    return /^\d{12,19}$/.test(form.card_number.replace(/\s/g,'')) && /^\d{2}\/\d{2}$/.test(form.expiry) && /^\d{3,4}$/.test(form.cvc)
  }
  return true
})
function submit(){ if (canPay.value) emit('pay', { ...form }) }
</script>

<template>
  <div class="card p-3">
    <h2 class="h6 mb-3">Payment</h2>

    <div class="mb-2">
      <label class="form-label">Payment method</label>
      <select v-model="form.method" class="form-select">
        <option value="card">Credit/Debit Card</option>
        <option value="fail">Test Failure</option>
      </select>
    </div>

    <div v-if="form.method==='card'" class="row g-2">
      <div class="col-12">
        <label class="form-label">Card number</label>
        <input v-model="form.card_number" class="form-control" placeholder="4242 4242 4242 4242" />
      </div>
      <div class="col-6">
        <label class="form-label">Expiry (MM/YY)</label>
        <input v-model="form.expiry" class="form-control" placeholder="12/27" />
      </div>
      <div class="col-6">
        <label class="form-label">CVC</label>
        <input v-model="form.cvc" class="form-control" placeholder="123" />
      </div>
    </div>

    <div class="mt-3">
      <label class="form-label">Coupon</label>
      <input v-model="form.coupon" class="form-control" placeholder="SAVE10" />
    </div>

    <div class="form-check mt-3">
      <input class="form-check-input" type="checkbox" v-model="form.accept" id="accept">
      <label class="form-check-label" for="accept">
        I agree to the <a href="#">terms</a> and <a href="#">policy</a>.
      </label>
    </div>

    <button class="btn btn-primary w-100 mt-3" :disabled="!canPay" @click="submit">
      Pay now
    </button>
  </div>
</template>
