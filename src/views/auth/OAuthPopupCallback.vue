<script setup>
/**
 * OAuth Popup Callback Page
 * 
 * This is a minimal callback page specifically for popup OAuth flows.
 * It:
 * 1. Receives OAuth tokens from the backend
 * 2. Stores them and refreshes auth state
 * 3. Sends postMessage to the opener window
 * 4. Closes itself automatically
 */

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const auth = useAuthStore();
const { t } = useI18n();

const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    // Get tokens from query params
    const accessToken = route.query.access_token;
    const refreshToken = route.query.refresh_token;
    const oauthError = route.query.error;

    // Check if we're in a popup
    const isPopup = window.opener !== null;

    // Check for OAuth errors
    if (oauthError) {
      error.value = t('auth.oauthError', { error: oauthError });
      loading.value = false;
      
      if (isPopup && window.opener) {
        // Send error message to opener
        window.opener.postMessage({
          type: 'OAUTH_ERROR',
          error: oauthError
        }, window.location.origin);
        
        setTimeout(() => {
          window.close();
        }, 2000);
      }
      return;
    }

    // Check if tokens are present
    if (!accessToken || !refreshToken) {
      error.value = t('auth.missingTokens');
      loading.value = false;
      
      if (isPopup && window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_ERROR',
          error: 'Missing tokens'
        }, window.location.origin);
        
        setTimeout(() => {
          window.close();
        }, 2000);
      }
      return;
    }

    // Handle OAuth callback
    try {
      await auth.handleOAuthCallback(accessToken, refreshToken);

      // Success - send message to opener
      if (isPopup && window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_SUCCESS'
        }, window.location.origin);
        
        // Close popup after a brief delay
        loading.value = false;
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        // Not in popup - this shouldn't happen, but handle gracefully
        console.warn('[OAuthPopupCallback] Not in popup, redirecting...');
        // Could redirect to home or show error
        error.value = 'This callback is only for popup OAuth flows';
        loading.value = false;
      }
    } catch (fetchError) {
      console.error('Failed to handle OAuth callback:', fetchError);
      error.value = auth.error || t('auth.failedToFetchUser');
      loading.value = false;
      
      if (isPopup && window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_ERROR',
          error: error.value
        }, window.location.origin);
        
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
    error.value = t('auth.oauthCallbackError');
    loading.value = false;
    
    if (window.opener) {
      window.opener.postMessage({
        type: 'OAUTH_ERROR',
        error: error.value
      }, window.location.origin);
      
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  }
});
</script>

<template>
  <div class="oauth-popup-callback">
    <div class="container d-flex align-items-center justify-content-center" style="min-height: 100vh;">
      <div class="text-center">
        <div v-if="loading" class="mb-3">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">{{ $t('auth.loading') }}</span>
          </div>
        </div>
        <div v-if="loading">
          <h5 class="mb-2">{{ $t('auth.completingSignIn') }}</h5>
          <p class="text-muted mb-0">{{ $t('auth.pleaseWait') }}</p>
        </div>
        
        <div v-else-if="error" class="text-danger">
          <i class="bi bi-exclamation-triangle display-6 d-block mb-3"></i>
          <h5 class="mb-2">{{ $t('auth.signInFailed') }}</h5>
          <p class="text-danger mb-0">{{ error }}</p>
          <p class="text-muted small mt-2">This window will close automatically...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oauth-popup-callback {
  min-height: 100vh;
  background: #f8f9fa;
}

.spinner-border {
  width: 3rem;
  height: 3rem;
}
</style>

