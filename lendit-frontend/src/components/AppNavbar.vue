<template>
  <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom">
    <div class="container">
      <router-link class="navbar-brand fw-semibold" to="/">LendIt</router-link>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navMain">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          <li class="nav-item">
            <router-link class="nav-link" to="/search">
              <i class="bi bi-search"></i> Search
            </router-link>
          </li>
          <li v-if="auth.isAuthed" class="nav-item">
            <router-link class="nav-link position-relative" to="/messages">
              <i class="bi bi-chat-dots"></i> Messages
              <span v-if="chat.unreadTotal" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                {{ chat.unreadTotal }}
              </span>
            </router-link>
          </li>
        </ul>

        <div class="d-flex align-items-center gap-2">
          <!-- Theme switcher -->
          <div class="dropdown">
            <button class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi" :class="{
                'bi-brightness-high': theme.mode === 'light',
                'bi-moon': theme.mode === 'dark',
                'bi-circle-half': theme.mode === 'auto'
              }"></i>
              <span class="d-none d-sm-inline ms-1 text-capitalize">{{ theme.mode }}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><button class="dropdown-item" @click="theme.setMode('auto')"><i class="bi bi-circle-half me-2"></i>Auto</button></li>
              <li><button class="dropdown-item" @click="theme.setMode('light')"><i class="bi bi-brightness-high me-2"></i>Light</button></li>
              <li><button class="dropdown-item" @click="theme.setMode('dark')"><i class="bi bi-moon me-2"></i>Dark</button></li>
            </ul>
          </div>

          <template v-if="!auth.isAuthed">
            <router-link class="btn btn-outline-primary" to="/login">Sign in</router-link>
            <router-link class="btn btn-primary" to="/register">Sign up</router-link>
          </template>
          <template v-else>
            <span class="text-secondary small">Hi, {{ auth.user?.name || 'User' }}</span>
            <router-link class="btn btn-outline-primary" to="/dashboard"><i class="bi bi-person"></i></router-link>
            <button class="btn btn-outline-danger" @click="auth.logout"><i class="bi bi-box-arrow-right"></i></button>
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
const auth = useAuthStore()
const theme = useThemeStore()
const chat = useChatStore()
</script>
