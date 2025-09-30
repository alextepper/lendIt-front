<template>
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="h3 mb-0">My Rental History</h1>
      <router-link to="/search" class="btn btn-primary">
        <i class="bi bi-search me-2"></i>
        Find Items to Rent
      </router-link>
    </div>

    <!-- Use UserHistory component -->
    <UserHistory />
  </div>
</template>

<script setup>
import UserHistory from '../components/UserHistory.vue'
</script>

