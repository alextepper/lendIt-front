<script setup>
import { useRoute, RouterLink } from 'vue-router'
const route = useRoute()
</script>

<template>
  <div class="text-center py-5">
    <div class="display-6 text-success"><i class="bi bi-check2-circle"></i></div>
    <h1 class="h4 mt-2">Payment successful</h1>
    <p class="text-secondary">Order #{{ route.query.order }} · Total ${{ route.query.total }}</p>
    <RouterLink class="btn btn-primary" to="/dashboard">Go to Dashboard</RouterLink>
  </div>
</template>
