<template>
  <div class="card p-3 mb-3">
    <h5>Language Test</h5>
    <p><strong>Current Language:</strong> {{ language.currentLocale }}</p>
    <p><strong>Is RTL:</strong> {{ language.isRTL }}</p>
    <p><strong>Direction:</strong> {{ language.direction }}</p>
    <p><strong>Translation Test:</strong> {{ $t('app.title') }}</p>
    <p><strong>I18n Locale:</strong> {{ $i18n.locale }}</p>
    
    <div class="mt-2">
      <button 
        v-for="lang in language.availableLocales" 
        :key="lang.code"
        class="btn btn-sm me-2"
        :class="lang.code === language.currentLocale ? 'btn-primary' : 'btn-outline-primary'"
        @click="language.setLocale(lang.code)"
      >
        {{ lang.flag }} {{ lang.name }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useLanguageStore } from '../stores/language'
import { useI18n } from 'vue-i18n'
import { watch } from 'vue'

const language = useLanguageStore()
const { t, locale } = useI18n()

// Debug i18n changes
watch(() => language.currentLocale, (newLocale) => {
  console.log('Language changed in test component:', newLocale)
  console.log('I18n locale:', locale.value)
})
</script>
