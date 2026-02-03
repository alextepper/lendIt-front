<template>
  <!-- App Loading Screen -->
  <AppLoadingScreen />

  <AppNavbar />
  <IntroBanner />

  <main class="py-4">
    <div class="container-lg">
      <ErrorBoundary v-slot:fallback="{ error, reset }">
        <div class="alert alert-danger d-flex justify-content-between align-items-start">
          <div>
            <strong>{{ $t('app.oops') }}</strong> {{ String(error?.message || $t('app.unknownError')) }}
          </div>
          <button class="btn btn-sm btn-outline-secondary" @click="reset">{{ $t('app.tryAgain') }}</button>
        </div>
      </ErrorBoundary>

      <!-- Show loading during auth initialization -->
      <div v-if="auth.status === 'initializing'" class="text-center py-5">
        <div class="spinner-border" role="status"></div>
        <div class="small text-secondary mt-2">{{ $t('app.initializing') }}</div>
      </div>

      <!-- Actual routed content -->
      <ErrorBoundary v-else>
        <router-view />
      </ErrorBoundary>
    </div>
  </main>

  <GlobalToast />
  <GlobalLoader />
  <AuthModals />
  <ErrorReportModal ref="errorReportModal" />
</template>

<script setup>
import { watch, onMounted, onBeforeUnmount, ref } from 'vue'
import { useAuthStore } from './stores/auth'
import { useChatStore } from './stores/chat'
import AppNavbar from './components/AppNavbar.vue'
import IntroBanner from './components/IntroBanner.vue'
import AppLoadingScreen from './components/AppLoadingScreen.vue'
import GlobalToast from './components/GlobalToast.vue'
import GlobalLoader from './components/GlobalLoader.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import AuthModals from './components/AuthModals.vue'
import ErrorReportModal from './components/ErrorReportModal.vue'

const auth = useAuthStore()
const chat = useChatStore()
const errorReportModal = ref(null)

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

// Global error handlers
let errorHandler = null
let unhandledRejectionHandler = null

onMounted(() => {
  // Handle uncaught errors
  errorHandler = (event) => {
    console.error('Global error caught:', event.error)
    if (errorReportModal.value) {
      errorReportModal.value.show(event.error || new Error(event.message))
    }
    // Prevent default error display
    event.preventDefault()
  }
  
  // Handle unhandled promise rejections
  unhandledRejectionHandler = (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    if (errorReportModal.value) {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
      errorReportModal.value.show(error)
    }
    // Prevent default error display
    event.preventDefault()
  }
  
  window.addEventListener('error', errorHandler)
  window.addEventListener('unhandledrejection', unhandledRejectionHandler)
})

onBeforeUnmount(() => {
  if (errorHandler) {
    window.removeEventListener('error', errorHandler)
  }
  if (unhandledRejectionHandler) {
    window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
  }
})
</script>
