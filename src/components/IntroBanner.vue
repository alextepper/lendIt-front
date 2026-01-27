<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const visible = ref(false);
const COOKIE_NAME = 'sharo_intro_seen';

function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const entry of cookies) {
    const [key, ...rest] = entry.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function setCookie(name, value, days) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=lax`;
}

function dismiss() {
  setCookie(COOKIE_NAME, '1', 180);
  visible.value = false;
}

onMounted(() => {
  const current = getCookie(COOKIE_NAME);
  if (!current) {
    setCookie(COOKIE_NAME, '0', 180);
  }
  visible.value = current !== '1';
});
</script>

<template>
  <div v-if="visible" class="intro-banner">
    <div class="container-lg intro-banner-inner">
      <div class="intro-banner-content">
        <i class="bi bi-info-circle"></i>
        <div>
          <div class="intro-banner-title">{{ t('introBanner.title') }}</div>
          <div class="intro-banner-text">{{ t('introBanner.body') }}</div>
        </div>
      </div>
      <button class="btn btn-sm btn-primary intro-banner-cta" @click="dismiss">
        {{ t('introBanner.cta') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.intro-banner {
  background: #eef2ff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0.75rem 0;
}

.intro-banner-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.intro-banner-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  color: #1e293b;
}

.intro-banner-title {
  font-weight: 600;
  margin-bottom: 0.125rem;
}

.intro-banner-text {
  font-size: 0.9rem;
  color: #475569;
}

@media (max-width: 768px) {
  .intro-banner-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
