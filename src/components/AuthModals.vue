<template>
  <!-- Login Modal -->
  <template v-if="showLoginModal">
    <div class="modal-backdrop fade show" @click="closeModals"></div>
    <div
      class="modal fade show"
      id="loginModal"
      tabindex="-1"
      :style="{ display: 'block' }"
      @click.self="closeModals"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h5 class="modal-title">{{ $t('auth.login.title') }}</h5>
            <button
              type="button"
              class="btn-close"
              @click="closeModals"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="error" class="alert alert-danger">{{ error }}</div>

            <form @submit.prevent="submit" novalidate>
              <!-- Google Sign In Button -->
              <div class="mb-3">
                <GoogleSignInButton :return-url="redirectPath" />
              </div>
              
              <!-- Divider -->
              <div class="divider mb-3">
                <span class="divider-text">{{ $t('auth.or') }}</span>
              </div>

              <div class="mb-3">
                <label class="form-label">{{ $t('auth.login.email') }}</label>
                <input v-model="loginForm.email" class="form-control" type="email" required />
              </div>
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label mb-0">{{ $t('auth.login.password') }}</label>
                  <router-link
                    :to="{ name: 'request-password-reset' }"
                    class="small text-decoration-none"
                    @click="closeModals"
                  >
                    {{ $t('auth.forgotPassword') }}
                  </router-link>
                </div>
                <input v-model="loginForm.password" class="form-control" type="password" minlength="6" required />
              </div>
              <button class="btn btn-primary w-100" :disabled="submitting" type="submit">
                <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                {{ $t('auth.login.submit') }}
              </button>
            </form>

            <p class="small mt-3 text-center">
              {{ $t('auth.login.noAccount') }}
              <a href="#" @click.prevent="switchToRegister">{{ $t('auth.login.signUp') }}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- Register Modal -->
  <template v-if="showRegisterModal">
    <div class="modal-backdrop fade show" @click="closeModals"></div>
    <div
      class="modal fade show"
      id="registerModal"
      tabindex="-1"
      :style="{ display: 'block' }"
      @click.self="closeModals"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h5 class="modal-title">{{ $t('auth.register.title') }}</h5>
            <button
              type="button"
              class="btn-close"
              @click="closeModals"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="error" class="alert alert-danger">{{ error }}</div>

            <form @submit.prevent="submit" novalidate>
              <!-- Google Sign In Button -->
              <div class="mb-3">
                <GoogleSignInButton
                  :return-url="redirectPath"
                  :disabled="!registerForm.acceptTerms"
                />
              </div>
              
              <!-- Divider -->
              <div class="divider mb-3">
                <span class="divider-text">{{ $t('auth.or') }}</span>
              </div>

              <div class="mb-3">
                <label class="form-label">{{ $t('auth.register.name') }}</label>
                <input v-model="registerForm.name" class="form-control" type="text" required />
              </div>
              <div class="mb-3">
                <label class="form-label">{{ $t('auth.register.email') }}</label>
                <input v-model="registerForm.email" class="form-control" type="email" required />
              </div>
              <div class="mb-3">
                <label class="form-label">{{ $t('auth.register.password') }}</label>
                <input v-model="registerForm.password" class="form-control" type="password" minlength="6" required />
              </div>

              <!-- Terms & Conditions checkbox -->
              <div class="form-check mb-3 small">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="register-accept-terms"
                  v-model="registerForm.acceptTerms"
                />
                <label class="form-check-label" for="register-accept-terms">
                  {{ $t('auth.register.acceptTermsPrefix') }}
                  <a href="/terms" target="_blank" rel="noopener">
                    {{ $t('auth.register.termsLink') }}
                  </a>
                  {{ $t('auth.register.and') }}
                  <a href="/privacy" target="_blank" rel="noopener">
                    {{ $t('auth.register.privacyLink') }}
                  </a>
                </label>
              </div>

              <button class="btn btn-primary w-100" :disabled="submitting || !registerForm.acceptTerms" type="submit">
                <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                {{ $t('auth.register.submit') }}
              </button>
            </form>

            <p class="small mt-3 text-center">
              {{ $t('auth.register.hasAccount') }}
              <a href="#" @click.prevent="switchToLogin">{{ $t('auth.register.signIn') }}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { reactive, ref, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from 'vue-i18n'
import { useAuthModal } from '../composables/useAuthModal'
import GoogleSignInButton from './GoogleSignInButton.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const {
  showLoginModal,
  showRegisterModal,
  redirectPath,
  closeModals,
  switchToRegister,
  switchToLogin,
  syncWithRoute
} = useAuthModal()

const loginForm = reactive({ email: '', password: '' })
const registerForm = reactive({ name: '', email: '', password: '', acceptTerms: false })
const submitting = ref(false)
const error = ref(null)

// Sync with route changes
watch(() => route.query.modal, () => {
  syncWithRoute()
}, { immediate: true })

onMounted(() => {
  syncWithRoute()
  // Check for OAuth error in query params
  if (route.query.error === 'oauth_failed') {
    error.value = t('auth.oauthSignInFailed')
  }
})

async function submit() {
  error.value = null
  
  if (showLoginModal.value) {
    if (!loginForm.email || !loginForm.password) {
      error.value = t('auth.login.fillAllFields')
      return
    }
    submitting.value = true
    try {
      await auth.login(loginForm)
      // Close modal on success - navbar will update automatically
      // Remove query params BEFORE closing modal to prevent any redirects
      const currentPath = route.path
      const query = { ...route.query }
      delete query.modal
      delete query.redirect
      router.replace({ path: currentPath, query })
      closeModals()
      // Don't redirect - just stay on current page
    } catch (e) {
      error.value = auth.error || t('auth.login.failedToSignIn')
    } finally {
      submitting.value = false
    }
  } else if (showRegisterModal.value) {
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      error.value = t('auth.register.fillAllFields')
      return
    }

    if (!registerForm.acceptTerms) {
      error.value = t('auth.register.mustAcceptTerms')
      return
    }
    submitting.value = true
    try {
      await auth.register(registerForm)
      // Close modal on success - navbar will update automatically
      // Remove query params BEFORE closing modal to prevent any redirects
      const currentPath = route.path
      const query = { ...route.query }
      delete query.modal
      delete query.redirect
      router.replace({ path: currentPath, query })
      closeModals()
      // Don't redirect - just stay on current page
    } catch (e) {
      error.value = auth.error || t('auth.register.failedToSignUp')
    } finally {
      submitting.value = false
    }
  }
}

</script>

<style scoped>
.divider {
  position: relative;
  text-align: center;
  margin: 1.5rem 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background-color: #dee2e6;
}

.divider-text {
  position: relative;
  background-color: white;
  padding: 0 1rem;
  color: #6c757d;
  font-size: 0.875rem;
}

.modal-backdrop {
  z-index: 1040;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.modal {
  z-index: 1055;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.modal.show {
  display: block !important;
}
</style>

