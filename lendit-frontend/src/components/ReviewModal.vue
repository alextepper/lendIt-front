<template>
  <div 
    class="modal fade" 
    id="reviewModal" 
    tabindex="-1" 
    aria-labelledby="reviewModalLabel" 
    aria-hidden="true"
    ref="modal"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="reviewModalLabel">
            <i class="bi bi-star-fill me-2"></i>
            {{ isEditing ? 'Edit Review' : 'Write a Review' }}
          </h5>
          <button 
            type="button" 
            class="btn-close" 
            data-bs-dismiss="modal" 
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <ReviewForm
            v-if="!isEditing"
            :order-id="orderId"
            :can-review-renter="canReviewRenter"
            :default-subject-type="defaultSubjectType"
            @submit="handleReviewSubmit"
            @cancel="closeModal"
          />
          
          <div v-else class="edit-form">
            <!-- Edit form content would go here -->
            <p class="text-muted">Edit functionality coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Modal } from 'bootstrap';
import ReviewForm from './ReviewForm.vue';

const props = defineProps({
  orderId: {
    type: [String, Number],
    required: true
  },
  canReviewRenter: {
    type: Boolean,
    default: false
  },
  defaultSubjectType: {
    type: String,
    default: 'RENTAL_EXPERIENCE'
  },
  isEditing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'close']);

const modal = ref(null);
let modalInstance = null;

onMounted(() => {
  if (modal.value) {
    modalInstance = new Modal(modal.value);
    
    // Listen for modal events
    modal.value.addEventListener('hidden.bs.modal', handleModalClose);
  }
});

onUnmounted(() => {
  if (modal.value) {
    modal.value.removeEventListener('hidden.bs.modal', handleModalClose);
  }
});

function show() {
  if (modalInstance) {
    modalInstance.show();
  }
}

function hide() {
  if (modalInstance) {
    modalInstance.hide();
  }
}

function closeModal() {
  hide();
  emit('close');
}

function handleModalClose() {
  emit('close');
}

function handleReviewSubmit(reviewData) {
  emit('submit', reviewData);
  closeModal();
}

// Expose methods for parent components
defineExpose({
  show,
  hide
});
</script>

<style scoped>
.modal-lg {
  max-width: 800px;
}

.edit-form {
  padding: 2rem;
  text-align: center;
}
</style>