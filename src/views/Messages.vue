<script setup>
import { onMounted, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '../stores/chat';
import ConversationsList from '../components/ConversationsList.vue';
import ChatWindow from '../components/ChatWindow.vue';

const { t } = useI18n();
const chat = useChatStore();

// Mobile layout: show/hide sidebar (conversations list)
const showSidebarMobile = ref(true);
const hasActive = computed(() => !!chat.activeId);

onMounted(async () => {
  if (!chat.conversations.length) {
    await chat.loadConversations();
  }
  if (chat.activeId == null && chat.conversations[0]) {
    chat.open(chat.conversations[0].id);
  }
});

function selectConv(id) {
  chat.open(id);
  // On small screens, switch to chat view after selecting a conversation
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    showSidebarMobile.value = false;
  }
}

function showConversations() {
  showSidebarMobile.value = true;
}
</script>

<template>
  <div class="messages-page">
    <div class="row g-0">
      <!-- Conversations Sidebar (Sticky) -->
      <div
        class="col-12 col-md-4 col-lg-3 conversations-sidebar"
        :class="{
          'd-none d-md-block': !showSidebarMobile && hasActive
        }"
      >
        <ConversationsList @select="selectConv" />
      </div>
      
      <!-- Chat Window (Sticky layout inside) -->
      <div
        class="col-12 col-md-8 col-lg-9 chat-column"
        :class="{
          'd-none d-md-block': showSidebarMobile && !hasActive
        }"
      >
        <!-- Mobile: back button to conversations -->
        <div
          v-if="hasActive"
          class="chat-mobile-header d-md-none d-flex align-items-center px-3 py-2 border-bottom"
        >
          <button
            type="button"
            class="btn btn-link btn-sm px-0 me-2"
            @click="showConversations"
          >
            <i class="bi bi-arrow-left"></i>
          </button>
          <span class="fw-semibold">{{ $t('messages.chat') }}</span>
        </div>

        <ChatWindow v-if="chat.activeId" />
        <div v-else class="d-flex align-items-center justify-content-center h-100">
          <div class="text-center text-secondary">
            <i class="bi bi-chat-dots display-1 mb-3"></i>
            <h5>{{ $t('messages.selectConversation') }}</h5>
            <p class="text-muted">{{ $t('messages.chooseConversation') }}</p>
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

/* RTL: Move border to left side */
.rtl .conversations-sidebar {
  border-right: none;
  border-left: 1px solid #dee2e6;
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
    /* On small screens, use a normal scrolling layout instead of fixed viewport.
       This makes the page usable on phones where the fixed layout was cramped. */
    position: relative;
    top: 56px;
    left: 0;
    right: 0;
    bottom: auto;
    height: auto;
    min-height: calc(100vh - 56px);
    overflow: visible;
  }

  .conversations-sidebar {
    height: auto;
    max-height: none;
    border-right: none;
    border-bottom: 1px solid #dee2e6;
  }

  .rtl .conversations-sidebar {
    border-left: none;
    border-right: none;
    border-bottom: 1px solid #dee2e6;
  }

  .chat-column {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .chat-mobile-header {
    background-color: #fff;
    z-index: 5;
  }
}
</style>
