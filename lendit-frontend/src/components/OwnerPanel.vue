<script setup>
const props = defineProps({
  owner: { type: Object, required: true },
});
</script>

<template>
  <div class="card p-3">
    <div class="d-flex align-items-center gap-3">
      <img
        :src="owner?.avatar"
        class="rounded-circle"
        width="48"
        height="48"
        alt="Owner"
      />
      <div>
        <div class="fw-semibold">{{ owner?.name }}</div>
        <div class="small text-secondary">
          <i class="bi bi-star-fill me-1"></i>{{ owner?.rating ?? '—' }}
        </div>
      </div>
    </div>
    <div class="d-flex gap-2 mt-3">
      <router-link
        class="btn btn-outline-primary btn-sm"
        :to="{ name: 'messages', query: { to: owner?.id } }"
      >
        <i class="bi bi-chat-dots me-1"></i>Message
      </router-link>
      <router-link
        class="btn btn-outline-secondary btn-sm"
        :to="{ name: 'search', query: { owner: owner?.id } }"
      >
        View all
      </router-link>
    </div>
  </div>
</template>
