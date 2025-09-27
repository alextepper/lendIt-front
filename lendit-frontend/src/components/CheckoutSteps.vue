<script setup>
defineProps({ step: { type: Number, default: 1 } })
</script>

<template>
  <ol class="breadcrumb mb-3 small">
    <li class="breadcrumb-item" :class="{ 'fw-semibold': step>=1 }">Dates</li>
    <li class="breadcrumb-item" :class="{ 'fw-semibold': step>=2 }">Details</li>
    <li class="breadcrumb-item" :class="{ 'fw-semibold': step>=3 }">Payment</li>
  </ol>
</template>
