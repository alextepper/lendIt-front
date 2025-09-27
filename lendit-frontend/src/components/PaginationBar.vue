<script setup>
const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
});
const emit = defineEmits(['change']);

function go(p) {
  if (p < 1 || p > props.totalPages) return;
  emit('change', p);
}
</script>

<template>
  <nav v-if="totalPages > 1" aria-label="Listings pages">
    <ul class="pagination justify-content-center">
      <li class="page-item" :class="{ disabled: page <= 1 }">
        <button class="page-link" @click="go(page - 1)">Prev</button>
      </li>
      <li class="page-item disabled">
        <span class="page-link">Page {{ page }} / {{ totalPages }}</span>
      </li>
      <li class="page-item" :class="{ disabled: page >= totalPages }">
        <button class="page-link" @click="go(page + 1)">Next</button>
      </li>
    </ul>
  </nav>
</template>
