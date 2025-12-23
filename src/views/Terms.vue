<template>
  <component :is="currentComponent" />
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TermsEn from './terms/TermsEn.vue';
import TermsHe from './terms/TermsHe.vue';

const { locale } = useI18n();

const componentsByLocale = {
  en: TermsEn,
  he: TermsHe,
};

const currentComponent = computed(() => {
  const code = locale.value;
  return componentsByLocale[code] || TermsEn;
});
</script>
