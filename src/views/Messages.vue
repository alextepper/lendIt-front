<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useChatStore } from '../stores/chat';
import ConversationsList from '../components/ConversationsList.vue';
import ChatWindow from '../components/ChatWindow.vue';

const { t } = useI18n();
const chat = useChatStore();
const route = useRoute();

// Mobile layout: show/hide sidebar (conversations list)
const showSidebarMobile = ref(true);
const hasActive = computed(() => !!chat.activeId);

async function openConversationForUser(userId) {
  if (!userId) return;

  try {
    // Ensure conversations loaded
    if (!chat.conversations.length) {
      await chat.loadConversations();
    }

    // Create or get existing thread with this user
    const thread = await chat.createThread(userId);

    if (thread?.id) {
      await chat.open(thread.id);

      // On small screens, switch to chat view after selecting a conversation
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        showSidebarMobile.value = false;
      }
    }
  } catch (e) {
    console.error('Failed to open conversation for user:', userId, e);
  }
}

onMounted(async () => {
  // Always load conversations on mount
  if (!chat.conversations.length) {
    await chat.loadConversations();
  }

  const userId = route.query.userId;
  if (userId) {
    await openConversationForUser(userId);
  } else if (chat.activeId == null && chat.conversations[0]) {
    chat.open(chat.conversations[0].id);
  }
});

// React to userId changes in query (e.g., clicking different "message" links)
watch(
  () => route.query.userId,
  async (newUserId) => {
    if (newUserId) {
      await openConversationForUser(newUserId);
    }
  }
);

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
    <div class="messages-container container-fluid container-xl h-100">
      <div class="row g-0 messages-card shadow-sm rounded-3 overflow-hidden">
        <!-- Conversations Sidebar -->
        <div
          class="conversations-sidebar"
          :class="{
            'col-12 col-md-4 col-lg-3': hasActive,
            'col-12': !hasActive,
            'd-none d-md-block': !showSidebarMobile && hasActive
          }"
        >
          <ConversationsList @select="selectConv" />
        </div>
        
        <!-- Chat Window -->
        <div
          v-if="hasActive"
          class="col-12 col-md-8 col-lg-9 chat-column"
          :class="{
            'd-none d-md-block': showSidebarMobile
          }"
        >
          <!-- Mobile: back button to conversations -->
          <!-- <div
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
          </div> -->

          <ChatWindow v-if="chat.activeId" @back="showConversations" />
          <div v-else class="d-flex align-items-center justify-content-center h-100">
            <div class="text-center text-secondary p-4">
              <i class="bi bi-chat-dots display-1 mb-3"></i>
              <h5>{{ $t('messages.selectConversation') }}</h5>
              <p class="text-muted mb-0">{{ $t('messages.chooseConversation') }}</p>
            </div>
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
  background: radial-gradient(circle at top left, #e9f2ff 0, #f8f9fa 45%, #fdfdfd 100%);
}

.messages-container {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.messages-card {
  background: #ffffff;
  height: 100%;
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
    /* On small screens, use the dynamic viewport height so the chat
       fills the visible area and the input sticks above the keyboard. */
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    bottom: auto;
    height: calc(100vh - 56px);
    min-height: calc(100vh - 56px);
    overflow: hidden;
  }

  @supports (height: 100dvh) {
    .messages-page {
      height: calc(100dvh - 56px);
      min-height: calc(100dvh - 56px);
    }
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
