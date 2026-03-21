<script setup>
import { computed, ref } from 'vue';
import { getItemPhotoUrl } from '../utils/imageUtils';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();  
const props = defineProps({
  item: { type: Object, required: true },
});

const isLocationExpanded = ref(false);

const thumbnailUrl = computed(() => {
  if (props.item.thumbnail) {
    return getItemPhotoUrl(props.item.thumbnail);
  }
  if (props.item.photos && props.item.photos.length > 0) {
    return getItemPhotoUrl(props.item.photos);
  }
  return null;
});

const locationText = computed(() => {
  return props.item.location || props.item.address || '';
});

const shouldShowExpand = computed(() => {
  // Show expand button if location is longer than ~30 characters
  return locationText.value.length > 30;
});

function toggleLocation() {
  isLocationExpanded.value = !isLocationExpanded.value;
}

function formatPrice(amount) {
  if (amount == null) return ''
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount / 100)
}

function getDisplayPrice() {
  const itemType = props.item?.type || (props.item?.sellPrice > 0 ? 'forSale' : props.item?.pricePerDay > 0 ? 'forRent' : 'giveaway')
  if (itemType === 'giveaway') return t('item.free')
  if (itemType === 'forSale') return formatPrice(props.item.sellPrice || props.item.sell_price || 0)
  return `${formatPrice(props.item.pricePerDay || props.item.price_per_day)}/${t('item.day')}`
}
</script>

<template>
  <div class="card h-100 item-card">
    <div class="ratio ratio-16x9 bg-light">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        class="w-100 h-100 object-fit-cover"
        :alt="item.title"
      />
    </div>
    <div class="card-body">
      <h3 class="h6 card-title mb-1 text-truncate">{{ item.title }}</h3>
      <div class="small text-secondary d-flex justify-content-between align-items-start mb-1">
        <div class="location-container flex-grow-1 me-2">
          <span 
            class="location-text" 
            :class="{ 'location-expanded': isLocationExpanded }"
          >
            {{ locationText }}
          </span>
          <button
            v-if="shouldShowExpand"
            type="button"
            class="btn btn-link btn-sm p-0 ms-1 text-decoration-none location-toggle"
            @click.stop="toggleLocation"
            :aria-expanded="isLocationExpanded"
            :aria-label="isLocationExpanded ? t('item.collapseLocation') : t('item.expandLocation')"
          >
            <i class="bi" :class="isLocationExpanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
          </button>
        </div>
        <span class="text-nowrap">{{ item.category }}</span>
      </div>
      <div v-if="item.distance" class="small text-primary mb-1">
        <i class="bi bi-geo-alt-fill me-1"></i>
        {{ item.distance.toFixed(1) }} {{ t('item.kmAway') }}
      </div>
      <div class="d-flex align-items-center justify-content-between mt-2">
        <span class="fw-semibold">{{ getDisplayPrice() }}</span>
        <span class="small">
          <i class="bi bi-star-fill me-1"></i>{{ item.rating ?? '—' }}
          <span class="text-secondary">({{ item.reviews_count ?? 0 }})</span>
        </span>
      </div>
      <router-link
        class="stretched-link"
        :to="`/item/${item.id}`"
        :aria-label="t('item.openItem')"
      ></router-link>
    </div>
  </div>
</template>

<style scoped>
.location-container {
  min-width: 0; /* Allow flex item to shrink */
}

.location-text {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  word-break: break-word;
}

.location-text.location-expanded {
  -webkit-line-clamp: unset;
  display: block;
  white-space: normal;
}

.location-toggle {
  color: #6c757d;
  font-size: 0.75rem;
  line-height: 1;
  vertical-align: middle;
  flex-shrink: 0;
}

.location-toggle:hover {
  color: #0d6efd;
}

.location-toggle:focus {
  box-shadow: none;
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
  border-radius: 2px;
}

:global([data-bs-theme="dark"]) .item-card {
  background: #1f1f1f;
  border-color: #343a40;
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .item-card .card-title {
  color: #f1f3f5;
}

:global([data-bs-theme="dark"]) .item-card .ratio {
  background: #2b2b2b;
}

:global([data-bs-theme="dark"]) .item-card .text-secondary {
  color: #adb5bd !important;
}

:global([data-bs-theme="dark"]) .item-card .location-toggle {
  color: #adb5bd;
}

:global([data-bs-theme="dark"]) .item-card .location-toggle:hover {
  color: #8ab4ff;
}
</style>
