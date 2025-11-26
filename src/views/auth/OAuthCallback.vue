<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const router = useRouter();
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

    // Check for OAuth errors
    if (oauthError) {
      error.value = t('auth.oauthError', { error: oauthError });
      loading.value = false;
      setTimeout(() => {
        router.replace({ name: 'login', query: { error: 'oauth_failed' } });
      }, 3000);
      return;
    }

    // Check if tokens are present
    if (!accessToken || !refreshToken) {
      error.value = t('auth.missingTokens');
      loading.value = false;
      setTimeout(() => {
        router.replace({ name: 'login', query: { error: 'oauth_failed' } });
      }, 3000);
      return;
    }

    // Use auth store method to handle OAuth callback
    try {
      await auth.handleOAuthCallback(accessToken, refreshToken);

      // Get return URL or default to dashboard
      const returnUrl = route.query.return_url || '/dashboard';
      
      // Redirect to intended destination
      router.replace(returnUrl);
    } catch (fetchError) {
      console.error('Failed to handle OAuth callback:', fetchError);
      error.value = auth.error || t('auth.failedToFetchUser');
      loading.value = false;
      
      setTimeout(() => {
        router.replace({ name: 'login', query: { error: 'oauth_failed' } });
      }, 3000);
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
    error.value = t('auth.oauthCallbackError');
    loading.value = false;
    setTimeout(() => {
      router.replace({ name: 'login', query: { error: 'oauth_failed' } });
    }, 3000);
  }
});
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <div class="card p-4 text-center">
        <div v-if="loading" class="oauth-callback-loading">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">{{ $t('auth.loading') }}</span>
          </div>
          <h5 class="mb-2">{{ $t('auth.completingSignIn') }}</h5>
          <p class="text-muted mb-0">{{ $t('auth.pleaseWait') }}</p>
        </div>
        
        <div v-else-if="error" class="oauth-callback-error">
          <i class="bi bi-exclamation-triangle text-danger display-4 d-block mb-3"></i>
          <h5 class="mb-2">{{ $t('auth.signInFailed') }}</h5>
          <p class="text-danger mb-3">{{ error }}</p>
          <p class="text-muted small mb-0">{{ $t('auth.redirectingToLogin') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oauth-callback-loading,
.oauth-callback-error {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.spinner-border {
  width: 3rem;
  height: 3rem;
}
</style>

