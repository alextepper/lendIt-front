<script setup>
import { nextTick, onMounted, ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '../stores/chat';
import { getItemPhotoUrl } from '../utils/imageUtils';

const { t } = useI18n();
const chat = useChatStore();
const input = ref('');
const messagesEnd = ref(null);

const emit = defineEmits(['back']);

// Get item image URL - uses primary image from item.photos[0]?.url
const itemImageUrl = computed(() => {
  if (!chat.activeConv?.item) return null;
  const item = chat.activeConv.item;
  // Use the primary image from photos[0]?.url (position 0)
  if (item.photos && item.photos.length > 0 && item.photos[0]?.url) {
    return getItemPhotoUrl(item.photos[0]);
  }
  // Fallback to thumbnail if available
  if (item.thumbnail) {
    return getItemPhotoUrl(item.thumbnail);
  }
  return null;
});

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
      <!-- Mobile back button -->
      <button
        type="button"
        class="btn btn-link btn-sm px-2 me-2 d-md-none chat-back-btn"
        @click="emit('back')"
        :aria-label="$t('messages.backToConversations')"
      >
        <i class="bi bi-arrow-left"></i>
      </button>
      
      <img 
        v-if="itemImageUrl"
        :src="itemImageUrl" 
        class="rounded" 
        width="48"
        height="48"
        style="object-fit: cover;"
      />
      <div 
        v-else
        class="rounded d-flex align-items-center justify-content-center bg-light"
        style="width: 48px; height: 48px;"
      >
        <i class="bi bi-box text-muted"></i>
      </div>
      <div class="flex-grow-1">
        <h6 class="mb-0">
          <router-link
            v-if="chat.activeConv?.item"
            :to="{ name: 'item', params: { id: chat.activeConv.item.id } }"
            class="text-decoration-none text-dark item-link"
            @click.stop
          >
            {{ chat.activeConv.item.title }}
          </router-link>
          <span v-else>{{ chat.activeConv?.name || chat.activeConv?.otherUser?.username || $t('messages.chat') }}</span>
        </h6>
        <div v-if="chat.activeConv?.item" class="small text-muted d-flex align-items-center">
          <i class="bi bi-person me-1"></i>
          {{ chat.activeConv?.name || chat.activeConv?.otherUser?.username || chat.activeConv?.userB?.username }}
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

.chat-back-btn {
  color: var(--bs-body-color);
  text-decoration: none;
  padding: 0.5rem;
  margin: -0.5rem;
  flex-shrink: 0;
}

.chat-back-btn:hover {
  color: var(--bs-primary);
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 0.375rem;
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

.item-link {
  transition: color 0.2s ease;
}

.item-link:hover {
  color: var(--bs-primary) !important;
  text-decoration: underline !important;
}
</style>
