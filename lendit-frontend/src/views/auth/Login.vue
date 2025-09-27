<script setup>
import { reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const form = reactive({ email: '', password: '' })
const submitting = ref(false)
const error = ref(null)

async function submit() {
  error.value = null
  if (!form.email || !form.password) {
    error.value = 'Please fill in all fields'
    return
  }
  submitting.value = true
  try {
    await auth.login(form)
  } catch (e) {
    error.value = auth.error || 'Failed to sign in'
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
