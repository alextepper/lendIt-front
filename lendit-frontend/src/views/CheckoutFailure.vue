<script setup>
import { useRoute, RouterLink } from 'vue-router'
const route = useRoute()
</script>

<template>
  <div class="text-center py-5">
    <div class="display-6 text-danger"><i class="bi bi-x-circle"></i></div>
    <h1 class="h4 mt-2">Payment failed</h1>
    <p class="text-secondary">Order #{{ route.query.order }} could not be completed.</p>
    <RouterLink class="btn btn-outline-primary me-2" to="/checkout">Try again</RouterLink>
    <RouterLink class="btn btn-secondary" to="/">Back home</RouterLink>
  </div>
</template>
