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
  <div v-if="visible" class="intro-overlay">
    <div class="intro-backdrop" @click="dismiss"></div>
    <div class="intro-modal" role="dialog" aria-modal="true">
      <button class="intro-close" @click="dismiss" aria-label="Close">
        <span class="material-symbols-outlined">close</span>
      </button>

      <div class="intro-header">
        <div class="intro-icon">
          <span class="material-symbols-outlined">waving_hand</span>
        </div>
        <h1 class="intro-title">{{ t('introBanner.title') }}</h1>
        <p class="intro-subtitle">{{ t('introBanner.body') }}</p>
      </div>

      <div class="intro-steps">
        <div class="intro-step">
          <div class="step-icon">
            <span class="material-symbols-outlined">travel_explore</span>
          </div>
          <h3 class="step-title">{{ t('introBanner.steps.find.title') }}</h3>
          <p class="step-text">{{ t('introBanner.steps.find.body') }}</p>
        </div>
        <div class="intro-step">
          <div class="step-icon">
            <span class="material-symbols-outlined">handshake</span>
          </div>
          <h3 class="step-title">{{ t('introBanner.steps.borrow.title') }}</h3>
          <p class="step-text">{{ t('introBanner.steps.borrow.body') }}</p>
        </div>
        <div class="intro-step">
          <div class="step-icon">
            <span class="material-symbols-outlined">assignment_return</span>
          </div>
          <h3 class="step-title">{{ t('introBanner.steps.return.title') }}</h3>
          <p class="step-text">{{ t('introBanner.steps.return.body') }}</p>
        </div>
      </div>

      <div class="intro-actions">
        <button class="intro-primary" @click="dismiss">
          {{ t('introBanner.cta') }}
        </button>
        <button class="intro-secondary" type="button">
          {{ t('introBanner.learnMore') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  font-family: "Manrope", "Noto Sans", system-ui, sans-serif;
}

.intro-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.intro-modal {
  position: relative;
  z-index: 1;
  width: min(820px, 100%);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(13, 18, 27, 0.35);
  padding: 2.5rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.intro-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.intro-close:hover {
  background: #f1f5f9;
  color: #475569;
}

.intro-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.intro-icon {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(19, 91, 236, 0.1);
  color: #135bec;
}

.intro-title {
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
  color: #0d121b;
}

.intro-subtitle {
  margin: 0;
  color: #64748b;
  max-width: 520px;
  line-height: 1.6;
}

.intro-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
}

.intro-step {
  text-align: center;
  padding: 1rem;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.intro-step:hover {
  background: #f8fafc;
}

.step-icon {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  background: #eff6ff;
  color: #135bec;
  transition: background-color 0.2s, color 0.2s;
}

.intro-step:hover .step-icon {
  background: #135bec;
  color: #ffffff;
}

.step-title {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0d121b;
}

.step-text {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
  line-height: 1.5;
}

.intro-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.intro-primary {
  width: min(360px, 100%);
  padding: 0.9rem 1.5rem;
  border-radius: 8px;
  border: none;
  background: #135bec;
  color: #ffffff;
  font-weight: 700;
  transition: background-color 0.2s, transform 0.2s;
}

.intro-primary:hover {
  background: #0f4ecc;
}

.intro-secondary {
  border: none;
  background: none;
  color: #64748b;
  font-weight: 600;
  transition: color 0.2s;
}

.intro-secondary:hover {
  color: #135bec;
}

:global([data-bs-theme="dark"]) .intro-modal {
  background: #1a202c;
}

:global([data-bs-theme="dark"]) .intro-title,
:global([data-bs-theme="dark"]) .step-title {
  color: #ffffff;
}

:global([data-bs-theme="dark"]) .intro-subtitle,
:global([data-bs-theme="dark"]) .step-text,
:global([data-bs-theme="dark"]) .intro-secondary {
  color: #cbd5f5;
}

:global([data-bs-theme="dark"]) .intro-step:hover {
  background: #1f2937;
}

:global([data-bs-theme="dark"]) .intro-close:hover {
  background: #1f2937;
  color: #e2e8f0;
}

@media (max-width: 900px) {
  .intro-steps {
    grid-template-columns: 1fr;
  }
}
</style>
