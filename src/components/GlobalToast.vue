<script setup>
import { computed } from "vue";
import { useUiStore } from "../stores/ui";
const ui = useUiStore();
const visible = computed(() => !!ui.toast);
const cls = computed(
  () => `toast align-items-center text-bg-${ui.toast?.variant || "info"} show`
);
</script>

<template>
  <div
    v-if="visible"
    class="position-fixed bottom-0 end-0 p-3"
    style="z-index: 1080"
  >
    <div :class="cls" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">{{ ui.toast?.message }}</div>
        <button
          type="button"
          class="btn-close btn-close-white me-2 m-auto"
          @click="ui.clearToast()"
          aria-label="Close"
        ></button>
      </div>
    </div>
  </div>
</template>
