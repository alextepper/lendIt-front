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
  <h1 class="h4 mb-3">{{ $t('messages.title') }}</h1>
  <div class="row g-3">
    <div class="col-12 col-md-4 col-lg-3">
      <ConversationsList @select="selectConv" />
    </div>
    <div class="col-12 col-md-8 col-lg-9">
      <ChatWindow v-if="chat.activeId" />
      <div v-else class="card p-4 text-center text-secondary">{{ $t('messages.selectConversation') }}</div>
    </div>
  </div>
</template>
