<script setup>
const model = defineModel({ type: String, default: 'profile' }); // 'profile' | 'listings' | 'rentals'
</script>

<template>
  <ul class="nav nav-tabs mb-3">
    <li class="nav-item">
      <button class="nav-link" :class="{ active: model === 'profile' }" @click="model = 'profile'">
        <i class="bi bi-person"></i> Profile
      </button>
    </li>
    <li class="nav-item">
      <button class="nav-link" :class="{ active: model === 'listings' }" @click="model = 'listings'">
        <i class="bi bi-box-seam"></i> My Listings
      </button>
    </li>
    <li class="nav-item">
      <button class="nav-link" :class="{ active: model === 'rentals' }" @click="model = 'rentals'">
        <i class="bi bi-bag-check"></i> My Rentals
      </button>
    </li>
  </ul>
</template>
