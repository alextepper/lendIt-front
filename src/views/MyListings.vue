<script setup>
import { useI18n } from 'vue-i18n';
import ListingsPanel from '../components/ListingsPanel.vue';

const { t } = useI18n();
</script>

<template>
  <div class="container py-3">
    <ListingsPanel />
  </div>
</template>
