<script setup>
import { computed, reactive, watch } from 'vue';
const props = defineProps({
  pricePerDay: { type: Number, required: true },
  initialPrice: { type: Number, default: 0 },
  deposit: { type: Number, default: 0 },
  currency: { type: String, default: 'ILS' },
});
const emit = defineEmits(['request']);
const form = reactive({ date_from: '', date_to: '' });
const days = computed(() => {
  if (!form.date_from || !form.date_to) return 0;
  const a = new Date(form.date_from);
  const b = new Date(form.date_to);
  const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
});
const subtotal = computed(() => {
  const daily = days.value * props.pricePerDay;
  return daily + (props.initialPrice || 0);
});
const fee = computed(() => Math.round(subtotal.value * 0.08));
const total = computed(() => subtotal.value + fee.value + (props.deposit || 0));
const valid = computed(() => days.value > 0);

watch(
  () => [form.date_from, form.date_to],
  () => {
    // ensure from <= to visually
    if (form.date_from && form.date_to && new Date(form.date_from) >= new Date(form.date_to)) {
      form.date_to = '';
    }
  }
);

function formatPrice(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount / 100)
}

function submit() {
  if (!valid.value) return;
  emit('request', { ...form, days: days.value, total: total.value });
}
</script>

<template>
  <div class="card p-3">
    <div class="mb-3">
      <div class="fs-5 fw-semibold">{{ formatPrice(pricePerDay) }}<span class="text-secondary fs-6">/day</span></div>
      <div v-if="initialPrice" class="small text-muted mt-1">
        <i class="bi bi-info-circle me-1"></i>Initial fee: {{ formatPrice(initialPrice) }}
      </div>
      <div v-if="deposit" class="small text-muted">
        <i class="bi bi-shield-check me-1"></i>Deposit: {{ formatPrice(deposit) }}
      </div>
    </div>

    <div class="row g-2">
      <div class="col-6">
        <label class="form-label small">From</label>
        <input v-model="form.date_from" type="date" class="form-control" />
      </div>
      <div class="col-6">
        <label class="form-label small">To</label>
        <input v-model="form.date_to" type="date" class="form-control" />
      </div>
    </div>

    <div v-if="days" class="mt-3 border-top pt-3">
      <div class="d-flex justify-content-between small text-secondary mb-1">
        <span>{{ days }} day(s) × {{ formatPrice(pricePerDay) }}</span>
        <span>{{ formatPrice(days * pricePerDay) }}</span>
      </div>
      <div v-if="initialPrice" class="d-flex justify-content-between small text-secondary mb-1">
        <span>Initial fee</span>
        <span>{{ formatPrice(initialPrice) }}</span>
      </div>
      <div class="d-flex justify-content-between small text-secondary mb-1">
        <span>Service fee (8%)</span>
        <span>{{ formatPrice(fee) }}</span>
      </div>
      <div v-if="deposit" class="d-flex justify-content-between small text-warning mb-1">
        <span>Security deposit</span>
        <span>{{ formatPrice(deposit) }}</span>
      </div>
    </div>

    <div class="d-flex justify-content-between fw-semibold border-top pt-2 mt-2">
      <span>Total</span>
      <span>{{ formatPrice(total) }}</span>
    </div>
    <div v-if="deposit" class="small text-muted mt-1">
      <i class="bi bi-info-circle me-1"></i>Deposit will be refunded after return
    </div>

    <button class="btn btn-primary w-100 mt-3" :disabled="!valid" @click="submit">
      Request to rent
    </button>
  </div>
</template>
