<script setup>
import { useI18n } from 'vue-i18n';
import OwnerBookingRequestsPanel from '../components/OwnerBookingRequestsPanel.vue';

const { t } = useI18n();
</script>

<template>
  <div class="container py-3">
    <h1 class="h4 mb-3">{{ t('bookingRequests.title') }}</h1>
    <OwnerBookingRequestsPanel />
  </div>
</template>
