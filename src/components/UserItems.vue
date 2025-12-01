<script setup>
import { ref, onMounted } from 'vue';
import { fetchListings } from '../services/listingsService';
import ItemCard from './ItemCard.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const items = ref([]);
const loading = ref(true);
const error = ref('');
const totalItems = ref(0);

onMounted(async () => {
  await loadUserItems();
});

async function loadUserItems() {
  loading.value = true;
  error.value = '';
  
  try {
    const data = await fetchListings({
      mine: true,
      page: 1,
      pageSize: 4 // Use pageSize instead of per_page for the new API
    });
    
    items.value = data.items || [];
    totalItems.value = data.total || 0;
  } catch (err) {
    error.value = err.message || t('dashboard.failedToLoadItems');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="h6 mb-0">{{ t('dashboard.myItemsForRent') }}</h3>
      <router-link 
        v-if="totalItems > 4" 
        to="/dashboard?tab=listings" 
        class="btn btn-outline-primary btn-sm"
      >
        <i class="bi bi-arrow-right me-1"></i>
        <span>{{ t('dashboard.showMore') }} ({{ totalItems }})</span>
        </router-link>
    </div>

    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border spinner-border-sm" role="status"></div>
      <div class="small text-secondary mt-2">{{ t('dashboard.loadingYourItems') }}</div>
    </div>

    <div v-else-if="error" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle me-2"></i>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="items.length === 0" class="text-center py-4">
      <i class="bi bi-box display-6 text-muted"></i>
      <div class="mt-2">
        <h6 class="text-muted">{{ t('dashboard.noItemsYet') }}</h6>
        <p class="small text-muted mb-3">{{ t('dashboard.startEarningByListingItemsForRent') }}</p>
        <router-link to="/dashboard?tab=listings" class="btn btn-primary btn-sm">
          <i class="bi bi-plus-lg me-1"></i>
          {{ t('dashboard.addYourFirstItem') }}
        </router-link>
      </div>
    </div>

    <div v-else class="row g-3">
      <div v-for="item in items" :key="item.id" class="col-6 col-lg-3">
        <div class="position-relative">
          <ItemCard :item="item" />
        </div>
      </div>
    </div>

    <!-- Show More Button for mobile/tablet when there are more items -->
    <div v-if="totalItems > 4" class="text-center mt-3 d-lg-none">
      <router-link to="/dashboard?tab=listings" class="btn btn-outline-primary">
        <i class="bi bi-arrow-right me-1"></i>
        <span>{{ t('dashboard.viewAll') }} {{ totalItems }} {{ t('dashboard.items') }}</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.card {
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.btn-sm {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

@media (max-width: 768px) {
  .col-6 {
    margin-bottom: 1rem;
  }
}
</style>
