<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useAuthModal } from '../composables/useAuthModal';
import { loginWithGooglePopup } from '../auth/googlePopup';
import { getPendingAction } from '../auth/pendingActions';

const props = defineProps({
  returnUrl: {
    type: String,
    default: null
  },
  // Optional: allow parent to disable the button (e.g. until terms are accepted)
  disabled: {
    type: Boolean,
    default: false
  }
});

const router = useRouter();
const { t } = useI18n();
const auth = useAuthStore();
const { closeModals } = useAuthModal();
const loading = ref(false);
const error = ref(null);

async function handleGoogleSignIn(event) {
  // Prevent any form submission or default behavior
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  loading.value = true;
  error.value = null;
  
  try {
    // Get pending action if any (set by requireAuth)
    const pendingAction = getPendingAction();
    
    // Use the new popup OAuth flow
    await loginWithGooglePopup(pendingAction || undefined);
    
    // Success - close modal and refresh auth state
    closeModals();
    await auth.fetchMe();
    
    // Resume pending action will be handled by the component that set it
    // via the resumePendingAction mechanism
    
    loading.value = false;
  } catch (err) {
    loading.value = false;
    
    // Handle specific error types
    if (err.message === 'POPUP_BLOCKED') {
      error.value = t('auth.popupBlocked') || 'Popup was blocked. Please allow popups for this site and try again.';
    } else if (err.message.includes('cancelled')) {
      error.value = t('auth.popupClosed') || 'Sign in was cancelled.';
    } else {
      error.value = err.message || t('auth.googleSignInFailed') || 'Failed to sign in with Google';
    }
    
    console.error('Failed to initiate Google sign in:', err);
  }
}
</script>

<template>
  <div class="google-sign-in-container">
    <button
      type="button"
      class="btn btn-outline-secondary w-100 google-sign-in-button"
      @click.prevent="handleGoogleSignIn"
      :disabled="loading || props.disabled"
    >
      <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
      <svg
        v-else
        width="20"
        height="20"
        viewBox="0 0 24 24"
        class="me-2"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {{ loading ? t('auth.googleSigningIn') : t('auth.signInWithGoogle') }}
    </button>
    <div v-if="error" class="alert alert-danger mt-2 mb-0">
      <small>{{ error }}</small>
    </div>
  </div>
</template>

<style scoped>
.google-sign-in-container {
  width: 100%;
}

.google-sign-in-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1rem;
  font-weight: 500;
  border: 1px solid #dadce0;
  background-color: #fff;
  color: #3c4043;
  transition: all 0.2s ease;
}

.google-sign-in-button:hover:not(:disabled) {
  background-color: #f8f9fa;
  border-color: #dadce0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #3c4043;
}

.google-sign-in-button:active:not(:disabled) {
  background-color: #f1f3f4;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.google-sign-in-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-sign-in-button svg {
  flex-shrink: 0;
}
</style>

