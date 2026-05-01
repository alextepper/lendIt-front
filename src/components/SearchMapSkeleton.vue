<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  itemsCount: {
    type: Number,
    default: 0,
  },
})

const { t } = useI18n()

const showLabel = computed(() => props.itemsCount === 0)
</script>

<template>
  <div class="search-map-skeleton" role="status" aria-live="polite">
    <!-- SEO-visible heading & intro: kept in DOM so crawlers see real content even before Leaflet loads. -->
    <div class="seo-content">
      <h1 class="seo-h1">השכרת ציוד ומוצרים בין אנשים בישראל</h1>
      <p class="seo-intro">
        חפשו אלפי מוצרים זמינים להשכרה באזור שלכם – כלי עבודה, ציוד קמפינג,
        מצלמות, אלקטרוניקה, ספורט ועוד. השכירו מהשכנים, חסכו כסף ושמרו על הסביבה.
      </p>
    </div>

    <div class="skeleton-grid" aria-hidden="true">
      <div class="skeleton-shimmer"></div>
      <div class="skeleton-pin">
        <i class="bi bi-geo-alt-fill"></i>
      </div>
      <div class="skeleton-marker skeleton-marker-1"></div>
      <div class="skeleton-marker skeleton-marker-2"></div>
      <div class="skeleton-marker skeleton-marker-3"></div>
      <div class="skeleton-marker skeleton-marker-4"></div>
    </div>

    <div v-if="showLabel" class="skeleton-label">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      <span>{{ t('search.loadingMap') }}</span>
    </div>
  </div>
</template>

<style scoped>
.search-map-skeleton {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
  border-radius: 0.5rem;
  overflow: hidden;
  background:
    linear-gradient(135deg, #eef2f7 0%, #e5ebf3 50%, #eef2f7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.seo-content {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skeleton-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
}

.skeleton-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0) 70%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

.skeleton-pin {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 4px 16px rgba(13, 110, 253, 0.25);
  color: #0d6efd;
  font-size: 2rem;
  animation: bob 2s ease-in-out infinite;
}

.skeleton-marker {
  position: absolute;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: white;
  border: 3px solid #4285F4;
  opacity: 0.55;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.skeleton-marker-1 { top: 22%; left: 28%; animation: pulseFade 2.4s ease-in-out infinite; }
.skeleton-marker-2 { top: 35%; left: 70%; animation: pulseFade 2.4s ease-in-out 0.4s infinite; }
.skeleton-marker-3 { top: 70%; left: 22%; animation: pulseFade 2.4s ease-in-out 0.8s infinite; }
.skeleton-marker-4 { top: 75%; left: 65%; animation: pulseFade 2.4s ease-in-out 1.2s infinite; }

.skeleton-label {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  color: #495057;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  z-index: 3;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

@keyframes pulseFade {
  0%, 100% { transform: scale(1);   opacity: 0.55; }
  50%      { transform: scale(1.1); opacity: 0.85; }
}

@media (max-width: 991px) {
  .search-map-skeleton {
    min-height: 500px;
  }
}

[data-bs-theme="dark"] .search-map-skeleton {
  background: linear-gradient(135deg, #1e293b 0%, #283549 50%, #1e293b 100%);
}

[data-bs-theme="dark"] .skeleton-grid {
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
}

[data-bs-theme="dark"] .skeleton-pin {
  background: #0f172a;
  color: #60a5fa;
}

[data-bs-theme="dark"] .skeleton-label {
  background: rgba(15, 23, 42, 0.95);
  color: #e2e8f0;
}
</style>
