<script setup>
import { useI18n } from 'vue-i18n';
import OwnerBookingRequestsPanel from '../components/OwnerBookingRequestsPanel.vue';

const { t } = useI18n();
</script>

<template>
  <div class="container py-3">
    <OwnerBookingRequestsPanel />
  </div>
</template>
