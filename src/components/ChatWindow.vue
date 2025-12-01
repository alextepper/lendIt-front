<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '../stores/chat';

const { t } = useI18n();
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
    alert(e?.response?.data?.message || e.message || t('messages.sendFailed'));
  }
}

function formatMessageTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

onMounted(scrollToBottom);
</script>

<template>
  <div class="chat-window">
    <!-- Chat Header (Sticky) -->
    <div class="chat-header">
      <img 
        :src="chat.activeConv?.avatar || chat.activeConv?.otherUser?.avatar || 'https://placehold.co/48x48'" 
        class="rounded-circle" 
        width="48" 
        height="48"
        style="object-fit: cover;"
      />
      <div class="flex-grow-1">
        <h6 class="mb-0">{{ chat.activeConv?.name || chat.activeConv?.otherUser?.username || $t('messages.chat') }}</h6>
        <div v-if="chat.activeConv?.item" class="small text-muted d-flex align-items-center">
          <i class="bi bi-box-seam me-1"></i>
          {{ chat.activeConv.item.title }}
        </div>
      </div>
      <button class="btn btn-outline-secondary btn-sm">
        <i class="bi bi-three-dots-vertical"></i>
      </button>
    </div>

    <!-- Messages Area (Scrollable) -->
    <div class="chat-messages">
      <div
        v-for="m in chat.activeMessages"
        :key="m.id"
        class="message-wrapper mb-3"
        :class="{ 'message-self': m.from_self }"
      >
        <div
          class="d-flex align-items-end message-row"
          :class="{ 'flex-row-reverse': m.from_self }"
        >
          <img
            class="message-avatar rounded-circle"
            :src="m.sender?.avatar || (m.from_self ? chat.activeConv?.otherUser?.avatar : chat.activeConv?.avatar) || 'https://placehold.co/32x32'"
            alt=""
          />
          <div class="message-bubble">
            <div class="message-text">{{ m.text }}</div>
            <div class="message-time">
              {{ formatMessageTime(m.created_at) }}
            </div>
          </div>
        </div>
      </div>
      <div ref="messagesEnd"></div>
    </div>

    <!-- Message Input (Sticky) -->
    <div class="chat-input">
      <div class="input-group">
        <input 
          v-model="input" 
          class="form-control" 
          :placeholder="$t('messages.typeMessage')" 
          @keyup.enter="send" 
        />
        <button class="btn btn-primary px-4" @click="send" :disabled="!input.trim()">
          <i class="bi bi-send-fill"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background-color: var(--bs-body-bg);
}

/* Chat Header - Sticky at top */
.chat-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--bs-body-bg);
  border-bottom: 1px solid #dee2e6;
  min-height: 80px;
  flex-shrink: 0;
}

/* Messages Area - Scrollable */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.75rem 0.75rem 0.5rem;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.02) 0%,
    rgba(0, 0, 0, 0) 40%,
    rgba(0, 0, 0, 0.03) 100%
  );
}

/* Custom scrollbar for messages */
.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Message bubbles */
.message-wrapper {
  display: flex;
  justify-content: flex-start;
}

.message-wrapper.message-self {
  justify-content: flex-end;
}

.message-row {
  gap: 0.5rem;
  max-width: 100%;
}

.message-bubble {
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  background-color: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  word-wrap: break-word;
  word-break: break-word;
}

.message-wrapper.message-self .message-bubble {
  background-color: var(--bs-primary);
  color: white;
}

.message-avatar {
  width: 32px;
  height: 32px;
  object-fit: cover;
}

.message-text {
  word-wrap: break-word;
  margin-bottom: 0.25rem;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
  text-align: right;
}

/* Chat Input - Sticky at bottom */
.chat-input {
  position: sticky;
  bottom: 0;
  z-index: 10;
  padding: 1rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  background-color: var(--bs-body-bg);
  border-top: 1px solid #dee2e6;
  flex-shrink: 0;
}

.input-group {
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  border-radius: 0.5rem;
  overflow: hidden;
}

.input-group .form-control {
  border: none;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
}

.input-group .form-control:focus {
  box-shadow: none;
  outline: none;
}

.input-group .btn {
  border: none;
  padding: 0.75rem 1.5rem;
}

.input-group .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .chat-header {
    min-height: 64px;
    padding: 0.5rem 0.75rem;
    gap: 0.75rem;
  }

  .chat-header img {
    width: 40px;
    height: 40px;
  }

  .chat-header h6 {
    font-size: 0.95rem;
  }

  .message-bubble {
    max-width: 85%;
    padding: 0.6rem 0.8rem;
  }

  .chat-input {
    padding: 0.5rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
  }

  .input-group .form-control {
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
  }

  .input-group .btn {
    padding: 0.6rem 1rem;
  }
}
</style>
