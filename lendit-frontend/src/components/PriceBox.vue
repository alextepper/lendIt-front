<script setup>
import { computed, reactive, watch } from 'vue';
const props = defineProps({
  pricePerDay: { type: Number, required: true },
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
const subtotal = computed(() => days.value * props.pricePerDay);
const fee = computed(() => Math.round(subtotal.value * 0.08));
const total = computed(() => subtotal.value + fee.value);
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

function submit() {
  if (!valid.value) return;
  emit('request', { ...form, days: days.value, total: total.value });
}
</script>

<template>
  <div class="card p-3">
    <div class="d-flex align-items-baseline justify-content-between">
      <div>
        <span class="fs-5 fw-semibold">${{ pricePerDay }}</span
        ><span class="text-secondary">/day</span>
      </div>
    </div>

    <div class="row g-2 mt-2">
      <div class="col-6">
        <label class="form-label small">From</label>
        <input v-model="form.date_from" type="date" class="form-control" />
      </div>
      <div class="col-6">
        <label class="form-label small">To</label>
        <input v-model="form.date_to" type="date" class="form-control" />
      </div>
    </div>

    <div class="mt-2 small text-secondary" v-if="days">
      {{ days }} day(s) × ${{ pricePerDay }} = ${{ subtotal }}
    </div>
    <div class="d-flex justify-content-between small text-secondary">
      <span>Service fee</span><span>${{ fee }}</span>
    </div>
    <div class="d-flex justify-content-between fw-semibold border-top pt-2 mt-2">
      <span>Total</span><span>${{ total }}</span>
    </div>

    <button class="btn btn-primary w-100 mt-3" :disabled="!valid" @click="submit">
      Request to rent
    </button>
  </div>
</template>
