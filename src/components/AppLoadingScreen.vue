<template>
  <Transition name="loading-fade">
    <div v-if="show" class="app-loading-screen">
      <div class="loading-content">
        <!-- Animated Logo/Icon -->
        <div class="loading-logo">
          <div class="logo-circle">
            <i class="bi bi-house-heart"></i>
          </div>
        </div>
        
        <!-- Loading Text -->
        <h1 class="loading-title">{{ $t('app.title') || 'Sharo' }}</h1>
        <p class="loading-subtitle">{{ $t('app.tagline') || 'Share what you have' }}</p>
        
        <!-- Animated Spinner -->
        <div class="loading-spinner">
          <div class="spinner-dot"></div>
          <div class="spinner-dot"></div>
          <div class="spinner-dot"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const show = ref(true)
const minDisplayTime = 333 // Minimum 1/3 of a second
const startTime = Date.now()

// Wait for auth initialization and minimum display time
function checkCanHide() {
  const elapsed = Date.now() - startTime
  const remaining = Math.max(0, minDisplayTime - elapsed)
  
  if (auth.initialized && remaining <= 0) {
    show.value = false
  } else if (auth.initialized) {
    // Auth is ready but we need to wait for minimum time
    setTimeout(() => {
      show.value = false
    }, remaining)
  }
}

// Watch for auth initialization
watch(() => auth.initialized, (initialized) => {
  if (initialized) {
    checkCanHide()
  }
})

onMounted(() => {
  // If auth is already initialized, still wait for minimum time
  if (auth.initialized) {
    checkCanHide()
  } else {
    // Wait for minimum time, then check again
    setTimeout(() => {
      checkCanHide()
    }, minDisplayTime)
  }
})
</script>

<style scoped>
.app-loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  overflow: hidden;
}

.loading-content {
  text-align: center;
  color: white;
  animation: fadeInUp 0.6s ease-out;
}

.loading-logo {
  margin-bottom: 2rem;
  animation: pulse 2s ease-in-out infinite;
}

.logo-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  border: 3px solid rgba(255, 255, 255, 0.3);
  animation: rotate 3s linear infinite;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.logo-circle i {
  font-size: 4rem;
  color: white;
  animation: bounce 1.5s ease-in-out infinite;
}

.loading-title {
  font-size: 3rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideInDown 0.8s ease-out 0.2s both;
}

.loading-subtitle {
  font-size: 1.25rem;
  opacity: 0.9;
  margin: 0 0 3rem 0;
  font-weight: 300;
  animation: slideInDown 0.8s ease-out 0.4s both;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  animation: slideInUp 0.8s ease-out 0.6s both;
}

.spinner-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  animation: dotBounce 1.4s ease-in-out infinite;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.spinner-dot:nth-child(1) {
  animation-delay: 0s;
}

.spinner-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.spinner-dot:nth-child(3) {
  animation-delay: 0.4s;
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes dotBounce {
  0%, 80%, 100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  40% {
    transform: translateY(-20px) scale(1.1);
    opacity: 0.8;
  }
}

/* Fade out transition */
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.5s ease-out;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .logo-circle {
    width: 100px;
    height: 100px;
  }
  
  .logo-circle i {
    font-size: 3rem;
  }
  
  .loading-title {
    font-size: 2.5rem;
  }
  
  .loading-subtitle {
    font-size: 1.1rem;
  }
}

@media (max-width: 576px) {
  .logo-circle {
    width: 80px;
    height: 80px;
  }
  
  .logo-circle i {
    font-size: 2.5rem;
  }
  
  .loading-title {
    font-size: 2rem;
  }
  
  .loading-subtitle {
    font-size: 1rem;
  }
  
  .loading-spinner {
    gap: 0.5rem;
  }
  
  .spinner-dot {
    width: 10px;
    height: 10px;
  }
}
</style>

