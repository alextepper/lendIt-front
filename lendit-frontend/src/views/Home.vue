<script setup>
import { useUiStore } from '../stores/ui'
const ui = useUiStore()

async function fakeAction() {
  ui.setLoading(true)
  await new Promise(r => setTimeout(r, 1200))
  ui.setLoading(false)
  ui.showToast('Demo action completed', 'success')
}
</script>

<template>
  <div class="py-4">
    <h1 class="h3 mb-3">Welcome to LendIt</h1>
    <p class="text-secondary">Rent and lend tools, consoles, and more.</p>
    <div class="d-flex gap-2">
      <router-link class="btn btn-primary" :to="{ name: 'search', query: { q: 'drill' } }">
        <i class="bi bi-search"></i> Start searching
      </router-link>
      <button class="btn btn-outline-secondary" @click="fakeAction">
        Try demo loader & toast
      </button>
    </div>
  </div>
</template>
