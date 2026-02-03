<script setup>
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useRouter, useRoute } from 'vue-router'
import { ref, watch } from 'vue'
import { Modal } from 'bootstrap'
import { useI18n } from 'vue-i18n'
import { useAuthModal } from '../composables/useAuthModal'
import { requireAuth, resumePendingAction } from '../auth/requireAuth'

const props = defineProps({
  owner: { type: Object, required: true },
  itemId: { type: String, default: null },
});

const auth = useAuthStore()
const chat = useChatStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const { openLoginModal, closeModals } = useAuthModal()
const loading = ref(false)

function getOwnerInitials(name) {
  if (!name) return 'U'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatMemberSince(dateString) {
  if (!dateString) return t('ownerPanel.recently')
  const date = new Date(dateString)
  const options = { year: 'numeric', month: 'short' }
  const formatLocale = locale.value || 'en-US'
  return date.toLocaleDateString(formatLocale, options)
}

function closeParentModal() {
  // Find and close any open modal that contains this component
  const modalElement = document.getElementById('ownerModal')
  if (modalElement) {
    const modalInstance = Modal.getInstance(modalElement)
    if (modalInstance) {
      modalInstance.hide()
    }
  }
  
  // Also remove any leftover backdrops
  const backdrops = document.querySelectorAll('.modal-backdrop')
  backdrops.forEach(backdrop => backdrop.remove())
  
  // Remove modal-open class from body
  document.body.classList.remove('modal-open')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('padding-right')
}

async function messageOwner() {
  await requireAuth(
    { type: 'MESSAGE', ownerId: props.owner.id, itemId: props.itemId },
    async () => {
      loading.value = true
      try {
        const thread = await chat.createThread(props.owner.id, props.itemId)
        
        // Close modal before navigation
        closeParentModal()
        
        // Small delay to ensure modal is closed
        await new Promise(resolve => setTimeout(resolve, 100))
        
        router.push({ name: 'messages', query: { thread: thread.id } })
      } catch (e) {
        console.error('Failed to create thread:', e)
        alert(t('ownerPanel.failedToStartConversation'))
      } finally {
        loading.value = false
      }
    }
  )
}

// Resume pending action after auth - only if this component is responsible for MESSAGE actions
// Use a flag to prevent multiple executions
let hasResumed = false;
watch(() => auth.isAuthed, async (isAuthed) => {
  if (isAuthed && !hasResumed) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const action = await resumePendingAction({
      MESSAGE: async (action) => {
        // Only resume if this is the right owner/item
        if (action.ownerId === props.owner.id && action.itemId === props.itemId) {
          hasResumed = true;
          // Re-run messageOwner - it will now succeed since user is authenticated
          await messageOwner();
        }
      }
    });
    
    if (action) {
      closeModals();
    }
  }
}, { immediate: false });
</script>

<template>
  <div class="card p-3">
    <h6 class="mb-3">{{ $t('ownerPanel.title') }}</h6>
    
    <div class="d-flex align-items-start gap-3 mb-3">
      <!-- Owner Avatar -->
      <div class="owner-avatar">
        <img
          v-if="owner?.avatar"
          :src="owner.avatar"
          class="rounded-circle"
          width="60"
          height="60"
          :alt="$t('ownerPanel.ownerAlt')"
          style="object-fit: cover;"
        />
        <div
          v-else
          class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
          style="width: 60px; height: 60px; font-size: 1.25rem; font-weight: 600;"
        >
          {{ getOwnerInitials(owner?.username || owner?.name) }}
        </div>
      </div>
      
      <!-- Owner Details -->
      <div class="flex-grow-1">
        <div class="fw-semibold mb-1">{{ owner?.username || owner?.name || $t('ownerPanel.unknown') }}</div>
        
        <!-- Owner Rating -->
        <div class="d-flex align-items-center mb-2">
          <i class="bi bi-star-fill text-warning me-1"></i>
          <span class="fw-medium">{{ owner?.rating || owner?.ratingAvg || $t('ownerPanel.new') }}</span>
          <span v-if="owner?.reviewsCount || owner?.ratingCount" class="text-muted ms-1">
            ({{ owner?.reviewsCount || owner?.ratingCount }} {{ $t('ownerPanel.reviews') }})
          </span>
        </div>
        
        <!-- Member Since -->
        <div class="small text-muted">
          <i class="bi bi-calendar3 me-1"></i>
          {{ $t('ownerPanel.memberSince') }} {{ formatMemberSince(owner?.createdAt) }}
        </div>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="d-grid gap-2">
      <button
        v-if="auth.isAuthed && auth.user?.id !== owner?.id"
        class="btn btn-primary"
        :disabled="loading"
        @click="messageOwner"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
        <i v-else class="bi bi-chat-dots me-2"></i>
        {{ loading ? $t('ownerPanel.loading') : $t('ownerPanel.messageOwner') }}
      </button>
      <button
        v-else-if="!auth.isAuthed"
        class="btn btn-primary"
        @click="messageOwner"
      >
        <i class="bi bi-chat-dots me-2"></i>{{ $t('ownerPanel.loginToMessage') }}
      </button>
      <!-- <router-link
        class="btn btn-outline-secondary"
        :to="{ name: 'search', query: { owner: owner?.id } }"
      >
        <i class="bi bi-box-seam me-2"></i>View All Listings
      </router-link> -->
    </div>
  </div>
</template>

<style scoped>
.owner-avatar {
  flex-shrink: 0;
}

.card {
  border: 1px solid rgba(0, 0, 0, 0.125);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.1);
}
</style>
