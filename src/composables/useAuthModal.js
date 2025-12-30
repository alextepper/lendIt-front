import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const showLoginModal = ref(false)
const showRegisterModal = ref(false)
const redirectPath = ref(null)

export function useAuthModal() {
  const router = useRouter()
  const route = useRoute()

  function openLoginModal(redirect = null) {
    // Store the redirect path BEFORE modifying the route
    // Use the provided redirect, or the current path WITHOUT modal query params
    let pathWithoutModal = '/';
    
    // Safely access route - it might not be available in all contexts
    try {
      if (route && route.path) {
        const currentPath = route.path;
        const currentQuery = { ...(route.query || {}) };
        delete currentQuery.modal;
        delete currentQuery.redirect;
        const queryString = new URLSearchParams(currentQuery).toString();
        pathWithoutModal = currentPath + (queryString ? '?' + queryString : '');
      } else {
        // Fallback to window.location if route is not available
        const url = new URL(window.location.href);
        const queryParams = new URLSearchParams(url.search);
        queryParams.delete('modal');
        queryParams.delete('redirect');
        const queryString = queryParams.toString();
        pathWithoutModal = url.pathname + (queryString ? '?' + queryString : '') + (url.hash || '');
      }
    } catch (e) {
      // Fallback if route access fails
      console.warn('[useAuthModal] Failed to get current route, using window.location:', e);
      pathWithoutModal = window.location.pathname + window.location.search + window.location.hash;
    }
    
    redirectPath.value = redirect || pathWithoutModal;
    showRegisterModal.value = false
    showLoginModal.value = true
    
    // Update URL without navigation - safely access route
    try {
      if (route && router) {
        const query = { ...(route.query || {}), modal: 'login' }
        if (redirectPath.value) {
          query.redirect = redirectPath.value
        }
        router.replace({ query })
      }
    } catch (e) {
      console.warn('[useAuthModal] Failed to update route, continuing anyway:', e);
    }
  }

  function openRegisterModal(redirect = null) {
    // Store the redirect path BEFORE modifying the route
    // Use the provided redirect, or the current path WITHOUT modal query params
    const currentPath = route.path;
    const currentQuery = { ...route.query };
    delete currentQuery.modal;
    delete currentQuery.redirect;
    const queryString = new URLSearchParams(currentQuery).toString();
    const pathWithoutModal = currentPath + (queryString ? '?' + queryString : '');
    
    redirectPath.value = redirect || pathWithoutModal;
    showLoginModal.value = false
    showRegisterModal.value = true
    // Update URL without navigation
    const query = { ...route.query, modal: 'register' }
    if (redirectPath.value) {
      query.redirect = redirectPath.value
    }
    router.replace({ query })
  }

  function closeModals() {
    showLoginModal.value = false
    showRegisterModal.value = false
    redirectPath.value = null
    // Remove modal and redirect from query, but stay on current path
    try {
      if (route && router) {
        const query = { ...(route.query || {}) }
        delete query.modal
        delete query.redirect
        // Explicitly use current path to prevent any redirects
        if (route.path) {
          router.replace({ path: route.path, query })
        } else {
          router.replace({ query })
        }
      }
    } catch (e) {
      console.warn('[useAuthModal] Failed to close modals, continuing anyway:', e);
    }
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
      // Use redirect from query if available, otherwise get path without modal params
      if (route.query.redirect) {
        redirectPath.value = route.query.redirect
      } else {
        // Get current path without modal query params
        const currentPath = route.path;
        const currentQuery = { ...route.query };
        delete currentQuery.modal;
        delete currentQuery.redirect;
        const queryString = new URLSearchParams(currentQuery).toString();
        redirectPath.value = currentPath + (queryString ? '?' + queryString : '');
      }
    } else if (route.query.modal === 'register') {
      showRegisterModal.value = true
      showLoginModal.value = false
      // Use redirect from query if available, otherwise get path without modal params
      if (route.query.redirect) {
        redirectPath.value = route.query.redirect
      } else {
        // Get current path without modal query params
        const currentPath = route.path;
        const currentQuery = { ...route.query };
        delete currentQuery.modal;
        delete currentQuery.redirect;
        const queryString = new URLSearchParams(currentQuery).toString();
        redirectPath.value = currentPath + (queryString ? '?' + queryString : '');
      }
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

