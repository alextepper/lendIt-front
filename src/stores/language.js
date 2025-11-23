import { defineStore } from "pinia";
import i18n, { isRTL, getLocaleDirection } from "../i18n";

export const useLanguageStore = defineStore("language", {
  state: () => ({
    currentLocale: i18n.global.locale.value,
    availableLocales: [
      { code: "en", name: "English", flag: "🇺🇸" },
      { code: "he", name: "עברית", flag: "🇮🇱" },
      { code: "ar", name: "العربية", flag: "🇸🇦" },
      { code: "ru", name: "Русский", flag: "🇷🇺" },
    ],
  }),

  getters: {
    isRTL: (state) => isRTL(state.currentLocale),
    direction: (state) => getLocaleDirection(state.currentLocale),
    currentLanguage: (state) => {
      return state.availableLocales.find(
        (lang) => lang.code === state.currentLocale
      );
    },
  },

  actions: {
    setLocale(locale) {
      if (!["en", "he", "ar", "ru"].includes(locale)) {
        console.warn(`Unsupported locale: ${locale}`);
        return;
      }

      // Update i18n first
      i18n.global.locale.value = locale;

      // Then update our state
      this.currentLocale = locale;

      // Save to localStorage
      localStorage.setItem("lendit-locale", locale);

      // Update document direction and language
      document.documentElement.lang = locale;
      document.documentElement.dir = this.direction;

      // Update body class for RTL styling
      document.body.classList.toggle("rtl", this.isRTL);
      document.body.classList.remove("ltr");
      if (!this.isRTL) {
        document.body.classList.add("ltr");
      }

      console.log(`Language changed to: ${locale}, RTL: ${this.isRTL}`);
    },

    init() {
      // Ensure our state is synced with i18n
      this.currentLocale = i18n.global.locale.value;

      // Set initial document attributes
      document.documentElement.lang = this.currentLocale;
      document.documentElement.dir = this.direction;
      document.body.classList.toggle("rtl", this.isRTL);
      if (!this.isRTL) {
        document.body.classList.add("ltr");
      }

      console.log(
        `Language initialized: ${this.currentLocale}, RTL: ${this.isRTL}`
      );
    },
  },
});
