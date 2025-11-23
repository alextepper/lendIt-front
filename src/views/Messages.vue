<script setup>
import { onMounted } from 'vue';
import { useChatStore } from '../stores/chat';
import ConversationsList from '../components/ConversationsList.vue';
import ChatWindow from '../components/ChatWindow.vue';

const chat = useChatStore();

onMounted(async () => {
  if (!chat.conversations.length) await chat.loadConversations();
  if (chat.activeId == null && chat.conversations[0]) chat.open(chat.conversations[0].id);
});

function selectConv(id) {
  chat.open(id);
}
</script>

<template>
  <div class="messages-page">
    <div class="row g-0">
      <!-- Conversations Sidebar (Sticky) -->
      <div class="col-12 col-md-4 col-lg-3 conversations-sidebar">
        <ConversationsList @select="selectConv" />
      </div>
      
      <!-- Chat Window (Sticky layout inside) -->
      <div class="col-12 col-md-8 col-lg-9 chat-column">
        <ChatWindow v-if="chat.activeId" />
        <div v-else class="d-flex align-items-center justify-content-center h-100">
          <div class="text-center text-secondary">
            <i class="bi bi-chat-dots display-1 mb-3"></i>
            <h5>{{ $t('messages.selectConversation') }}</h5>
            <p class="text-muted">Choose a conversation to start messaging</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-page {
  position: fixed;
  top: 56px; /* Height of navbar */
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: #f8f9fa;
}

.conversations-sidebar {
  height: 100vh;
  max-height: calc(100vh - 56px);
  overflow-y: auto;
  border-right: 1px solid #dee2e6;
  background: #fff;
}

.chat-column {
  height: 100vh;
  max-height: calc(100vh - 56px);
  overflow: hidden;
  background: #fff;
}

/* Custom scrollbar for sidebar */
.conversations-sidebar::-webkit-scrollbar {
  width: 6px;
}

.conversations-sidebar::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.conversations-sidebar::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.conversations-sidebar::-webkit-scrollbar-thumb:hover {
  background: #555;
}

@media (max-width: 768px) {
  .messages-page {
    top: 56px;
  }
  
  .conversations-sidebar,
  .chat-column {
    max-height: calc(100vh - 56px);
  }
}
</style>
