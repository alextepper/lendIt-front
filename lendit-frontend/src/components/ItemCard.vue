<script setup>
defineProps({
  item: { type: Object, required: true },
});

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
  <div class="card h-100">
    <div class="ratio ratio-16x9 bg-light">
      <img
        v-if="item.thumbnail"
        :src="item.thumbnail"
        class="w-100 h-100 object-fit-cover"
        :alt="item.title"
      />
    </div>
    <div class="card-body">
      <h3 class="h6 card-title mb-1 text-truncate">{{ item.title }}</h3>
      <div class="small text-secondary d-flex justify-content-between align-items-center mb-1">
        <span>{{ item.location }}</span>
        <span>{{ item.category }}</span>
      </div>
      <div v-if="item.distance" class="small text-primary mb-1">
        <i class="bi bi-geo-alt-fill me-1"></i>
        {{ item.distance.toFixed(1) }} km away
      </div>
      <div class="d-flex align-items-center justify-content-between mt-2">
        <span class="fw-semibold">{{ formatPrice(item.pricePerDay || item.price_per_day) }}/day</span>
        <span class="small">
          <i class="bi bi-star-fill me-1"></i>{{ item.rating ?? '—' }}
          <span class="text-secondary">({{ item.reviews_count ?? 0 }})</span>
        </span>
      </div>
      <router-link
        class="stretched-link"
        :to="`/item/${item.id}`"
        aria-label="Open item"
      ></router-link>
    </div>
  </div>
</template>
