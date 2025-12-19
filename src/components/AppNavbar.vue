<template>
  <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom app-navbar">
    <div class="container-fluid container">
      <router-link class="navbar-brand" to="/">
        <img src="/logo.png" alt="Sharo" class="navbar-logo" />
      </router-link>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navMain"
        ref="navToggler"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div
        class="collapse navbar-collapse container"
        id="navMain"
        ref="navMain"
        @click="handleNavClick"
      >
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          <li class="nav-item">
            <router-link class="nav-link" to="/search">
              <i class="bi bi-search"></i> {{ $t('nav.search') }}
            </router-link>
          </li>
          <li v-if="auth.isAuthed" class="nav-item ms-3">
            <router-link class="nav-link position-relative" to="/dashboard?tab=booking-requests">
              <i class="bi bi-calendar-check"></i> Booking Requests
              <span v-if="pendingBookingsCount > 0" class="position-absolute top-10 start-0 translate-middle badge rounded-pill bg-warning" style="font-size: 0.7rem; padding: 0.25em 0.5em;">
                {{ pendingBookingsCount > 99 ? '99+' : pendingBookingsCount }}
              </span>
            </router-link>
          </li>
          <li v-if="auth.isAuthed" class="nav-item ms-3">
            <router-link class="nav-link position-relative" to="/messages">
              <i class="bi bi-chat-dots"></i> {{ $t('nav.messages') }}
              <span v-if="chat.unreadTotal > 0" class="position-absolute top-10 start-0 translate-middle badge rounded-pill bg-danger" style="font-size: 0.7rem; padding: 0.25em 0.5em;">
                {{ chat.unreadTotal > 99 ? '99+' : chat.unreadTotal }}
              </span>
            </router-link>
          </li>
        </ul>

        <div class="d-flex align-items-center gap-1 gap-sm-2 navbar-actions">
          <!-- Debug log viewer toggle (dev / ?debugLogs=1 only) -->
          <button
            v-if="debugEnabled"
            class="btn btn-outline-secondary btn-sm navbar-control-btn"
            type="button"
            @click="showDebug = !showDebug"
            title="Show debug logs"
          >
            <i class="bi bi-bug"></i>
          </button>

          <!-- Language switcher -->
          <div class="dropdown">
            <button class="btn btn-outline-secondary btn-sm dropdown-toggle navbar-control-btn" data-bs-toggle="dropdown" aria-expanded="false">
              <!-- <span class="me-1">{{ language.currentLanguage?.flag }}</span> -->
              <span class="d-none d-sm-inline">{{ language.currentLanguage?.name }}</span>
              <i class="bi bi-translate d-sm-none"></i>
            </button>
            <ul class="dropdown-menu language-dropdown">
              <li v-for="lang in language.availableLocales" :key="lang.code">
                <button 
                  class="dropdown-item d-flex align-items-center" 
                  :class="{ active: lang.code === language.currentLocale }"
                  @click="language.setLocale(lang.code)"
                >
                  <!-- <span class="me-2">{{ lang.flag }}</span> -->
                  <span>{{ lang.name }}</span>
                  <i v-if="lang.code === language.currentLocale" class="bi bi-check ms-auto"></i>
                </button>
              </li>
            </ul>
          </div>

          <!-- Theme switcher -->
          <div class="dropdown">
            <button class="btn btn-outline-secondary btn-sm dropdown-toggle navbar-control-btn" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi" :class="{
                'bi-brightness-high': theme.mode === 'light',
                'bi-moon': theme.mode === 'dark',
                'bi-circle-half': theme.mode === 'auto'
              }"></i>
              <span class="d-none d-sm-inline ms-1 me-1 text-capitalize">{{ $t(`nav.theme.${theme.mode}`) }}</span>
            </button>
            <ul class="dropdown-menu theme-dropdown">
              <li><button class="dropdown-item" @click="theme.setMode('auto')"><i class="bi bi-circle-half me-2"></i>{{ $t('nav.theme.auto') }}</button></li>
              <li><button class="dropdown-item" @click="theme.setMode('light')"><i class="bi bi-brightness-high me-2"></i>{{ $t('nav.theme.light') }}</button></li>
              <li><button class="dropdown-item" @click="theme.setMode('dark')"><i class="bi bi-moon me-2"></i>{{ $t('nav.theme.dark') }}</button></li>
            </ul>
          </div>

          <NotificationsBell class="d-none d-sm-inline-flex" />

          <template v-if="!auth.isAuthed">
            <button class="btn btn-outline-primary btn-sm" @click="openLoginModal">{{ $t('nav.login') }}</button>
            <button class="btn btn-primary btn-sm" @click="openRegisterModal">{{ $t('nav.register') }}</button>
          </template>
          <template v-else>
            <!-- User Profile Dropdown -->
            <div class="dropdown">
              <button 
                class="btn btn-link p-0 dropdown-toggle navbar-profile-btn" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
                type="button"
              >
                <img 
                  :src="auth.user?.avatar || 'https://placehold.co/40x40?text=' + (auth.user?.username?.[0] || 'U')" 
                  :alt="auth.user?.username || $t('nav.user')"
                  class="rounded-circle border border-2 border-primary profile-img"
                  width="40" 
                  height="40"
                />
              </button>
              <ul class="dropdown-menu navbar-profile-menu">
                <li class="dropdown-header">
                  <div class="d-flex align-items-center">
                    <img 
                      :src="auth.user?.avatar || 'https://placehold.co/32x32?text=' + (auth.user?.name?.[0] || 'U')" 
                      :alt="auth.user?.name || $t('nav.user')"
                      class="rounded-circle me-2 profile-img"
                      width="32" 
                      height="32"
                    />
                    <div>
                      <div class="fw-semibold">{{ auth.user?.username || $t('nav.user') }}</div>
                      <small class="text-muted">{{ auth.user?.email || '' }}</small>
                    </div>
                  </div>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <router-link class="dropdown-item" to="/dashboard">
                    <i class="bi bi-person me-2"></i>{{ $t('nav.profile') }}
                  </router-link>
                </li>
                <li>
                  <router-link class="dropdown-item" to="/dashboard?tab=listings">
                    <i class="bi bi-box-seam me-2"></i>{{ $t('nav.myListings') }}
                  </router-link>
                </li>
                <li>
                  <router-link class="dropdown-item" to="/settings">
                    <i class="bi bi-gear me-2"></i>{{ $t('nav.settings') }}
                  </router-link>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <button class="dropdown-item text-danger" @click="auth.logout">
                    <i class="bi bi-box-arrow-right me-2"></i>{{ $t('nav.logout') }}
                  </button>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </div>
  </nav>

  <!-- Backdrop for mobile nav / dropdowns -->
  <transition name="navbar-fade">
    <div
      v-if="navOpen"
      class="navbar-backdrop"
      @click="closeNav"
    ></div>
  </transition>

  <!-- Debug log panel -->
  <div v-if="debugEnabled && showDebug" class="debug-log-panel">
    <div class="debug-log-header d-flex align-items-center justify-content-between">
      <span class="fw-semibold">Debug Logs</span>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-secondary" @click="copyLogs">Copy</button>
        <button class="btn btn-sm btn-outline-secondary" @click="debug.clear()">Clear</button>
        <button class="btn btn-sm btn-outline-secondary" @click="showDebug = false">Close</button>
      </div>
    </div>
    <div class="debug-log-body">
      <div
        v-for="log in reversedLogs"
        :key="log.id"
        class="debug-log-entry"
        :class="'debug-log-' + log.level"
      >
        <div class="debug-log-meta">
          <span class="debug-log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
          <span class="debug-log-level text-uppercase ms-2">{{ log.level }}</span>
        </div>
        <pre class="debug-log-message mb-0">{{ log.message }}</pre>
      </div>
      <div v-if="!reversedLogs.length" class="text-muted small p-2">
        No logs captured yet.
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { useChatStore } from '../stores/chat'
import { useLanguageStore } from '../stores/language'
import { useDebugStore } from '../stores/debug'
import { watch, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import NotificationsBell from './NotificationsBell.vue'
import { fetchAllBookings } from '../services/bookingRequestService'
import websocketService from '../services/websocketService'
import { useAuthModal } from '../composables/useAuthModal'

const { t } = useI18n()
const auth = useAuthStore()
const theme = useThemeStore()
const chat = useChatStore()
const language = useLanguageStore()
const debug = useDebugStore()
const { openLoginModal, openRegisterModal } = useAuthModal()

const showDebug = ref(false)
const navOpen = ref(false)
const navMain = ref(null)
const navToggler = ref(null)
const pendingBookingsCount = ref(0)
let bookingsRefreshInterval = null

// Store WebSocket listener callbacks for cleanup
const bookingWebSocketCallbacks = {
  booking_created: null,
  booking_updated: null,
  booking_status_changed: null
}

const debugEnabled = computed(() => {
  if (typeof window === 'undefined') return import.meta.env.DEV

  try {
    const urlHasFlag = window.location.search.includes('debugLogs=1')
    const storedFlag =
      typeof window !== 'undefined' &&
      window.localStorage.getItem('debugLogs') === '1'

    return import.meta.env.DEV || urlHasFlag || storedFlag
  } catch {
    return import.meta.env.DEV
  }
})

const reversedLogs = computed(() => [...debug.logs].reverse())

async function copyLogs() {
  try {
    const text = debug.logs
      .map((log) => {
        const time = new Date(log.timestamp).toISOString()
        return `[${time}] ${log.level.toUpperCase()}: ${log.message}`
      })
      .join('\n')

    if (!text) {
      return
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    console.info('Debug logs copied to clipboard')
  } catch (e) {
    console.error('Failed to copy debug logs', e)
  }
}

function handleNavClick(event) {
  // Only auto-collapse on small screens
  if (typeof window === 'undefined' || window.innerWidth >= 992) return
  if (!navOpen.value) return

  const target = event.target
  if (!target) return

  // Find closest actionable element inside the nav
  const clickable = target.closest('.nav-link, .dropdown-item, .btn')

  if (!clickable) return

  // Don't collapse when clicking dropdown toggles (they manage their own open state)
  if (
    clickable.hasAttribute('data-bs-toggle') &&
    clickable.getAttribute('data-bs-toggle') === 'dropdown'
  ) {
    return
  }

  // For normal nav links / buttons, close the nav (with animation) after click
  closeNav()
}

function closeNav() {
  // If nav isn't open, nothing to do
  if (!navOpen.value) return

  // Clear our open state so backdrop fades out
  navOpen.value = false

  // Prefer to trigger the same behavior as clicking the toggler,
  // so we get the exact same Bootstrap collapse animation.
  if (navToggler.value) {
    const expanded = navToggler.value.getAttribute('aria-expanded') === 'true'
    if (expanded) {
      navToggler.value.click()
      return
    }
  }

  if (!navMain.value) return

  // As a final fallback (if Bootstrap JS isn't active), just hide the collapse without animation
  try {
    navMain.value.classList.remove('show')
    navMain.value.style.height = ''
  } catch (e) {
    console.error('Failed to manually close navbar collapse:', e)
  }
}

onMounted(() => {
  if (!navMain.value || typeof window === 'undefined') return

  const el = navMain.value

  const handleShown = () => {
    navOpen.value = true
  }
  const handleHidden = () => {
    navOpen.value = false
  }

  el.addEventListener('shown.bs.collapse', handleShown)
  el.addEventListener('hidden.bs.collapse', handleHidden)

  // Store handlers on element for cleanup
  el._navShownHandler = handleShown
  el._navHiddenHandler = handleHidden

  // Load conversations if authenticated to get unread count
  if (auth.isAuthed && chat && typeof chat.loadConversations === 'function') {
    // Only load if conversations haven't been loaded yet
    if (!chat.conversations.length) {
      chat.loadConversations().catch(() => {
        // Ignore errors
      })
    }
  }
})

onBeforeUnmount(() => {
  if (!navMain.value) return
  const el = navMain.value
  if (el._navShownHandler) {
    el.removeEventListener('shown.bs.collapse', el._navShownHandler)
  }
  if (el._navHiddenHandler) {
    el.removeEventListener('hidden.bs.collapse', el._navHiddenHandler)
  }
})

// Load pending bookings count
async function loadPendingBookingsCount() {
  if (!auth.isAuthed || !auth.user) {
    pendingBookingsCount.value = 0
    return
  }

  try {
    const response = await fetchAllBookings()
    const bookings = response.bookings || response.items || []
    const userId = auth.user.id

    // Count bookings requiring attention
    const count = bookings.filter(booking => {
      // Check if user is owner and booking needs approval
      const isOwner = booking.role === 'owner' || 
                     booking.ownerId === userId ||
                     booking.item?.ownerId === userId ||
                     booking.item?.owner?.id === userId
      
      // Check if user is renter and booking needs payment
      const isRenter = booking.role === 'renter' ||
                      booking.renterId === userId ||
                      booking.renter?.id === userId ||
                      booking.counterparty?.id === userId

      // Owner needs to approve PENDING_OWNER bookings
      if (isOwner && booking.status === 'PENDING_OWNER') {
        return true
      }

      // Renter needs to pay for AWAITING_PAYMENT bookings
      if (isRenter && booking.status === 'AWAITING_PAYMENT') {
        return true
      }

      return false
    }).length

    pendingBookingsCount.value = count
  } catch (error) {
    console.error('Failed to load pending bookings count:', error)
    pendingBookingsCount.value = 0
  }
}

// Watch for auth changes and load count
watch(() => auth.isAuthed, (isAuthed) => {
  // Clear existing interval
  if (bookingsRefreshInterval) {
    clearInterval(bookingsRefreshInterval)
    bookingsRefreshInterval = null
  }

  if (isAuthed) {
    loadPendingBookingsCount()
    
    // Set up WebSocket listeners for real-time booking updates
    setupBookingWebSocketListeners()
    
    // Fallback: Refresh count every 5 minutes (only when page is visible)
    // This is just a safety net in case WebSocket events are missed
    bookingsRefreshInterval = setInterval(() => {
      if (auth.isAuthed && !document.hidden) {
        loadPendingBookingsCount()
      } else if (!auth.isAuthed) {
        clearInterval(bookingsRefreshInterval)
        bookingsRefreshInterval = null
      }
    }, 300000) // 5 minutes - much less frequent since WebSocket handles real-time updates
    
    // Load chat conversations to get unread count
    if (chat && typeof chat.loadConversations === 'function') {
      // Only load if conversations haven't been loaded yet
      if (!chat.conversations.length) {
        chat.loadConversations().catch(() => {
          // Ignore errors
        })
      }
    }
  } else {
    pendingBookingsCount.value = 0
  }
}, { immediate: true })

// Watch for chat unreadTotal changes to ensure badge updates
watch(() => chat.unreadTotal, (newTotal) => {
  console.log('Chat unreadTotal changed:', newTotal)
  // The badge will automatically update via reactivity
}, { immediate: true })

// Also watch for conversations to be loaded and recalculate unread
watch(() => chat.conversations, (conversations) => {
  console.log('Chat conversations updated, unreadTotal:', chat.unreadTotal)
}, { deep: true })

// Handle page visibility changes - pause polling when tab is hidden
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden - pause polling (interval will check visibility)
      // No need to clear, just let it skip when hidden
    } else {
      // Page is visible - refresh immediately and resume polling
      if (auth.isAuthed) {
        loadPendingBookingsCount()
      }
    }
  })
}

// Cleanup interval and WebSocket listeners on unmount
onBeforeUnmount(() => {
  if (bookingsRefreshInterval) {
    clearInterval(bookingsRefreshInterval)
    bookingsRefreshInterval = null
  }
  
  // Remove WebSocket listeners
  if (bookingWebSocketCallbacks.booking_created) {
    websocketService.off('booking_created', bookingWebSocketCallbacks.booking_created)
  }
  if (bookingWebSocketCallbacks.booking_updated) {
    websocketService.off('booking_updated', bookingWebSocketCallbacks.booking_updated)
  }
  if (bookingWebSocketCallbacks.booking_status_changed) {
    websocketService.off('booking_status_changed', bookingWebSocketCallbacks.booking_status_changed)
  }
})

// Debug language changes
watch(() => language.currentLocale, (newLocale) => {
  console.log('Language changed in navbar:', newLocale)
})
</script>

<style scoped>
/* Navbar always above content */
.app-navbar {
  position: sticky;
  top: 0;
  z-index: 1040; /* Above page content and backdrop */
}

/* Backdrop when navbar is expanded on mobile */
.navbar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1030; /* Below navbar but above page content */
}

/* Backdrop fade animation */
.navbar-fade-enter-active,
.navbar-fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.navbar-fade-enter-from,
.navbar-fade-leave-to {
  opacity: 0;
}

/* Container adjustments for small screens */
.container-fluid.container-lg {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

@media (min-width: 992px) {
  .container-fluid.container-lg {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}

/* Navbar actions container */
.navbar-actions {
  flex-wrap: nowrap;
  min-width: 0; /* Allow flex items to shrink */
}

/* Profile dropdown styling */
.dropdown-toggle::after {
  display: none; /* Hide the default dropdown arrow */
}

.profile-img {
  transition: transform 0.2s ease;
  object-fit: cover;
  object-position: center;
}

.profile-img:hover {
  transform: scale(1.05);
}

/* Control buttons on mobile */
.navbar-control-btn {
  min-width: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (min-width: 576px) {
  .navbar-control-btn {
    min-width: auto;
  }
}

/* Profile button */
.navbar-profile-btn {
  flex-shrink: 0;
}

/* Dropdown menus */
.dropdown-menu {
  min-width: 200px;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.1);
  margin-top: 0.5rem;
}

/* Position dropdowns - center them relative to the button */
.language-dropdown,
.theme-dropdown,
.navbar-profile-menu {
    max-width: calc(100vw - 1rem);
    transform: translateX(0);
}

/* On small screens, position from right to prevent clipping */
@media (max-width: 992px) {
  .language-dropdown,
  .theme-dropdown,
  .navbar-profile-menu {
    left: auto;
    max-width: calc(100vw - 1rem);
    transform: translateX(0);
  }
}

.dropdown-header {
  padding: 0.75rem 1rem;
  background-color: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.dropdown-item {
  padding: 0.5rem 1rem;
  transition: background-color 0.2s ease;
  white-space: nowrap;
}

.dropdown-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dropdown-item.text-danger:hover {
  background-color: rgba(220, 53, 69, 0.1);
  color: #dc3545 !important;
}

/* Navbar brand adjustments */
.navbar-brand {
  font-size: 1.1rem;
  padding: 0.5rem 0;
  display: flex;
  align-items: center;
}

.navbar-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
}

@media (min-width: 576px) {
  .navbar-brand {
    font-size: 1.25rem;
  }
  
  .navbar-logo {
    height: 45px;
  }
}

/* Navbar toggler spacing */
.navbar-toggler {
  margin-left: auto;
  border: none;
  padding: 0.25rem 0.5rem;
}

/* Ensure nav items don't overflow */
.navbar-nav {
  flex-wrap: wrap;
}

@media (max-width: 991.98px) {
  .navbar-nav {
    margin-bottom: 0.5rem;
  }
  
  .navbar-actions {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  /* Make the collapsed menu overlay the page instead of pushing content down */
  .app-navbar {
    position: sticky;
    top: 0;
    z-index: 1040;
  }

  .app-navbar .navbar-collapse {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    width: 100%;
    background-color: var(--bs-body-bg);
    box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.15);
  }
}

/* Debug log panel */
.debug-log-panel {
  position: fixed;
  bottom: 0;
  right: 0;
  width: 100%;
  max-width: 420px;
  max-height: 60vh;
  background-color: #fff;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
  z-index: 1050;
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
}

.debug-log-header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background-color: rgba(0, 0, 0, 0.03);
}

.debug-log-body {
  padding: 0.5rem;
  overflow-y: auto;
}

.debug-log-entry {
  padding: 0.25rem 0.35rem;
  border-radius: 0.25rem;
  margin-bottom: 0.25rem;
}

.debug-log-log {
  background-color: #f8f9fa;
}

.debug-log-warn {
  background-color: #fff3cd;
}

.debug-log-error {
  background-color: #f8d7da;
}

.debug-log-info {
  background-color: #cff4fc;
}

.debug-log-meta {
  font-size: 0.7rem;
  color: #6c757d;
}

.debug-log-message {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
