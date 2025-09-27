<script setup>
defineProps({
  item: { type: Object, required: true },
});
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
      <div class="small text-secondary d-flex justify-content-between">
        <span>{{ item.location }}</span>
        <span>{{ item.category }}</span>
      </div>
      <div class="d-flex align-items-center justify-content-between mt-2">
        <span class="fw-semibold">${{ item.price_per_day }}/day</span>
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
