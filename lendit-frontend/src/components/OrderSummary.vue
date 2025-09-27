<script setup>
defineProps({
  title: String,
  location: String,
  pricePerDay: Number,
  quote: { type: Object, default: () => ({ days:0, subtotal:0, fee:0, discount:0, total:0 }) }
})
</script>

<template>
  <div class="card p-3">
    <h2 class="h6 mb-1">{{ title || 'Item' }}</h2>
    <div class="small text-secondary mb-2"><i class="bi bi-geo-alt"></i> {{ location || '—' }}</div>
    <div class="small mb-2">Price: <strong>${{ pricePerDay || '—' }}</strong>/day</div>

    <ul class="list-unstyled small mb-2">
      <li>Days: <strong>{{ quote.days }}</strong></li>
      <li>Subtotal: <strong>${{ quote.subtotal }}</strong></li>
      <li>Service fee: <strong>${{ quote.fee }}</strong></li>
      <li v-if="quote.discount">Discount: <strong>- ${{ quote.discount }}</strong></li>
    </ul>
    <div class="d-flex justify-content-between border-top pt-2">
      <span class="fw-semibold">Total</span>
      <span class="fw-semibold">${{ quote.total }}</span>
    </div>
  </div>
</template>
