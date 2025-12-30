<template>
  <div class="review-form">
    <div class="card">
      <div class="card-header">
        <h5 class="mb-0">
          <i class="bi bi-star-fill me-2"></i>
          Write a Review
        </h5>
      </div>
      <div class="card-body">
        <form @submit.prevent="handleSubmit">
          <!-- Review Type Selection -->
          <div class="mb-3">
            <label class="form-label">Review Type</label>
            <div class="btn-group w-100" role="group">
              <input 
                type="radio" 
                class="btn-check" 
                id="rental-experience" 
                v-model="form.subjectType" 
                value="RENTAL_EXPERIENCE"
              >
              <label class="btn btn-outline-primary" for="rental-experience">
                <i class="bi bi-box-seam me-1"></i>
                Rental Experience
              </label>
              
              <input 
                type="radio" 
                class="btn-check" 
                id="renter-review" 
                v-model="form.subjectType" 
                value="RENTER"
                :disabled="!canReviewRenter"
              >
              <label class="btn btn-outline-primary" for="renter-review" :class="{ 'disabled': !canReviewRenter }">
                <i class="bi bi-person-check me-1"></i>
                Review Renter
              </label>
            </div>
            <div v-if="!canReviewRenter" class="form-text text-muted">
              You can only review renters for orders you own
            </div>
          </div>

          <!-- Overall Rating -->
          <div class="mb-3">
            <label class="form-label">Overall Rating</label>
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

          <!-- Breakdown Ratings (for rental experience) -->
          <div v-if="form.subjectType === 'RENTAL_EXPERIENCE'" class="mb-3">
            <label class="form-label">Detailed Ratings</label>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small">Item Quality</label>
                <div class="rating-breakdown">
                  <i 
                    v-for="star in 5" 
                    :key="`quality-${star}`"
                    class="bi bi-star-fill star"
                    :class="{ 'active': star <= form.ratingsBreakdown.item_quality }"
                    @click="form.ratingsBreakdown.item_quality = star"
                  ></i>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Communication</label>
                <div class="rating-breakdown">
                  <i 
                    v-for="star in 5" 
                    :key="`comm-${star}`"
                    class="bi bi-star-fill star"
                    :class="{ 'active': star <= form.ratingsBreakdown.communication_with_owner }"
                    @click="form.ratingsBreakdown.communication_with_owner = star"
                  ></i>
                </div>
              </div>
            </div>
          </div>

          <!-- Breakdown Ratings (for renter review) -->
          <div v-if="form.subjectType === 'RENTER'" class="mb-3">
            <label class="form-label">Detailed Ratings</label>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small">Care of Item</label>
                <div class="rating-breakdown">
                  <i 
                    v-for="star in 5" 
                    :key="`care-${star}`"
                    class="bi bi-star-fill star"
                    :class="{ 'active': star <= form.ratingsBreakdown.care_of_item }"
                    @click="form.ratingsBreakdown.care_of_item = star"
                  ></i>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label small">Punctuality</label>
                <div class="rating-breakdown">
                  <i 
                    v-for="star in 5" 
                    :key="`punct-${star}`"
                    class="bi bi-star-fill star"
                    :class="{ 'active': star <= form.ratingsBreakdown.punctuality }"
                    @click="form.ratingsBreakdown.punctuality = star"
                  ></i>
                </div>
              </div>
            </div>
          </div>

          <!-- Title (for rental experience) -->
          <div v-if="form.subjectType === 'RENTAL_EXPERIENCE'" class="mb-3">
            <label for="review-title" class="form-label">Review Title</label>
            <input 
              type="text" 
              class="form-control" 
              id="review-title"
              v-model="form.title"
              placeholder="Summarize your experience"
              maxlength="100"
            >
            <div class="form-text">{{ form.title.length }}/100 characters</div>
          </div>

          <!-- Review Body (only for rental experience) -->
          <div v-if="form.subjectType === 'RENTAL_EXPERIENCE'" class="mb-3">
            <label for="review-body" class="form-label">Review Details</label>
            <textarea 
              class="form-control" 
              id="review-body"
              v-model="form.body"
              rows="4"
              placeholder="Tell others about your experience..."
              maxlength="1000"
            ></textarea>
            <div class="form-text">{{ form.body.length }}/1000 characters</div>
          </div>

          <!-- Photos (for rental experience) -->
          <div v-if="form.subjectType === 'RENTAL_EXPERIENCE'" class="mb-3">
            <label class="form-label">Photos (Optional)</label>
            <div class="photo-upload">
              <input 
                type="file" 
                ref="photoInput"
                @change="handlePhotoUpload"
                multiple
                accept="image/*"
                class="d-none"
              >
              <button 
                type="button" 
                class="btn btn-outline-secondary"
                @click="$refs.photoInput.click()"
              >
                <i class="bi bi-camera me-1"></i>
                Add Photos
              </button>
              <div v-if="form.photos.length > 0" class="photo-preview mt-2">
                <div 
                  v-for="(photo, index) in form.photos" 
                  :key="index"
                  class="photo-item"
                >
                  <img :src="photo" alt="Review photo" class="photo-thumbnail">
                  <button 
                    type="button" 
                    class="btn btn-sm btn-danger photo-remove"
                    @click="removePhoto(index)"
                  >
                    <i class="bi bi-x"></i>
                  </button>
                </div>
              </div>
            </div>
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
                Post anonymously
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
              {{ submitting ? 'Submitting...' : 'Submit Review' }}
            </button>
            <button 
              type="button" 
              class="btn btn-outline-secondary"
              @click="$emit('cancel')"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { createOrderReview } from '../services/reviewsService';
import { useUiStore } from '../stores/ui';

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
  }
});

const emit = defineEmits(['submit', 'cancel']);

const ui = useUiStore();

const submitting = ref(false);

const form = reactive({
  subjectType: props.defaultSubjectType,
  ratingOverall: 0,
  ratingsBreakdown: {
    item_quality: 0,
    communication_with_owner: 0,
    care_of_item: 0,
    punctuality: 0
  },
  title: '',
  body: '',
  photos: [],
  isAnonymous: false
});

const isFormValid = computed(() => {
  if (form.ratingOverall === 0) return false;
  
  if (form.subjectType === 'RENTAL_EXPERIENCE') {
    // For rental experience, body is required
    if (!form.body.trim()) return false;
    return form.ratingsBreakdown.item_quality > 0 && 
           form.ratingsBreakdown.communication_with_owner > 0;
  } else if (form.subjectType === 'RENTER') {
    // For renter review, body is optional
    return form.ratingsBreakdown.care_of_item > 0 && 
           form.ratingsBreakdown.punctuality > 0;
  }
  
  return true;
});

function getRatingText(rating) {
  const texts = {
    0: 'Select rating',
    1: 'Poor',
    2: 'Fair', 
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };
  return texts[rating] || 'Select rating';
}

function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        form.photos.push(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  });
}

function removePhoto(index) {
  form.photos.splice(index, 1);
}

async function handleSubmit() {
  if (!isFormValid.value) return;
  
  submitting.value = true;
  
  try {
    const reviewData = {
      subjectType: form.subjectType,
      ratingOverall: form.ratingOverall,
      ratingsBreakdown: { ...form.ratingsBreakdown },
      isAnonymous: form.isAnonymous
    };
    
    if (form.subjectType === 'RENTAL_EXPERIENCE') {
      reviewData.title = form.title;
      reviewData.body = form.body || '';
      reviewData.photos = form.photos;
    } else if (form.subjectType === 'RENTER') {
      // For renter reviews, body is optional but can be included if provided
      if (form.body && form.body.trim()) {
        reviewData.body = form.body;
      }
    }
    
    await createOrderReview(props.orderId, reviewData);
    
    ui.showToast('Review submitted successfully!', 'success');
    emit('submit', reviewData);
    
    // Reset form
    resetForm();
    
  } catch (error) {
    console.error('Failed to submit review:', error);
    ui.showToast(error?.response?.data?.message || 'Failed to submit review', 'danger');
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  form.subjectType = props.defaultSubjectType;
  form.ratingOverall = 0;
  form.ratingsBreakdown = {
    item_quality: 0,
    communication_with_owner: 0,
    care_of_item: 0,
    punctuality: 0
  };
  form.title = '';
  form.body = '';
  form.photos = [];
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
