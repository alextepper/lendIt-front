<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import StarRating from './StarRating.vue';
import ReviewItem from './ReviewItem.vue';
import ReviewModal from './ReviewModal.vue';
import { 
  fetchReviews, 
  createReview
} from '../services/reviewsService';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { useAuthModal } from '../composables/useAuthModal';

const { t } = useI18n();

const props = defineProps({ 
  item: { type: Object, required: true },
  canReview: { type: Boolean, default: true },
  reviews: { type: Array, default: null },
  loading: { type: Boolean, default: null },
  error: { type: String, default: null },
  orderId: { type: [String, Number], default: null },
  canReviewRenter: { type: Boolean, default: false }
});

const emit = defineEmits(['refresh', 'review-submitted']);
const ui = useUiStore();
const auth = useAuthStore();
const { openLoginModal } = useAuthModal();

const data = ref({ items: [], page: 1, total_pages: 1 });
const internalLoading = ref(true);
const showModal = ref(false);
const reviewModal = ref(null);

// Use passed reviews data or internal loading state
const isLoading = computed(() => props.loading !== null ? props.loading : internalLoading.value);
const reviewsData = computed(() => props.reviews || data.value.items);

// Sort options
const sortOptions = computed(() => [
  { value: 'NEWEST', label: t('reviews.sort.newest') },
  { value: 'OLDEST', label: t('reviews.sort.oldest') },
  { value: 'RATING', label: t('reviews.sort.rating') },
  { value: 'HELPFUL', label: t('reviews.sort.helpful') }
]);
const selectedSort = ref('NEWEST');

async function load(page = 1) {
  // Only load if reviews are not provided via props
  if (props.reviews !== null) {
    return;
  }
  
  internalLoading.value = true;
  try {
    const r = await fetchReviews(props.item.id, { page, per_page: 6 });
    data.value = r;
  } finally { 
    internalLoading.value = false; 
  }
}

// Load data if not provided via props
onMounted(() => {
  if (props.reviews === null) {
    load(1);
  }
});

// Watch for itemId changes
watch(() => props.item.id, () => {
  if (props.reviews === null) {
    load(1);
  }
});

// Watch for sort changes
watch(selectedSort, () => {
  if (props.reviews === null) {
    load(1);
  } else {
    // If using external reviews, emit sort change
    emit('refresh');
  }
});

async function onSubmitReview(payload) {
  try {
    await createReview(props.item.id, payload);
    ui.showToast(t('reviews.thanksForReview'), 'success');
    // Emit refresh event to parent component
    emit('refresh');
    // Also reload if we're managing our own data
    if (props.reviews === null) {
      load(1);
    }
  } catch (e) {
    ui.showToast(e?.response?.data?.message || e.message, 'danger');
  }
}

function handleReviewSubmit(reviewData) {
  emit('review-submitted', reviewData);
  showModal.value = false;
}

function showReviewModal() {
  showModal.value = true;
}

function closeReviewModal() {
  showModal.value = false;
}
</script>

<template>
  <div class="card p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h6 mb-0">{{ $t('reviews.title', { count: item.ratingCount }) }}</h2>
      <div class="d-flex gap-2 align-items-center">
        <!-- Sort Dropdown -->
        <select 
          v-if="reviewsData.length > 0" 
          class="form-select form-select-sm" 
          style="width: auto;"
          v-model="selectedSort"
        >
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        
        <!-- Write Review Button -->
        <!-- <button 
          v-if="auth.isAuthed && canReview" 
          class="btn btn-sm btn-outline-primary" 
          @click="showReviewModal"
        >
          <i class="bi bi-pencil-square me-1"></i>Write a review
        </button>
        <button 
          v-else-if="!auth.isAuthed && canReview" 
          class="btn btn-sm btn-outline-primary" 
          @click="openLoginModal(`/item/${props.item.id}`)"
        >
          Sign in to review
        </button> -->
      </div>
    </div>

    <!-- Aggregate -->
    <div class="row g-3">
      <div class="col-md-4">
        <div class="border rounded p-3 text-center">
          <div class="display-6 fw-bold">{{ item.ratingAvg?.toFixed?.(1) || '0.0' }}</div>
          <div class="mb-1 rating-star-container">
            <i class="bi bi-star-fill rating-star-bg"></i>
            <i class="bi bi-star-fill rating-star-fill" :style="{ width: ((item.ratingAvg || 0) / 5) * 100 + '%' }"></i>
          </div>
          <div class="small text-secondary">{{ $t('reviews.reviewsCount', { count: item.ratingCount }) }}</div>
        </div>
      </div>
      <div class="col-md-8">
        <div v-for="s in [5, 4, 3, 2, 1]" :key="s" class="d-flex align-items-center gap-2 small">
          <span style="width: 20px">{{ s }}</span>
          <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="item.ratingHistogram?.[s] || 0" aria-valuemin="0" :aria-valuemax="item.ratingCount || 1">
            <div class="progress-bar" :style="{ width: ((item.ratingHistogram?.[s] || 0) / (item.ratingCount || 1)) * 100 + '%' }"></div>
          </div>
          <span class="text-secondary" style="width: 28px">{{ item.ratingHistogram?.[s] || 0 }}</span>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="props.error" class="mt-3">
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ props.error }}
        <button class="btn btn-sm btn-outline-warning ms-2" @click="emit('refresh')">
          <i class="bi bi-arrow-clockwise me-1"></i>
          {{ $t('reviews.retry') }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="mt-3">
      <div v-if="isLoading" class="small text-secondary">{{ $t('reviews.loading') }}</div>
      <div v-else-if="reviewsData.length === 0" class="text-center py-4 text-muted">
        <i class="bi bi-star display-4 d-block mb-2"></i>
        <div>{{ $t('reviews.noReviews') }}</div>
        <small>{{ $t('reviews.beFirst') }}</small>
      </div>
      <div v-else>
        <ReviewItem
          v-for="review in reviewsData"
          :key="review.id"
          :review="review"
          :can-respond="false"
          @update="emit('refresh')"
        />

        <div class="d-flex justify-content-center gap-2 mt-3" v-if="data.total_pages > 1">
          <button class="btn btn-outline-secondary btn-sm" :disabled="data.page <= 1" @click="load(data.page - 1)">{{ $t('reviews.prev') }}</button>
          <span class="small text-secondary">{{ $t('reviews.page', { current: data.page, total: data.total_pages }) }}</span>
          <button class="btn btn-outline-secondary btn-sm" :disabled="data.page >= data.total_pages" @click="load(data.page + 1)">{{ $t('reviews.next') }}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Review Modal -->
  <ReviewModal
    v-if="showModal"
    :order-id="orderId || item.id"
    :can-review-renter="canReviewRenter"
    :default-subject-type="'RENTAL_EXPERIENCE'"
    @submit="handleReviewSubmit"
    @close="closeReviewModal"
  />
</template>

<style scoped>
.rating-star-container {
  position: relative;
  display: inline-block;
  font-size: 2rem;
  line-height: 1;
}

.rating-star-bg {
  color: #e0e0e0; /* Light gray background star */
}

.rating-star-fill {
  position: absolute;
  left: 0;
  top: 0;
  color: #ffc107; /* Yellow/gold color for filled portion */
  overflow: hidden;
  white-space: nowrap;
}
</style>

