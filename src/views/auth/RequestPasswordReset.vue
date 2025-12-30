<template>
  <div class="request-password-reset-view">
    <div class="container-lg py-5">
      <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
          <div class="card shadow-sm">
            <div class="card-body p-4">
              <div class="text-center mb-4">
                <i class="bi bi-key display-4 text-primary mb-3"></i>
                <h2 class="h4 mb-2">{{ $t('auth.passwordReset.request.title') }}</h2>
                <p class="text-muted small mb-0">
                  {{ $t('auth.passwordReset.request.description') }}
                </p>
              </div>

              <div v-if="message" class="alert" :class="messageType === 'success' ? 'alert-success' : 'alert-danger'">
                {{ message }}
              </div>

              <form @submit.prevent="handleSubmit" novalidate>
                <div class="mb-3">
                  <label class="form-label">{{ $t('auth.login.email') }}</label>
                  <input
                    v-model="email"
                    type="email"
                    class="form-control"
                    :placeholder="$t('auth.passwordReset.request.emailPlaceholder')"
                    required
                    :disabled="submitting"
                  />
                </div>

                <button
                  type="submit"
                  class="btn btn-primary w-100"
                  :disabled="submitting"
                >
                  <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                  {{ submitting ? $t('auth.passwordReset.request.sending') : $t('auth.passwordReset.request.submit') }}
                </button>
              </form>

              <div class="text-center mt-4">
                <router-link :to="{ name: 'login', query: { modal: 'login' } }" class="text-decoration-none">
                  <i class="bi bi-arrow-left me-1"></i>
                  {{ $t('auth.passwordReset.request.backToLogin') }}
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { requestPasswordReset } from '../../services/passwordResetService'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const router = useRouter()
const ui = useUiStore()

const email = ref('')
const submitting = ref(false)
const message = ref('')
const messageType = ref('success')

async function handleSubmit() {
  if (!email.value) {
    message.value = t('auth.passwordReset.request.emailRequired')
    messageType.value = 'danger'
    return
  }

  submitting.value = true
  message.value = ''

  try {
    const data = await requestPasswordReset(email.value)
    message.value = data.message || t('auth.passwordReset.request.success')
    messageType.value = 'success'
    email.value = '' // Clear email for security
  } catch (error) {
    console.error('Password reset request failed:', error)
    message.value = error?.response?.data?.message || error?.message || t('auth.passwordReset.request.error')
    messageType.value = 'danger'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.request-password-reset-view {
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
}
</style>

