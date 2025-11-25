<template>
  <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom">
    <div class="container-fluid container-lg">
      <router-link class="navbar-brand fw-semibold" to="/">{{ $t('app.title') }}</router-link>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navMain">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          <li class="nav-item">
            <router-link class="nav-link" to="/search">
              <i class="bi bi-search"></i> {{ $t('nav.search') }}
            </router-link>
          </li>
          <li v-if="auth.isAuthed" class="nav-item">
            <router-link class="nav-link" to="/my/bookings">
              <i class="bi bi-calendar-check"></i> My Bookings
            </router-link>
          </li>
          <li v-if="auth.isAuthed" class="nav-item">
            <router-link class="nav-link position-relative" to="/messages">
              <i class="bi bi-chat-dots"></i> {{ $t('nav.messages') }}
              <span v-if="chat.unreadTotal" class="position-absolute top-10 start-100 translate-middle badge rounded-pill bg-danger">
                {{ chat.unreadTotal }}
              </span>
            </router-link>
          </li>
        </ul>

        <div class="d-flex align-items-center gap-1 gap-sm-2 navbar-actions">
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
              <span class="d-none d-sm-inline ms-1 text-capitalize">{{ theme.mode }}</span>
            </button>
            <ul class="dropdown-menu theme-dropdown">
              <li><button class="dropdown-item" @click="theme.setMode('auto')"><i class="bi bi-circle-half me-2"></i>Auto</button></li>
              <li><button class="dropdown-item" @click="theme.setMode('light')"><i class="bi bi-brightness-high me-2"></i>Light</button></li>
              <li><button class="dropdown-item" @click="theme.setMode('dark')"><i class="bi bi-moon me-2"></i>Dark</button></li>
            </ul>
          </div>

          <template v-if="!auth.isAuthed">
            <router-link class="btn btn-outline-primary btn-sm" to="/login">{{ $t('nav.login') }}</router-link>
            <router-link class="btn btn-primary btn-sm" to="/register">{{ $t('nav.register') }}</router-link>
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
                  :alt="auth.user?.username || 'User'"
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
                      :alt="auth.user?.name || 'User'"
                      class="rounded-circle me-2 profile-img"
                      width="32" 
                      height="32"
                    />
                    <div>
                      <div class="fw-semibold">{{ auth.user?.username || 'User' }}</div>
                      <small class="text-muted">{{ auth.user?.email || '' }}</small>
                    </div>
                  </div>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <router-link class="dropdown-item" to="/dashboard">
                    <i class="bi bi-person me-2"></i>Profile
                  </router-link>
                </li>
                <li>
                  <router-link class="dropdown-item" to="/dashboard?tab=listings">
                    <i class="bi bi-box-seam me-2"></i>My Listings
                  </router-link>
                </li>
                <li>
                  <router-link class="dropdown-item" to="/settings">
                    <i class="bi bi-gear me-2"></i>Settings
                  </router-link>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <button class="dropdown-item text-danger" @click="auth.logout">
                    <i class="bi bi-box-arrow-right me-2"></i>Logout
                  </button>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { useChatStore } from '../stores/chat'
import { useLanguageStore } from '../stores/language'
import { watch } from 'vue'

const auth = useAuthStore()
const theme = useThemeStore()
const chat = useChatStore()
const language = useLanguageStore()

// Debug language changes
watch(() => language.currentLocale, (newLocale) => {
  console.log('Language changed in navbar:', newLocale)
})
</script>

<style scoped>
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
  padding: 0.375rem 0.5rem;
  min-width: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (min-width: 576px) {
  .navbar-control-btn {
    padding: 0.375rem 0.75rem;
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
  left: auto;
    max-width: calc(100vw - 1rem);
    transform: translateX(0);
}

/* On small screens, position from right to prevent clipping */
@media (max-width: 575.98px) {
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
}

@media (min-width: 576px) {
  .navbar-brand {
    font-size: 1.25rem;
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
}
</style>
