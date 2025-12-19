<template>
  <!-- App Loading Screen -->
  <AppLoadingScreen />

  <AppNavbar />

  <main class="py-4">
    <div class="container-lg">
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
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from './stores/auth'
import { useChatStore } from './stores/chat'
import AppNavbar from './components/AppNavbar.vue'
import AppLoadingScreen from './components/AppLoadingScreen.vue'
import GlobalToast from './components/GlobalToast.vue'
import GlobalLoader from './components/GlobalLoader.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'

const auth = useAuthStore()
const chat = useChatStore()

// Initialize chat when auth is initialized and user is authenticated
watch(() => [auth.initialized, auth.isAuthed], ([initialized, isAuthed]) => {
  if (initialized && isAuthed) {
    // Load conversations and connect WebSocket
    chat.loadConversations()
      .catch(() => {
        // Ignore chat loading errors
      })
      .finally(() => chat.connectWebSocket())
  } else if (initialized && !isAuthed) {
    // Disconnect if user is not authenticated
    chat.disconnectWebSocket()
  }
}, { immediate: true })

// Initialize WebSocket when user is authenticated (for cases where auth state changes after initialization)
watch(() => auth.isAuthed, (isAuthed) => {
  if (isAuthed && auth.initialized) {
    console.log('User authenticated, connecting WebSocket...')
    chat.connectWebSocket()
  } else if (!isAuthed) {
    console.log('User not authenticated, disconnecting WebSocket...')
    chat.disconnectWebSocket()
  }
})

// Disconnect WebSocket on unmount
onBeforeUnmount(() => {
  chat.disconnectWebSocket()
})
</script>
