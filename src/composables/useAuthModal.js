import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const showLoginModal = ref(false)
const showRegisterModal = ref(false)
const redirectPath = ref(null)

export function useAuthModal() {
  const router = useRouter()
  const route = useRoute()

  function openLoginModal(redirect = null) {
    redirectPath.value = redirect || route.fullPath
    showRegisterModal.value = false
    showLoginModal.value = true
    // Update URL without navigation
    const query = { ...route.query, modal: 'login' }
    if (redirect) {
      query.redirect = redirect
    }
    router.replace({ query })
  }

  function openRegisterModal(redirect = null) {
    redirectPath.value = redirect || route.fullPath
    showLoginModal.value = false
    showRegisterModal.value = true
    // Update URL without navigation
    const query = { ...route.query, modal: 'register' }
    if (redirect) {
      query.redirect = redirect
    }
    router.replace({ query })
  }

  function closeModals() {
    showLoginModal.value = false
    showRegisterModal.value = false
    redirectPath.value = null
    // Remove modal and redirect from query, but stay on current path
    const query = { ...route.query }
    delete query.modal
    delete query.redirect
    // Explicitly use current path to prevent any redirects
    router.replace({ path: route.path, query })
  }

  function switchToRegister() {
    showLoginModal.value = false
    showRegisterModal.value = true
    const query = { ...route.query, modal: 'register' }
    router.replace({ query })
  }

  function switchToLogin() {
    showRegisterModal.value = false
    showLoginModal.value = true
    const query = { ...route.query, modal: 'login' }
    router.replace({ query })
  }

  // Check URL on mount/route change
  function syncWithRoute() {
    if (route.query.modal === 'login') {
      showLoginModal.value = true
      showRegisterModal.value = false
      redirectPath.value = route.query.redirect || route.fullPath
    } else if (route.query.modal === 'register') {
      showRegisterModal.value = true
      showLoginModal.value = false
      redirectPath.value = route.query.redirect || route.fullPath
    } else {
      showLoginModal.value = false
      showRegisterModal.value = false
    }
  }

  return {
    showLoginModal,
    showRegisterModal,
    redirectPath,
    openLoginModal,
    openRegisterModal,
    closeModals,
    switchToRegister,
    switchToLogin,
    syncWithRoute
  }
}

