<template>
  <div class="review-form">
    <div class="card">
      <div class="card-header">
        <h5 class="mb-0">
          <span v-if="form.subjectType === 'RENTER'">
                {{ $t('reviewForm.reviewingRenter') }}
              </span>
              <span v-else>
                {{ $t('reviewForm.reviewingRentalExperience') }}
              </span>
        </h5>
      </div>
      <div class="card-body">
        <form @submit.prevent="handleSubmit">
          <!-- Review Type Info (read-only, determined by user role) -->
          <div class="mb-3">
            <div class="alert alert-info mb-0">
              <i class="bi bi-info-circle me-2"></i>
              <span v-if="form.subjectType === 'RENTER'">
                {{ $t('reviewForm.reviewingRenter') }}
              </span>
              <span v-else>
                {{ $t('reviewForm.reviewingRentalExperience') }}
              </span>
            </div>
          </div>

          <!-- Overall Rating -->
          <div class="mb-3">
            <label class="form-label">{{ $t('reviewForm.overallRating') }}</label>
            <div class="rating-input">
              <div class="stars">
                <i 
                  v-for="star in 5" 
                  :key="star"
                  class="bi bi-star-fill star"
                  :class="{ 'active': star <= form.ratingOverall }"
                  @click="form.ratingOverall = star"
                ></i>
              </div>
              <span class="rating-text ms-2">{{ getRatingText(form.ratingOverall) }}</span>
            </div>
          </div>


          <!-- Title (for rental experience only) -->
          <div v-if="form.subjectType === 'RENTAL_EXPERIENCE'" class="mb-3">
            <label for="review-title" class="form-label">{{ $t('reviewForm.reviewTitle') }} <span class="text-danger">*</span></label>
            <input 
              type="text" 
              class="form-control" 
              id="review-title"
              v-model="form.title"
              :placeholder="$t('reviewForm.titlePlaceholder')"
              maxlength="100"
              required
            >
            <div class="form-text">{{ form.title.length }}/100 {{ $t('reviewForm.characters') }}</div>
          </div>

          <!-- Review Body -->
          <div class="mb-3">
            <label for="review-body" class="form-label">
              {{ $t('reviewForm.reviewDetails') }}
              <span class="text-muted small">{{ $t('reviewForm.optional') }}</span>
            </label>
            <textarea 
              class="form-control" 
              id="review-body"
              v-model="form.body"
              rows="4"
              :placeholder="form.subjectType === 'RENTAL_EXPERIENCE' ? $t('reviewForm.rentalExperiencePlaceholder') : $t('reviewForm.renterReviewPlaceholder')"
              maxlength="1000"
            ></textarea>
            <div class="form-text">{{ form.body.length }}/1000 {{ $t('reviewForm.characters') }}</div>
          </div>


          <!-- Anonymous Option -->
          <div class="mb-3">
            <div class="form-check">
              <input 
                class="form-check-input" 
                type="checkbox" 
                id="anonymous-review"
                v-model="form.isAnonymous"
              >
              <label class="form-check-label" for="anonymous-review">
                {{ $t('reviewForm.postAnonymously') }}
              </label>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="d-flex gap-2">
            <button 
              type="submit" 
              class="btn btn-primary"
              :disabled="!isFormValid || submitting"
            >
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-check-circle me-1"></i>
              {{ submitting ? $t('reviewForm.submitting') : $t('reviewForm.submitReview') }}
            </button>
            <button 
              type="button" 
              class="btn btn-outline-secondary"
              @click="$emit('cancel')"
            >
              {{ $t('reviewForm.cancel') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { createOrderReview } from '../services/reviewsService';
import { useUiStore } from '../stores/ui';

const props = defineProps({
  orderId: {
    type: [String, Number],
    required: true
  },
  bookingId: {
    type: [String, Number],
    default: null
  },
  canReviewRenter: {
    type: Boolean,
    default: false
  },
  defaultSubjectType: {
    type: String,
    default: 'RENTAL_EXPERIENCE'
  }
});

const emit = defineEmits(['submit', 'cancel']);

const { t } = useI18n();
const ui = useUiStore();

const submitting = ref(false);

const form = reactive({
  subjectType: props.defaultSubjectType, // Set by parent based on user role
  ratingOverall: 0,
  title: '',
  body: '',
  isAnonymous: false
});

const isFormValid = computed(() => {
  // Only require overall rating
  if (form.ratingOverall === 0) return false;
  
  // For rental experience, title is required
  if (form.subjectType === 'RENTAL_EXPERIENCE') {
    if (!form.title.trim()) {
      return false;
    }
  }
  
  return true;
});

function getRatingText(rating) {
  const texts = {
    0: t('reviewForm.selectRating'),
    1: t('reviewForm.poor'),
    2: t('reviewForm.fair'), 
    3: t('reviewForm.good'),
    4: t('reviewForm.veryGood'),
    5: t('reviewForm.excellent')
  };
  return texts[rating] || t('reviewForm.selectRating');
}


async function handleSubmit() {
  if (!isFormValid.value) return;
  
  submitting.value = true;
  
  try {
    const reviewData = {
      subjectType: form.subjectType,
      ratingOverall: form.ratingOverall,
      isAnonymous: form.isAnonymous
    };
    
    if (form.subjectType === 'RENTAL_EXPERIENCE') {
      // For rental experience, include title and body
      reviewData.title = form.title;
      reviewData.body = form.body || '';
    } else if (form.subjectType === 'RENTER') {
      // For renter reviews, body is optional but can be included if provided
      if (form.body && form.body.trim()) {
        reviewData.body = form.body;
      }
    }
    
    // Use bookingId if provided, otherwise fall back to orderId
    const idToUse = props.bookingId || props.orderId;
    await createOrderReview(idToUse, reviewData);
    
    ui.showToast(t('reviewForm.reviewSubmittedSuccess'), 'success');
    emit('submit', reviewData);
    
    // Reset form
    resetForm();
    
  } catch (error) {
    console.error('Failed to submit review:', error);
    ui.showToast(error?.response?.data?.message || t('reviewForm.reviewSubmitFailed'), 'danger');
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  form.subjectType = props.defaultSubjectType;
  form.ratingOverall = 0;
  form.title = '';
  form.body = '';
  form.isAnonymous = false;
}
</script>

<style scoped>
.review-form .card {
  border: none;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.rating-input .stars {
  display: flex;
  gap: 4px;
}

.rating-input .star {
  font-size: 1.5rem;
  color: #e9ecef;
  cursor: pointer;
  transition: color 0.2s;
}

.rating-input .star.active {
  color: #ffc107;
}

.rating-input .star:hover {
  color: #ffc107;
}

.rating-breakdown .star {
  font-size: 1.2rem;
  color: #e9ecef;
  cursor: pointer;
  transition: color 0.2s;
}

.rating-breakdown .star.active {
  color: #ffc107;
}

.rating-breakdown .star:hover {
  color: #ffc107;
}

.rating-text {
  font-weight: 500;
  color: #6c757d;
}

.photo-upload {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.photo-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.photo-item {
  position: relative;
  display: inline-block;
}

.photo-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.photo-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.btn-check:checked + .btn-outline-primary {
  background-color: #0d6efd;
  border-color: #0d6efd;
  color: white;
}

.btn-check:disabled + .btn-outline-primary {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
