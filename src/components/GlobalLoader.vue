<script setup>
import { useUiStore } from "../stores/ui";
const ui = useUiStore();
</script>

<template>
  <div
    v-if="ui.loading"
    class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-body"
    style="opacity: 0.75; z-index: 1070"
  >
    <div class="d-flex flex-column align-items-center gap-2">
      <div class="spinner-border" role="status" aria-hidden="true"></div>
      <small class="text-secondary">Loading…</small>
    </div>
  </div>
</template>
