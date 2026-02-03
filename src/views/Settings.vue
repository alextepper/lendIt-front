<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import http from '../lib/http';

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const loading = ref(false);
const message = ref('');
const messageType = ref(''); // 'success' or 'error'

// Form data
const profileForm = reactive({
  username: auth.user?.username || '',
  email: auth.user?.email || '',
  city: auth.user?.city || auth.user?.location || '',
});
const cities = ref([]);

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// Load cities on mount
onMounted(async () => {
  // Cities/locations removed - using geocoding instead
  cities.value = [];
  
  // Load user profile data if not already in auth.user
  if (!profileForm.city && auth.user) {
    try {
      const { data } = await http.get('/auth/me');
      profileForm.city = data.city || data.location || '';
    } catch (e) {
      // Non-blocking
    }
  }
});

// Update profile (username/email)
async function updateProfile() {
  if (!profileForm.username.trim() || !profileForm.email.trim()) {
    showMessage(t('settings.messages.fillAllFields'), 'error');
    return;
  }

  loading.value = true;
  message.value = '';

  try {
    const { data } = await http.patch('/users/me', {
      username: profileForm.username,
      email: profileForm.email,
      city: profileForm.city,
    });
    
    // Update auth store with new user data
    auth.user = { ...(data.user || data), city: profileForm.city };
    
    showMessage(t('settings.messages.profileUpdated'), 'success');
  } catch (error) {
    showMessage(error.response?.data?.message || error.message || t('settings.messages.updateProfileFailed'), 'error');
  } finally {
    loading.value = false;
  }
}

// Change password
async function changePassword() {
  if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    showMessage(t('settings.messages.fillAllPasswordFields'), 'error');
    return;
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showMessage(t('settings.messages.passwordsDoNotMatch'), 'error');
    return;
  }

  if (passwordForm.newPassword.length < 6) {
    showMessage(t('settings.messages.passwordTooShort'), 'error');
    return;
  }

  loading.value = true;
  message.value = '';

  try {
    await http.patch('/users/me', {
      password: passwordForm.newPassword,
    });

    showMessage(t('settings.messages.passwordChanged'), 'success');
    
    // Clear password form
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
  } catch (error) {
    showMessage(error.response?.data?.message || error.message || t('settings.messages.changePasswordFailed'), 'error');
  } finally {
    loading.value = false;
  }
}

function showMessage(text, type) {
  message.value = text;
  messageType.value = type;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    message.value = '';
  }, 5000);
}

function cancel() {
  router.back();
}
</script>

<template>
  <div class="settings-page container py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-lg-8">
        <!-- Header -->
        <div class="d-flex align-items-center mb-4">
          <button @click="cancel" class="btn btn-link text-decoration-none p-0 me-3">
            <i class="bi bi-arrow-left fs-4"></i>
          </button>
          <h2 class="mb-0">{{ $t('settings.title') }}</h2>
        </div>

        <!-- Alert Message -->
        <div v-if="message" class="alert" :class="messageType === 'success' ? 'alert-success' : 'alert-danger'" role="alert">
          <i class="bi" :class="messageType === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'"></i>
          {{ message }}
        </div>

        <!-- Profile Information Card -->
        <div class="card mb-4 shadow-sm">
          <div class="card-body p-4">
            <h5 class="card-title mb-4">
              <i class="bi bi-person-circle me-2"></i>
              {{ $t('settings.profileInformation') }}
            </h5>
            
            <form @submit.prevent="updateProfile">
              <div class="mb-3">
                <label for="username" class="form-label">{{ $t('settings.username') }}</label>
                <input
                  type="text"
                  class="form-control"
                  id="username"
                  v-model="profileForm.username"
                  :placeholder="$t('settings.placeholders.username')"
                  required
                />
              </div>

              <div class="mb-3">
                <label for="email" class="form-label">{{ $t('settings.email') }}</label>
                <input
                  type="email"
                  class="form-control"
                  id="email"
                  v-model="profileForm.email"
                  :placeholder="$t('settings.placeholders.email')"
                  required
                />
              </div>

              <div class="mb-4">
                <label for="city" class="form-label">{{ $t('settings.city') }}</label>
                <select
                  class="form-select"
                  id="city"
                  v-model="profileForm.city"
                >
                  <option value="">{{ $t('settings.selectCity') }}</option>
                  <option v-for="city in cities" :key="city" :value="city">
                    {{ city }}
                  </option>
                </select>
                <div class="form-text">{{ $t('settings.cityHelp') }}</div>
              </div>

              <button 
                type="submit" 
                class="btn btn-primary"
                :disabled="loading"
              >
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-check-lg me-2"></i>
                {{ $t('settings.saveChanges') }}
              </button>
            </form>
          </div>
        </div>

        <!-- Change Password Card -->
        <div class="card mb-4 shadow-sm">
          <div class="card-body p-4">
            <h5 class="card-title mb-4">
              <i class="bi bi-lock-fill me-2"></i>
              {{ $t('settings.changePassword') }}
            </h5>
            
            <form @submit.prevent="changePassword">
              <div class="mb-3">
                <label for="currentPassword" class="form-label">{{ $t('settings.currentPassword') }}</label>
                <input
                  type="password"
                  class="form-control"
                  id="currentPassword"
                  v-model="passwordForm.currentPassword"
                  :placeholder="$t('settings.placeholders.currentPassword')"
                  autocomplete="current-password"
                />
              </div>

              <div class="mb-3">
                <label for="newPassword" class="form-label">{{ $t('settings.newPassword') }}</label>
                <input
                  type="password"
                  class="form-control"
                  id="newPassword"
                  v-model="passwordForm.newPassword"
                  :placeholder="$t('settings.placeholders.newPassword')"
                  autocomplete="new-password"
                />
                <div class="form-text">{{ $t('settings.passwordHint') }}</div>
              </div>

              <div class="mb-4">
                <label for="confirmPassword" class="form-label">{{ $t('settings.confirmNewPassword') }}</label>
                <input
                  type="password"
                  class="form-control"
                  id="confirmPassword"
                  v-model="passwordForm.confirmPassword"
                  :placeholder="$t('settings.placeholders.confirmNewPassword')"
                  autocomplete="new-password"
                />
              </div>

              <button 
                type="submit" 
                class="btn btn-primary"
                :disabled="loading"
              >
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-shield-lock me-2"></i>
                {{ $t('settings.changePassword') }}
              </button>
            </form>
          </div>
        </div>

        <!-- Account Actions Card -->
        <div class="card shadow-sm">
          <div class="card-body p-4">
            <h5 class="card-title mb-4">
              <i class="bi bi-gear-fill me-2"></i>
              {{ $t('settings.accountActions') }}
            </h5>
            
            <div class="d-flex flex-column gap-3">
              <button 
                @click="auth.logout" 
                class="btn btn-outline-danger"
              >
                <i class="bi bi-box-arrow-right me-2"></i>
                {{ $t('settings.logout') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 120px);
  background-color: #f8f9fa;
}

.card {
  border: none;
  border-radius: 0.75rem;
}

.card-title {
  font-weight: 600;
  color: #212529;
}

.form-label {
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.5rem;
}

.form-control {
  border-radius: 0.5rem;
  border: 1px solid #ced4da;
  padding: 0.75rem 1rem;
}

.form-control:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}

.btn {
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
}

.alert {
  border-radius: 0.5rem;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .settings-page {
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
  }

  .card-body {
    padding: 1.5rem !important;
  }
}
</style>

