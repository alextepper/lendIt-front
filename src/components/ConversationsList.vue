<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '../stores/chat';

const { t } = useI18n();
const chat = useChatStore();
const emit = defineEmits(['select']);
const q = ref('');
const activeTab = ref('active'); // 'active' or 'archived'

const currentList = computed(() => {
  return activeTab.value === 'active' ? chat.conversations : chat.archivedConversations;
});

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return currentList.value
    .filter((c) => {
      if (!s) return true;
      const name = (c.name || c.otherUser?.username || '').toLowerCase();
      const title = (c.item?.title || '').toLowerCase();
      return name.includes(s) || title.includes(s);
    })
    .sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
});

watch(() => chat.activeId, (v) => chat.markRead(v));

watch(activeTab, (newTab) => {
  if (newTab === 'archived' && chat.archivedConversations.length === 0) {
    chat.loadArchivedConversations();
  }
});

onMounted(() => {
  // Load archived conversations on mount if needed
  if (activeTab.value === 'archived') {
    chat.loadArchivedConversations();
  }
});

function getDisplayName(conversation) {
  return conversation.name || conversation.otherUser?.username || t('messages.unknownUser');
}

async function handleArchive(conversationId, archived) {
  try {
    await chat.toggleArchive(conversationId, archived);
  } catch (error) {
    console.error('Failed to toggle archive:', error);
  }
}

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return t('messages.justNow');
  if (diffMins < 60) return t('messages.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('messages.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('messages.daysAgo', { count: diffDays });
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
</script>

<template>
  <div class="conversations-list h-100 d-flex flex-column">
    <div class="conversations-header p-3 border-bottom">
      <h5 class="mb-0">{{ $t('messages.title') }}</h5>
    </div>
    
    <!-- Tabs -->
    <div class="border-bottom">
      <ul class="nav nav-tabs px-3 pt-2" style="border-bottom: none;">
        <li class="nav-item">
          <button 
            class="nav-link" 
            :class="{ active: activeTab === 'active' }"
            @click="activeTab = 'active'"
          >
            <i class="bi bi-inbox me-1"></i>
            {{ $t('messages.active') }}
          </button>
        </li>
        <li class="nav-item">
          <button 
            class="nav-link" 
            :class="{ active: activeTab === 'archived' }"
            @click="activeTab = 'archived'"
          >
            <i class="bi bi-archive me-1"></i>
            {{ $t('messages.archived') }}
            <span 
              v-if="chat.archivedConversations.length > 0" 
              class="badge bg-secondary ms-2"
            >
              {{ chat.archivedConversations.length }}
            </span>
          </button>
        </li>
      </ul>
    </div>
    
    <!-- <div class="p-3 border-bottom">
      <div class="input-group">
        <span class="input-group-text bg-transparent border-end-0">
          <i class="bi bi-search"></i>
        </span>
        <input 
          v-model="q" 
          class="form-control border-start-0" 
          :placeholder="$t('messages.search')" 
        />
      </div>
    </div> -->
    
    <div class="conversations-scroll flex-grow-1 overflow-auto">
      <div class="list-group list-group-flush">
        <div
          v-for="c in filtered"
          :key="c.id"
          class="list-group-item border-0 py-3 conversation-item"
          :class="{ active: c.id === chat.activeId }"
        >
          <div class="d-flex gap-3 align-items-start">
            <div class="position-relative" @click="emit('select', c.id)" style="cursor: pointer;">
              <img
                :src="c.avatar || c.otherUser?.avatar || 'https://placehold.co/48x48'"
                class="rounded-circle"
                width="48"
                height="48"
                style="object-fit: cover;"
              />
              <span 
                v-if="c.unread" 
                class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
              >
                {{ c.unread }}
              </span>
            </div>
            
            <div class="flex-grow-1 min-width-0" @click="emit('select', c.id)" style="cursor: pointer;">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <strong class="text-truncate me-2">{{ getDisplayName(c) }}</strong>
                <small class="text-muted flex-shrink-0">{{ formatTime(c.last_at) }}</small>
              </div>
              
              <div class="small text-truncate" :class="c.unread ? 'fw-semibold' : 'text-muted'">
                <span v-if="c.item" class="me-1">📦</span>
                <span v-if="c.last_text">{{ c.last_text }}</span>
                <span v-else class="fst-italic">{{ $t('messages.startConversation') }}</span>
              </div>
              
              <div v-if="c.item" class="small text-muted text-truncate mt-1">
                {{ c.item.title }}
              </div>
            </div>

            <!-- Archive/Unarchive button -->
            <button
              class="btn btn-sm btn-link text-muted archive-btn p-1"
              :title="activeTab === 'active' ? $t('messages.archive') : $t('messages.unarchive')"
              @click.stop="handleArchive(c.id, activeTab === 'active')"
            >
              <i 
                class="bi"
                :class="activeTab === 'active' ? 'bi-archive' : 'bi-archive-fill'"
              ></i>
            </button>
          </div>
        </div>
        
        <div v-if="chat.loadingArchived && activeTab === 'archived'" class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted">{{ $t('messages.loadingArchived') }}</p>
        </div>
        
        <div v-else-if="filtered.length === 0" class="text-center py-5">
          <i 
            class="bi display-4 text-muted mb-3 d-block"
            :class="activeTab === 'active' ? 'bi-inbox' : 'bi-archive'"
          ></i>
          <p class="text-muted">
            {{ activeTab === 'active' ? $t('messages.noConversations') : $t('messages.noArchivedConversations') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conversations-list {
  background-color: var(--bs-body-bg);
}

.conversations-header {
  background-color: var(--bs-body-bg);
}

.conversations-scroll {
  height: 100%;
}

.conversation-item {
  transition: background-color 0.2s ease;
}

.conversation-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.conversation-item.active {
  background-color: rgba(13, 110, 253, 0.1) !important;
  border-left: 3px solid var(--bs-primary);
}

.min-width-0 {
  min-width: 0;
}

.input-group-text {
  border: 1px solid var(--bs-border-color);
}

.form-control {
  border: 1px solid var(--bs-border-color);
}

.input-group-text:focus-within {
  border-color: var(--bs-primary);
}

/* Tab styling */
.nav-tabs {
  background-color: var(--bs-body-bg);
}

.nav-tabs .nav-link {
  border: none;
  background: transparent;
  color: var(--bs-secondary);
  padding: 0.5rem 1rem;
  transition: all 0.2s ease;
}

.nav-tabs .nav-link:hover {
  color: var(--bs-primary);
  background-color: rgba(13, 110, 253, 0.05);
}

.nav-tabs .nav-link.active {
  color: var(--bs-primary);
  background-color: transparent;
  border-bottom: 2px solid var(--bs-primary);
  font-weight: 500;
}

/* Archive button */
.archive-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
  text-decoration: none !important;
  font-size: 1.1rem;
  line-height: 1;
}

.conversation-item:hover .archive-btn {
  opacity: 1;
}

.archive-btn:hover {
  color: var(--bs-primary) !important;
}
</style>
