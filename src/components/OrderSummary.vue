<script setup>
defineProps({
  title: String,
  location: String,
  pricePerDay: Number,
  quote: { type: Object, default: () => ({ days:0, subtotal:0, fee:0, discount:0, total:0 }) }
})

function formatPrice(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount / 100)
}
</script>

<template>
  <div class="card p-3">
    <h2 class="h6 mb-1">{{ title || 'Item' }}</h2>
    <div class="small text-secondary mb-2"><i class="bi bi-geo-alt"></i> {{ location || '—' }}</div>
    <div class="small mb-2">Price: <strong>{{ formatPrice(pricePerDay || 0) }}</strong>/day</div>

    <ul class="list-unstyled small mb-2">
      <li>Days: <strong>{{ quote.days }}</strong></li>
      <li>Subtotal: <strong>{{ formatPrice(quote.subtotal) }}</strong></li>
      <li>Service fee: <strong>{{ formatPrice(quote.fee) }}</strong></li>
      <li v-if="quote.discount">Discount: <strong>- {{ formatPrice(quote.discount) }}</strong></li>
    </ul>
    <div class="d-flex justify-content-between border-top pt-2">
      <span class="fw-semibold">Total</span>
      <span class="fw-semibold">{{ formatPrice(quote.total) }}</span>
    </div>
  </div>
</template>
