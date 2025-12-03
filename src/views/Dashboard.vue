<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import DashboardTabs from '../components/DashboardTabs.vue';
import ProfilePanel from '../components/ProfilePanel.vue';
import ListingsPanel from '../components/ListingsPanel.vue';
import RentalsPanel from '../components/RentalsPanel.vue';
import OwnerBookingRequestsPanel from '../components/OwnerBookingRequestsPanel.vue';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const tab = ref('profile'); // default to profile
const { t } = useI18n();

// Handle URL query parameters
onMounted(() => {
  if (route.query.tab) {
    tab.value = route.query.tab;
  }
});

// Watch for URL changes
watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    tab.value = newTab;
  }
});
</script>

<template>
  <h1 class="h4 mb-3">{{ t('dashboard.title') }}</h1>
  <DashboardTabs v-model="tab" />

  <div v-show="tab === 'profile'">
    <ProfilePanel />
  </div>

  <div v-show="tab === 'listings'">
    <ListingsPanel />
  </div>

  <div v-show="tab === 'rentals'">
    <RentalsPanel />
  </div>

  <div v-show="tab === 'booking-requests'">
    <OwnerBookingRequestsPanel />
  </div>
</template>
