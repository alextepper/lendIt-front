<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const stars = computed(() => Array.from({ length: 5 }, (_, i) => i + 1));

function handleClick(rating) {
  if (!props.readonly) {
    emit('update:modelValue', rating);
  }
}
</script>

<template>
  <div class="star-rating">
    <i
      v-for="star in stars"
      :key="star"
      class="bi"
      :class="star <= modelValue ? 'bi-star-fill text-warning' : 'bi-star'"
      @click="handleClick(star)"
      :style="{ cursor: readonly ? 'default' : 'pointer' }"
    ></i>
  </div>
</template>