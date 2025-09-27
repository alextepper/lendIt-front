<script setup>
import { computed, ref, watch } from 'vue';
import { useChatStore } from '../stores/chat';

const chat = useChatStore();
const emit = defineEmits(['select']);
const q = ref('');

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return chat.conversations
    .filter((c) => !s || c.title.toLowerCase().includes(s) || c.peer?.name?.toLowerCase().includes(s))
    .sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
});

watch(() => chat.activeId, (v) => chat.markRead(v));
</script>

<template>
  <div class="card p-2">
    <div class="mb-2">
      <input v-model="q" class="form-control form-control-sm" placeholder="Search…" />
    </div>
    <div class="list-group overflow-auto" style="max-height: 70vh">
      <button
        v-for="c in filtered"
        :key="c.id"
        class="list-group-item list-group-item-action d-flex gap-2 align-items-center"
        :class="{ active: c.id === chat.activeId }"
        @click="emit('select', c.id)"
      >
        <img
          :src="c.peer?.avatar || 'https://placehold.co/32x32'"
          class="rounded-circle"
          width="32"
          height="32"
        />
        <div class="flex-grow-1 text-start">
          <div class="d-flex justify-content-between">
            <strong class="text-truncate">{{ c.title || c.peer?.name }}</strong>
            <small class="text-secondary">{{ (c.last_at || '').slice(0, 16).replace('T', ' ') }}</small>
          </div>
          <div class="small text-secondary text-truncate">{{ c.last_text }}</div>
        </div>
        <span v-if="c.unread" class="badge text-bg-danger ms-auto">{{ c.unread }}</span>
      </button>
      <div v-if="filtered.length === 0" class="text-center small text-secondary py-3">
        No conversations
      </div>
    </div>
  </div>
</template>
