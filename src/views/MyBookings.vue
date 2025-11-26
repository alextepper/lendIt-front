<template>
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="h3 mb-0">{{ $t('bookings.title') }}</h1>
      <router-link to="/search" class="btn btn-primary">
        <i class="bi bi-search me-2"></i>
        {{ $t('bookings.findItemsToRent') }}
      </router-link>
    </div>

    <!-- Tabs -->
    <ul class="nav nav-tabs mb-4" role="tablist">
      <li class="nav-item" role="presentation">
        <button 
          class="nav-link" 
          :class="{ active: activeTab === 'renter' }"
          @click="activeTab = 'renter'"
        >
          <i class="bi bi-box-arrow-in-right me-2"></i>
          {{ $t('bookings.myRentals') }}
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button 
          class="nav-link" 
          :class="{ active: activeTab === 'owner' }"
          @click="activeTab = 'owner'"
        >
          <i class="bi bi-box-arrow-up me-2"></i>
          {{ $t('bookings.itemsRentingOut') }}
        </button>
      </li>
    </ul>

    <!-- Tab Content -->
    <div class="tab-content">
      <OrdersList v-if="activeTab === 'renter'" role="renter" :key="'renter'" />
      <OrdersList v-else role="owner" :key="'owner'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import OrdersList from '../components/OrdersList.vue';

const { t } = useI18n();
const activeTab = ref('renter');
</script>

<style scoped>
.nav-tabs .nav-link {
  cursor: pointer;
}
</style>

