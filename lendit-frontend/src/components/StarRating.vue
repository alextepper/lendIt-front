<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Number, default: 0 }, // for interactive mode
  value: { type: Number, default: null },   // for read-only avg
  readonly: { type: Boolean, default: false },
  size: { type: String, default: '1rem' },
});

const emit = defineEmits(['update:modelValue']);

const stars = computed(() => {
  const v = props.readonly ? (props.value ?? 0) : (props.modelValue ?? 0);
  return Array.from({ length: 5 }).map((_, i) => i < Math.round(v));
});

function set(n) { 
  if (!props.readonly) emit('update:modelValue', n); 
}
</script>

<template>
  <div class="d-inline-flex align-items-center" :style="{ fontSize: size, gap: '2px' }">
    <i v-for="(on, i) in stars" :key="i"
       class="bi"
       :class="on ? 'bi-star-fill text-warning' : 'bi-star text-warning'"
       role="button"
       @click="set(i + 1)"></i>
  </div>
</template>
