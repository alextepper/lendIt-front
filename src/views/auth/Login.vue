<script setup>
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useI18n } from 'vue-i18n'
import GoogleSignInButton from '../../components/GoogleSignInButton.vue'

const auth = useAuthStore()
const route = useRoute()
const { t } = useI18n()
const form = reactive({ email: '', password: '' })
const submitting = ref(false)
const error = ref(null)

// Check for OAuth error in query params
if (route.query.error === 'oauth_failed') {
  error.value = t('auth.oauthSignInFailed')
}

async function submit() {
  error.value = null
  if (!form.email || !form.password) {
    error.value = t('auth.login.fillAllFields')
    alert(error.value)
    return
  }
  submitting.value = true
  try {
    await auth.login(form)
  } catch (e) {
    const backendMessage = e?.response?.data?.message
    const errorMessage = backendMessage || auth.error || e?.message || t('auth.login.failedToSignIn')
    error.value = errorMessage

    // Also show a browser alert so errors are visible on devices without devtools (e.g. mobile)
    let alertText = errorMessage
    if (backendMessage && backendMessage !== errorMessage) {
      alertText += `\n\nDetails: ${backendMessage}`
    }
    alert(alertText)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="h4 mb-3">{{ $t('auth.login.title') }}</h1>

      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <form class="card p-3" @submit.prevent="submit" novalidate>
        <!-- Google Sign In Button -->
        <div class="mb-3">
          <GoogleSignInButton :return-url="route.query.redirect" />
        </div>
        
        <!-- Divider -->
        <div class="divider mb-3">
          <span class="divider-text">{{ $t('auth.or') }}</span>
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t('auth.login.email') }}</label>
          <input v-model="form.email" class="form-control" type="email" required />
        </div>
        <div class="mb-3">
          <label class="form-label">{{ $t('auth.login.password') }}</label>
          <input v-model="form.password" class="form-control" type="password" minlength="6" required />
        </div>
        <button class="btn btn-primary w-100" :disabled="submitting" type="submit">
          <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
          {{ $t('auth.login.submit') }}
        </button>
      </form>

      <p class="small mt-3">{{ $t('auth.login.noAccount') }} <router-link to="/register">{{ $t('auth.login.signUp') }}</router-link></p>
    </div>
  </div>
</template>

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
</style>
