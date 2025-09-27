<script setup>
import { reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const form = reactive({ name: '', email: '', password: '' })
const submitting = ref(false)
const error = ref(null)

async function submit() {
  error.value = null
  if (!form.name || !form.email || !form.password) {
    error.value = 'Please fill in all fields'
    return
  }
  submitting.value = true
  try {
    await auth.register(form)
  } catch (e) {
    error.value = auth.error || 'Failed to sign up'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="h4 mb-3">Create account</h1>

      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <form class="card p-3" @submit.prevent="submit" novalidate>
        <div class="mb-3">
          <label class="form-label">Name</label>
          <input v-model="form.name" class="form-control" type="text" required />
        </div>
        <div class="mb-3">
          <label class="form-label">Email</label>
          <input v-model="form.email" class="form-control" type="email" required />
        </div>
        <div class="mb-3">
          <label class="form-label">Password</label>
          <input v-model="form.password" class="form-control" type="password" minlength="6" required />
        </div>
        <button class="btn btn-primary w-100" :disabled="submitting" type="submit">
          <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
          Sign up
        </button>
      </form>

      <p class="small mt-3">Already have an account? <router-link to="/login">Sign in</router-link></p>
    </div>
  </div>
</template>
