<template>
  <component :is="currentComponent" />
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TermsEn from './terms/TermsEn.vue';
import TermsHe from './terms/TermsHe.vue';
import { useSeo, buildCanonical } from '../composables/useSeo';
import { notifyPrerenderReady } from '../composables/usePrerender';
import { onMounted } from 'vue';

const { locale } = useI18n();

const componentsByLocale = {
  en: TermsEn,
  he: TermsHe,
};

const currentComponent = computed(() => {
  const code = locale.value;
  return componentsByLocale[code] || TermsEn;
});

useSeo({
  title: 'תנאי שימוש ומדיניות פרטיות | Sharo',
  description:
    'תנאי השימוש ומדיניות הפרטיות של Sharo - פלטפורמת השכרת מוצרים בין אנשים בישראל. קראו על תנאי השימוש שלנו, פרטיות נתונים ואבטחה.',
  ogTitle: 'תנאי שימוש ומדיניות פרטיות - Sharo',
  ogDescription: 'מסמכי תנאי שימוש ומדיניות פרטיות של פלטפורמת Sharo.',
  ogType: 'article',
  canonical: buildCanonical('/terms'),
});

onMounted(() => notifyPrerenderReady());
</script>
