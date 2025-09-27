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

      <!-- Actual routed content -->
      <ErrorBoundary>
        <router-view />
      </ErrorBoundary>
    </div>
  </main>

  <GlobalToast />
  <GlobalLoader />
</template>

<script setup>
import AppNavbar from './components/AppNavbar.vue'
import GlobalToast from './components/GlobalToast.vue'
import GlobalLoader from './components/GlobalLoader.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
</script>
