<script setup>
import ItemCard from './ItemCard.vue';
defineProps({ items: { type: Array, default: () => [] } });
</script>

<template>
  <div>
    <h2 class="h6 mb-2">Related items</h2>
    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
      <div v-for="it in items" :key="it.id" class="col">
        <ItemCard :item="it" />
      </div>
    </div>
  </div>
</template>
