<template>
  <AppNavbar />

  <main class="py-4">
    <div class="container">
      <ErrorBoundary v-slot:fallback="{ error, reset }">
        <div class="alert alert-danger d-flex justify-content-between align-items-start">
          <div>
            <strong>Oops!</strong> {{ String(error?.message || 'Unknown error') }}
          </div>
          <button class="btn btn-sm btn-outline-secondary" @click="reset">Try again</button>
        </div>
      </ErrorBoundary>

      <!-- Show loading during auth initialization -->
      <div v-if="auth.status === 'initializing'" class="text-center py-5">
        <div class="spinner-border" role="status"></div>
        <div class="small text-secondary mt-2">Initializing...</div>
      </div>

      <!-- Actual routed content -->
      <ErrorBoundary v-else>
        <router-view />
      </ErrorBoundary>
    </div>
  </main>

  <GlobalToast />
  <GlobalLoader />
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import AppNavbar from './components/AppNavbar.vue'
import GlobalToast from './components/GlobalToast.vue'
import GlobalLoader from './components/GlobalLoader.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'

const auth = useAuthStore()
</script>
