<script setup>
import { ref, computed } from 'vue';
import { getImageUrl } from '../utils/imageUtils';

const props = defineProps({ photos: { type: Array, default: () => [] } });
const active = ref(0);

function set(i) {
  active.value = i;
}

// Convert photo URLs to full URLs
const photoUrls = computed(() => {
  return props.photos.map(photo => {
    const url = typeof photo === 'string' ? photo : photo.url;
    return getImageUrl(url);
  });
});
</script>

<template>
  <div>
    <div class="ratio ratio-16x9 bg-light rounded mb-2">
      <img
        v-if="photoUrls?.length"
        :src="photoUrls[active]"
        class="w-100 h-100 object-fit-cover rounded"
        alt="Item photo"
      />
    </div>
    <div class="d-flex gap-2 overflow-auto">
      <button
        v-for="(p, i) in photoUrls"
        :key="i"
        class="p-0 border-0 bg-transparent"
        @click="set(i)"
      >
        <div class="ratio" style="--bs-aspect-ratio: 60%">
          <img
            :src="p"
            class="rounded object-fit-cover"
            :class="{ 'border border-3 border-primary': i === active }"
          />
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
img {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
