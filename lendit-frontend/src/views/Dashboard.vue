<script setup>
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<template>
  <h1 class="h4 mb-3">Dashboard</h1>
  <div class="alert alert-info">
    <div v-if="auth.user">
      Signed in as <strong>{{ auth.user.name || auth.user.email }}</strong>
    </div>
    <div v-else>Loading profile…</div>
  </div>
</template>
