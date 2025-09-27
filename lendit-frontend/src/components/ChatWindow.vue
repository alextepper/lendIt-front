<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useChatStore } from '../stores/chat';

const chat = useChatStore();
const input = ref('');
const messagesEnd = ref(null);

function scrollToBottom() {
  nextTick(() => messagesEnd.value?.scrollIntoView({ behavior: 'smooth' }));
}

watch(() => chat.activeMessages, scrollToBottom, { deep: true });

async function send() {
  const text = input.value.trim();
  if (!text) return;
  try {
    await chat.send(text);
    input.value = '';
  } catch (e) {
    alert(e?.response?.data?.message || e.message || 'Failed to send');
  }
}

onMounted(scrollToBottom);
</script>

<template>
  <div class="card h-100">
    <div class="card-header d-flex align-items-center gap-2">
      <img :src="chat.activeConv?.peer?.avatar" class="rounded-circle" width="32" height="32" />
      <strong>{{ chat.activeConv?.title || chat.activeConv?.peer?.name || 'Chat' }}</strong>
      <span v-if="chat.typing[chat.activeId]" class="small text-secondary ms-2">typing…</span>
    </div>

    <div class="card-body overflow-auto" style="height: 60vh">
      <div
        v-for="m in chat.activeMessages"
        :key="m.id"
        class="mb-2 d-flex"
        :class="{ 'justify-content-end': m.from_self }"
      >
        <div
          class="px-3 py-2 rounded-3"
          :class="m.from_self ? 'bg-primary text-white' : 'bg-body-secondary'"
        >
          <div class="small">{{ m.text }}</div>
          <div
            class="small text-opacity-75"
            :class="m.from_self ? 'text-white-50' : 'text-secondary'"
          >
            {{ (m.created_at || '').slice(11, 16) }}
          </div>
        </div>
      </div>
      <div ref="messagesEnd"></div>
    </div>

    <div class="card-footer">
      <div class="input-group">
        <input v-model="input" class="form-control" placeholder="Write a message…" @keyup.enter="send" />
        <button class="btn btn-primary" @click="send">
          <i class="bi bi-send"></i>
        </button>
      </div>
    </div>
  </div>
</template>
