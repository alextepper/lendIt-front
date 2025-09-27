import { ref, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

export function useQuerySync(defaults) {
  const route = useRoute();
  const router = useRouter();
  const state = ref({ ...defaults });

  // Hydrate from URL
  onMounted(() => {
    state.value = { ...defaults, ...route.query };
    // Coerce numbers
    for (const k of ["page", "per_page", "price_min", "price_max"]) {
      if (state.value[k] != null) state.value[k] = Number(state.value[k]);
    }
  });

  // Push to URL when state changes
  watch(
    state,
    (val) => {
      const q = { ...val };
      // Remove empty values for clean URLs
      for (const [k, v] of Object.entries(q)) {
        if (v === "" || v == null || (typeof v === "number" && Number.isNaN(v)))
          delete q[k];
      }
      router.replace({ query: q });
    },
    { deep: true }
  );

  function setPatch(patch) {
    state.value = { ...state.value, ...patch, page: 1 };
  }
  function setPage(page) {
    state.value.page = page;
  }
  function reset() {
    state.value = { ...defaults };
  }

  return { state, setPatch, setPage, reset };
}
