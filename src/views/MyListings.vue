<script setup>
import { useI18n } from 'vue-i18n';
import ListingsPanel from '../components/ListingsPanel.vue';

const { t } = useI18n();
</script>

<template>
  <div class="container py-3">
    <h1 class="h4 mb-3">{{ t('dashboard.myListings') }}</h1>
    <ListingsPanel />
  </div>
</template>
