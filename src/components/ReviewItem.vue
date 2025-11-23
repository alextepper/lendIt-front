<template>
  <div class="review-item">
    <div class="card">
      <div class="card-body">
        <!-- Review Header -->
        <div class="review-header">
          <div class="reviewer-info">
            <div class="reviewer-avatar">
              <img 
                v-if="review.reviewer?.avatar && !review.isAnonymous" 
                :src="review.reviewer.avatar" 
                :alt="review.reviewer.name"
                class="avatar-img"
              />
              <div v-else class="avatar-placeholder">
                <i class="bi bi-person-fill"></i>
              </div>
            </div>
            <div class="reviewer-details">
              <div class="reviewer-name-row">
                <h6 class="reviewer-name">
                  {{ review.isAnonymous ? 'Anonymous' : (review.reviewer?.username || 'Unknown') }}
                </h6>
                <div class="review-rating-mobile d-md-none">
                  <div class="stars">
                    <i 
                      v-for="star in 5" 
                      :key="star"
                      class="bi bi-star-fill"
                      :class="{ 'active': star <= review.ratingOverall }"
                    ></i>
                  </div>
                </div>
              </div>
              <div class="review-meta">
                <span class="review-type badge" :class="getTypeBadgeClass()">
                  {{ getTypeText() }}
                </span>
                <span class="review-date">{{ formatDate(review.createdAt) }}</span>
              </div>
            </div>
          </div>
          <div class="review-rating d-none d-md-block">
            <div class="overall-rating">
              <div class="stars">
                <i 
                  v-for="star in 5" 
                  :key="star"
                  class="bi bi-star-fill"
                  :class="{ 'active': star <= review.ratingOverall }"
                ></i>
              </div>
              <span class="rating-text">{{ getRatingText(review.ratingOverall) }}</span>
            </div>
          </div>
        </div>

        <!-- Review Title (for rental experience) -->
        <div v-if="review.title" class="review-title">
          <h6 class="mb-0">{{ review.title }}</h6>
        </div>

        <!-- Breakdown Ratings -->
        <div v-if="review.ratingsBreakdown" class="breakdown-ratings">
          <div class="row g-2">
            <div 
              v-for="(rating, key) in getBreakdownRatings()" 
              :key="key"
              class="col-md-6"
            >
              <div class="breakdown-item">
                <span class="breakdown-label">{{ rating.label }}</span>
                <div class="breakdown-stars">
                  <i 
                    v-for="star in 5" 
                    :key="star"
                    class="bi bi-star-fill"
                    :class="{ 'active': star <= rating.value }"
                  ></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Review Content -->
        <div class="review-content">
          <div class="review-text-container">
            <p class="review-text" :class="{ 'truncated': !showFullText && review.body.length > 100 }">
              {{ showFullText ? review.body : (review.body.length > 100 ? review.body.substring(0, 100) + '...' : review.body) }}
            </p>
            <button 
              v-if="review.body.length > 100"
              class="btn btn-link btn-sm show-more-btn p-0"
              @click="toggleText"
            >
              {{ showFullText ? 'Show less' : 'Show more' }}
            </button>
          </div>
          
          <!-- Photos -->
          <div v-if="review.photos && review.photos.length > 0" class="review-photos">
            <div class="photo-grid">
              <div 
                v-for="(photo, index) in review.photos" 
                :key="index"
                class="photo-item"
                @click="openPhotoModal(photo, index)"
              >
                <img :src="photo" :alt="`Review photo ${index + 1}`" class="photo-img">
              </div>
            </div>
          </div>
        </div>

        <!-- Review Response -->
        <div v-if="review.response" class="review-response">
          <div class="response-header">
            <i class="bi bi-reply me-1"></i>
            <strong>Owner Response</strong>
            <span class="response-date">{{ formatDate(review.response.createdAt) }}</span>
          </div>
          <p class="response-text">{{ review.response.responseText }}</p>
        </div>

        <!-- Review Actions -->
        <div class="review-actions">
          <div class="action-buttons">
            <button 
              class="btn btn-sm btn-outline-primary"
              :class="{ 'active': review.isHelpful }"
              @click="toggleHelpful"
              :disabled="helpfulLoading"
            >
              <i class="bi bi-hand-thumbs-up me-1"></i>
              <span class="d-none d-sm-inline">Helpful</span>
              <span class="d-sm-none">👍</span>
              <span class="ms-1">({{ review.helpfulCount || 0 }})</span>
            </button>
            
            <button 
              v-if="canRespond"
              class="btn btn-sm btn-outline-secondary"
              @click="showResponseForm = !showResponseForm"
            >
              <i class="bi bi-reply me-1"></i>
              <span class="d-none d-sm-inline">Respond</span>
              <span class="d-sm-none">Reply</span>
            </button>
            
            <div class="dropdown">
              <button 
                class="btn btn-sm btn-outline-secondary dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-label="More actions"
              >
                <i class="bi bi-three-dots"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <button class="dropdown-item" @click="handleReportReview">
                    <i class="bi bi-flag me-2"></i>
                    Report
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Response Form -->
        <div v-if="showResponseForm" class="response-form mt-3">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">Respond to Review</h6>
              <form @submit.prevent="submitResponse">
                <div class="mb-3">
                  <textarea 
                    class="form-control"
                    v-model="responseText"
                    rows="3"
                    placeholder="Write your response..."
                    maxlength="500"
                  ></textarea>
                  <div class="form-text">{{ responseText.length }}/500 characters</div>
                </div>
                <div class="d-flex gap-2">
                  <button 
                    type="submit" 
                    class="btn btn-primary btn-sm"
                    :disabled="!responseText.trim() || responseLoading"
                  >
                    <span v-if="responseLoading" class="spinner-border spinner-border-sm me-1"></span>
                    Submit Response
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-outline-secondary btn-sm"
                    @click="cancelResponse"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { 
  markReviewHelpful, 
  unmarkReviewHelpful, 
  respondToReview, 
  reportReview as reportReviewAPI 
} from '../services/reviewsService';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
  review: {
    type: Object,
    required: true
  },
  canRespond: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update', 'respond']);

const ui = useUiStore();
const auth = useAuthStore();

const showResponseForm = ref(false);
const responseText = ref('');
const helpfulLoading = ref(false);
const responseLoading = ref(false);
const showFullText = ref(false);

function getTypeText() {
  const types = {
    'RENTAL_EXPERIENCE': 'Rental Experience',
    'RENTER': 'Renter Review'
  };
  return types[props.review.subjectType] || 'Review';
}

function getTypeBadgeClass() {
  const classes = {
    'RENTAL_EXPERIENCE': 'bg-primary',
    'RENTER': 'bg-success'
  };
  return classes[props.review.subjectType] || 'bg-secondary';
}

function getRatingText(rating) {
  const texts = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };
  return texts[rating] || 'Unknown';
}

function getBreakdownRatings() {
  const breakdown = props.review.ratingsBreakdown || {};
  const ratings = [];
  
  if (breakdown.item_quality !== undefined) {
    ratings.push({ key: 'item_quality', label: 'Item Quality', value: breakdown.item_quality });
  }
  if (breakdown.communication_with_owner !== undefined) {
    ratings.push({ key: 'communication_with_owner', label: 'Communication', value: breakdown.communication_with_owner });
  }
  if (breakdown.care_of_item !== undefined) {
    ratings.push({ key: 'care_of_item', label: 'Care of Item', value: breakdown.care_of_item });
  }
  if (breakdown.punctuality !== undefined) {
    ratings.push({ key: 'punctuality', label: 'Punctuality', value: breakdown.punctuality });
  }
  
  return ratings;
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function toggleHelpful() {
  if (helpfulLoading.value) return;
  
  helpfulLoading.value = true;
  
  try {
    if (props.review.isHelpful) {
      await unmarkReviewHelpful(props.review.id);
      props.review.isHelpful = false;
      props.review.helpfulCount = Math.max(0, (props.review.helpfulCount || 0) - 1);
    } else {
      await markReviewHelpful(props.review.id);
      props.review.isHelpful = true;
      props.review.helpfulCount = (props.review.helpfulCount || 0) + 1;
    }
    
    emit('update');
  } catch (error) {
    console.error('Failed to toggle helpful:', error);
    ui.showToast('Failed to update helpful status', 'danger');
  } finally {
    helpfulLoading.value = false;
  }
}

async function submitResponse() {
  if (!responseText.value.trim() || responseLoading.value) return;
  
  responseLoading.value = true;
  
  try {
    await respondToReview(props.review.id, responseText.value);
    
    // Add response to review
    props.review.response = {
      responseText: responseText.value,
      createdAt: new Date().toISOString()
    };
    
    ui.showToast('Response submitted successfully!', 'success');
    showResponseForm.value = false;
    responseText.value = '';
    
    emit('respond', props.review);
  } catch (error) {
    console.error('Failed to submit response:', error);
    ui.showToast('Failed to submit response', 'danger');
  } finally {
    responseLoading.value = false;
  }
}

function cancelResponse() {
  showResponseForm.value = false;
  responseText.value = '';
}

async function handleReportReview() {
  const reason = prompt('Please select a reason:\n1. Inappropriate content\n2. Spam\n3. Misleading\n4. Other');
  if (!reason) return;
  
  const details = prompt('Please provide additional details (optional):');
  
  try {
    await reportReviewAPI(props.review.id, reason, details || '');
    ui.showToast('Review reported successfully', 'success');
  } catch (error) {
    console.error('Failed to report review:', error);
    ui.showToast('Failed to report review', 'danger');
  }
}

function toggleText() {
  showFullText.value = !showFullText.value;
}

function openPhotoModal(photo, index) {
  // TODO: Implement photo modal
  console.log('Open photo modal:', photo, index);
}
</script>

<style scoped>
.review-item .card {
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 1rem;
}

.reviewer-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.reviewer-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
  font-size: 1rem;
}

.reviewer-details {
  flex: 1;
  min-width: 0;
}

.reviewer-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.reviewer-name {
  margin: 0;
  font-weight: 600;
  color: #212529;
  font-size: 0.95rem;
  line-height: 1.2;
  word-break: break-word;
}

.review-rating-mobile .stars {
  display: flex;
  gap: 1px;
}

.review-rating-mobile .stars .bi-star-fill {
  color: #e9ecef;
  font-size: 0.9rem;
}

.review-rating-mobile .stars .bi-star-fill.active {
  color: #ffc107;
}

.review-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.review-type {
  font-size: 0.7rem;
  padding: 2px 6px;
  white-space: nowrap;
}

.review-date {
  font-size: 0.8rem;
  color: #6c757d;
  white-space: nowrap;
}

.review-rating {
  text-align: right;
  flex-shrink: 0;
}

.overall-rating {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.stars {
  display: flex;
  gap: 1px;
}

.stars .bi-star-fill {
  color: #e9ecef;
  font-size: 1rem;
}

.stars .bi-star-fill.active {
  color: #ffc107;
}

.rating-text {
  font-weight: 500;
  color: #6c757d;
  font-size: 0.8rem;
  white-space: nowrap;
}

.review-title {
  margin-bottom: 0.75rem;
}

.breakdown-ratings {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.breakdown-label {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
}

.breakdown-stars .bi-star-fill {
  color: #e9ecef;
  font-size: 0.9rem;
}

.breakdown-stars .bi-star-fill.active {
  color: #ffc107;
}

.review-content {
  margin-bottom: 1rem;
}

.review-text-container {
  position: relative;
}

.review-text {
  margin: 0;
  line-height: 1.6;
  color: #495057;
  font-size: 0.9rem;
  word-break: break-word;
}

.review-text.truncated {
  margin-bottom: 0.5rem;
}

.show-more-btn {
  color: #0d6efd;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0;
  margin-top: 0.25rem;
  display: inline-block;
}

.show-more-btn:hover {
  color: #0a58ca;
  text-decoration: underline;
}

.review-photos {
  margin-top: 0.75rem;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.photo-item {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.photo-item:hover {
  border-color: #0d6efd;
}

.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.review-response {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #0d6efd;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.response-date {
  margin-left: auto;
  font-size: 0.75rem;
}

.response-text {
  margin: 0;
  font-style: italic;
  color: #495057;
}

.review-actions {
  border-top: 1px solid #e9ecef;
  padding-top: 0.75rem;
  margin-top: 0.5rem;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.action-buttons .btn {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

.btn.active {
  background-color: #0d6efd;
  border-color: #0d6efd;
  color: white;
}

.dropdown-menu {
  font-size: 0.85rem;
}

.dropdown-item {
  padding: 0.375rem 0.75rem;
  font-size: 0.85rem;
}

.response-form .card {
  border: 1px solid #dee2e6;
}

@media (max-width: 768px) {
  .review-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .reviewer-info {
    gap: 10px;
  }
  
  .reviewer-avatar {
    width: 36px;
    height: 36px;
  }
  
  .avatar-placeholder {
    font-size: 0.9rem;
  }
  
  .reviewer-name {
    font-size: 0.9rem;
  }
  
  .review-meta {
    gap: 6px;
  }
  
  .review-type {
    font-size: 0.65rem;
    padding: 1px 4px;
  }
  
  .review-date {
    font-size: 0.75rem;
  }
  
  .review-rating {
    text-align: left;
  }
  
  .overall-rating {
    justify-content: flex-start;
    gap: 4px;
  }
  
  .stars .bi-star-fill {
    font-size: 0.9rem;
  }
  
  .rating-text {
    font-size: 0.75rem;
  }
  
  .action-buttons {
    justify-content: flex-start;
    gap: 4px;
  }
  
  .action-buttons .btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
  }
  
  .review-text {
    font-size: 0.85rem;
  }
  
  .show-more-btn {
    font-size: 0.8rem;
  }
}

@media (max-width: 576px) {
  .review-header {
    gap: 0.5rem;
  }
  
  .reviewer-info {
    gap: 8px;
  }
  
  .reviewer-avatar {
    width: 32px;
    height: 32px;
  }
  
  .avatar-placeholder {
    font-size: 0.8rem;
  }
  
  .reviewer-name {
    font-size: 0.85rem;
  }
  
  .review-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .review-type {
    font-size: 0.6rem;
  }
  
  .review-date {
    font-size: 0.7rem;
  }
  
  .action-buttons {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .action-buttons .btn {
    justify-content: center;
    font-size: 0.7rem;
    padding: 0.3rem 0.5rem;
  }
  
  .dropdown {
    width: 100%;
  }
  
  .dropdown .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
