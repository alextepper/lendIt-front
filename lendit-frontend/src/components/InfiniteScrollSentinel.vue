<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
const emit = defineEmits(['visible']);
const el = ref(null);
let io;

onMounted(() => {
  io = new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) emit('visible');
    },
    { rootMargin: '200px' }
  );
  io.observe(el.value);
});
onBeforeUnmount(() => io?.disconnect());
</script>

<template>
  <div ref="el" class="py-3 text-center text-secondary small">Loading more…</div>
</template>
