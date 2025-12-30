<template>
  <div class="reset-password-view">
    <div class="container-lg py-5">
      <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
          <div class="card shadow-sm">
            <div class="card-body p-4">
              <div class="text-center mb-4">
                <i class="bi bi-shield-lock display-4 text-primary mb-3"></i>
                <h2 class="h4 mb-2">{{ $t('auth.passwordReset.reset.title') }}</h2>
                <p class="text-muted small mb-0">
                  {{ $t('auth.passwordReset.reset.description') }}
                </p>
              </div>

              <div v-if="error" class="alert alert-danger">
                {{ error }}
              </div>

              <div v-if="success" class="alert alert-success">
                {{ $t('auth.passwordReset.reset.success') }}
                <div class="mt-2">
                  <router-link :to="{ name: 'login', query: { modal: 'login' } }" class="btn btn-sm btn-primary">
                    {{ $t('auth.passwordReset.reset.goToLogin') }}
                  </router-link>
                </div>
              </div>

              <form v-if="!success" @submit.prevent="handleSubmit" novalidate>
                <div class="mb-3">
                  <label class="form-label">{{ $t('auth.passwordReset.reset.newPassword') }}</label>
                  <input
                    v-model="password"
                    type="password"
                    class="form-control"
                    :placeholder="$t('auth.passwordReset.reset.passwordPlaceholder')"
                    minlength="8"
                    required
                    :disabled="submitting"
                  />
                  <small class="text-muted">{{ $t('auth.passwordReset.reset.passwordHint') }}</small>
                </div>

                <div class="mb-3">
                  <label class="form-label">{{ $t('auth.passwordReset.reset.confirmPassword') }}</label>
                  <input
                    v-model="confirmPassword"
                    type="password"
                    class="form-control"
                    :placeholder="$t('auth.passwordReset.reset.confirmPasswordPlaceholder')"
                    minlength="8"
                    required
                    :disabled="submitting"
                  />
                  <div v-if="passwordMismatch" class="text-danger small mt-1">
                    {{ $t('auth.passwordReset.reset.passwordMismatch') }}
                  </div>
                </div>

                <button
                  type="submit"
                  class="btn btn-primary w-100"
                  :disabled="submitting || passwordMismatch"
                >
                  <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                  {{ submitting ? $t('auth.passwordReset.reset.resetting') : $t('auth.passwordReset.reset.submit') }}
                </button>
              </form>

              <div v-if="!success" class="text-center mt-4">
                <router-link :to="{ name: 'login', query: { modal: 'login' } }" class="text-decoration-none">
                  <i class="bi bi-arrow-left me-1"></i>
                  {{ $t('auth.passwordReset.reset.backToLogin') }}
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { resetPassword } from '../../services/passwordResetService'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref(false)

const passwordMismatch = computed(() => {
  return password.value && confirmPassword.value && password.value !== confirmPassword.value
})

onMounted(() => {
  // Extract token from URL query parameter
  token.value = route.query.token || ''
  if (!token.value) {
    error.value = t('auth.passwordReset.reset.missingToken')
  }
})

async function handleSubmit() {
  error.value = ''

  if (!token.value) {
    error.value = t('auth.passwordReset.reset.missingToken')
    return
  }

  if (!password.value || !confirmPassword.value) {
    error.value = t('auth.passwordReset.reset.fillAllFields')
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = t('auth.passwordReset.reset.passwordMismatch')
    return
  }

  if (password.value.length < 8) {
    error.value = t('auth.passwordReset.reset.passwordTooShort')
    return
  }

  submitting.value = true

  try {
    const data = await resetPassword(token.value, password.value)
    success.value = true
    ui.showToast(data.message || t('auth.passwordReset.reset.success'), 'success')
    
    // Auto-redirect to login after 3 seconds
    setTimeout(() => {
      router.push({ name: 'login', query: { modal: 'login' } })
    }, 3000)
  } catch (err) {
    console.error('Password reset failed:', err)
    error.value = err?.response?.data?.message || err?.message || t('auth.passwordReset.reset.error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.reset-password-view {
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
}
</style>

