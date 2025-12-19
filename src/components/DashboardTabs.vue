<script setup>
import { useI18n } from 'vue-i18n';
const model = defineModel({ type: String, default: 'profile' }); // 'profile' | 'listings' | 'rentals' | 'booking-requests'
const { t } = useI18n();
</script>

<template>
  <ul class="nav nav-tabs mb-3">
    <li class="nav-item">
      <button class="nav-link" :class="{ active: model === 'profile' }" @click="model = 'profile'">
        <i class="bi bi-person"></i> {{ t('dashboard.profile') }}
      </button>
    </li>
    <li class="nav-item">
      <button class="nav-link" :class="{ active: model === 'listings' }" @click="model = 'listings'">
        <i class="bi bi-box-seam"></i> {{ t('dashboard.myListings') }}
      </button>
    </li>
    <!-- <li class="nav-item">
      <button class="nav-link" :class="{ active: model === 'rentals' }" @click="model = 'rentals'">
        <i class="bi bi-bag-check"></i> {{ t('dashboard.myRentals') }}
      </button>
    </li> -->
    <li class="nav-item">
      <button class="nav-link" :class="{ active: model === 'booking-requests' }" @click="model = 'booking-requests'">
        <i class="bi bi-inbox"></i> {{ t('bookingRequests.navTitle') }}
      </button>
    </li>
  </ul>
</template>
