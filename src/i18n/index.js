import { createI18n } from "vue-i18n";
import en from "./locales/en.json";
import he from "./locales/he.json";
import ar from "./locales/ar.json";
import ru from "./locales/ru.json";

// Get language from localStorage or browser, default to English
const getDefaultLocale = () => {
  const saved = localStorage.getItem("lendit-locale");
  if (saved && ["en", "he", "ar", "ru"].includes(saved)) {
    return saved;
  }

  const browserLang = navigator.language.split("-")[0];
  if (["he", "ar", "ru"].includes(browserLang)) {
    return browserLang;
  }

  return "en";
};

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: getDefaultLocale(),
  fallbackLocale: "en",
  messages: {
    en,
    he,
    ar,
    ru,
  },
});

export default i18n;

// Helper to detect RTL languages
export const isRTL = (locale) => ["he", "ar"].includes(locale);

// Helper to get current locale direction
export const getLocaleDirection = (locale) => (isRTL(locale) ? "rtl" : "ltr");
