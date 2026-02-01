<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { getUserById } from '../services/userService';
import { fetchUserListings, fetchListings } from '../services/listingsService';
import { fetchItemReviews } from '../services/reviewsService';
import ItemCard from '../components/ItemCard.vue';
import StarRating from '../components/StarRating.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const ui = useUiStore();
const auth = useAuthStore();

// State
const user = ref(null);
const listings = ref([]);
const inactiveListings = ref([]);
const reviews = ref([]);
const loading = ref(true);
const loadingInactive = ref(false);
const error = ref(null);
const activeTab = ref('listings');

// Computed
const isOwnProfile = computed(() => {
  if (!auth.user || !user.value) return false;
  if (!route.params.id) return true;
  return auth.user.id === user.value.id;
});

const renterRating = computed(() => user.value?.renterRating || 0);
const ownerRating = computed(() => user.value?.ownerRating || 0);
const renterReviewCount = computed(() => user.value?.renterRatingCount || 0);
const ownerReviewCount = computed(() => user.value?.ownerRatingCount || 0);

const totalListings = computed(() => {
  return listings.value.length;
});

const totalInactiveListings = computed(() => {
  return inactiveListings.value.length;
});

const displayReviews = computed(() => {
  if (reviews.value && reviews.value.length > 0) return reviews.value;
  const embedded = user.value?.reviews;
  return Array.isArray(embedded) ? embedded : [];
});

const renterReviews = computed(() =>
  displayReviews.value.filter((review) => review?.subjectType === 'RENTER')
);

const ownerReviews = computed(() =>
  displayReviews.value.filter((review) => review?.subjectType === 'RENTAL_EXPERIENCE')
);

function averageRating(items) {
  if (!items.length) return 0;
  const total = items.reduce((sum, review) => {
    const rating = review?.ratingOverall ?? review?.rating ?? 0;
    return sum + rating;
  }, 0);
  return total / items.length;
}

const renterReviewCountDisplay = computed(() =>
  renterReviewCount.value || renterReviews.value.length
);

const ownerReviewCountDisplay = computed(() =>
  ownerReviewCount.value || ownerReviews.value.length
);

const renterRatingDisplay = computed(() =>
  renterRating.value || averageRating(renterReviews.value)
);

const ownerRatingDisplay = computed(() =>
  ownerRating.value || averageRating(ownerReviews.value)
);

const hasRenterRating = computed(() => renterReviewCountDisplay.value > 0);
const hasOwnerRating = computed(() => ownerReviewCountDisplay.value > 0);

const totalReviews = computed(() => {
  return (
    user.value?.totalReviews ??
    user.value?._count?.reviewsAsSubject ??
    displayReviews.value.length
  );
});

const targetUserId = computed(() => route.params.id || auth.user?.id);

// Methods
async function loadUserProfile(userId) {
  loading.value = true;
  error.value = null;
  
  try {
    if (!userId) {
      throw new Error(t('userProfile.failedToLoad'));
    }
    
    // Load user profile data
    const userData = await getUserById(userId);
    user.value = userData;
    
    if (auth.user && user.value && auth.user.id === user.value.id) {
      await loadOwnListings();
    } else {
      const listingsData = await fetchUserListings(userId);
      listings.value = listingsData;
      inactiveListings.value = [];
    }
    
    // Load user's reviews (prefer embedded reviews)
    await loadUserReviews(userId, userData);
    
    // Inactive listings are loaded in loadOwnListings for current user
    
  } catch (e) {
    console.error('Failed to load user profile:', e);
    error.value =
      e?.response?.data?.message || e.message || t('userProfile.failedToLoad');
  } finally {
    loading.value = false;
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getRatingColor(rating) {
  if (rating >= 4.5) return 'success';
  if (rating >= 3.5) return 'warning';
  if (rating >= 2.5) return 'info';
  return 'danger';
}

function getRatingText(rating) {
  if (rating >= 4.5) return t('userProfile.rating.excellent');
  if (rating >= 3.5) return t('userProfile.rating.good');
  if (rating >= 2.5) return t('userProfile.rating.average');
  if (rating >= 1.5) return t('userProfile.rating.belowAverage');
  return t('userProfile.rating.poor');
}

function getReviewDate(review) {
  const date =
    review?.createdAt ||
    review?.created_at ||
    review?.updatedAt ||
    review?.updated_at;
  return date ? formatDate(date) : '';
}

function getReviewRating(review) {
  return review?.ratingOverall ?? review?.rating ?? 0;
}

function getReviewBody(review) {
  return review?.body || review?.comment || '';
}

function getReviewSubjectType(review) {
  return review?.subjectType || review?.type || 'REVIEW';
}

function getReviewItemTitle(review) {
  return review?.booking?.item?.title || review?.item?.title || '';
}

function getReviewer(review) {
  return review?.reviewer || review?.user || null;
}

async function loadOwnListings() {
  loadingInactive.value = true;
  try {
    const [activeRes, inactiveRes] = await Promise.all([
      fetchListings({ mine: true, page: 1, pageSize: 1000 }),
      fetchListings({ mine: true, inactive: true, page: 1, pageSize: 1000 }),
    ]);
    listings.value = activeRes.items || [];
    inactiveListings.value = inactiveRes.items || [];
  } catch (error) {
    console.error('Failed to load own listings:', error);
    listings.value = [];
    inactiveListings.value = [];
  } finally {
    loadingInactive.value = false;
  }
}

async function loadUserReviews(userId, userData = null) {
  try {
    if (userData?.reviews) {
      reviews.value = [...userData.reviews].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      return;
    }

    // Get all user's listings first
    const userListings = await fetchUserListings(userId);
    
    // Collect all reviews from all listings
    const allReviews = [];
    
    for (const listing of userListings) {
      try {
        const listingReviews = await fetchItemReviews(listing.id);
        // Add listing info to each review
        const reviewsWithListing = listingReviews.map(review => ({
          ...review,
          item: {
            id: listing.id,
            title: listing.title,
            photos: listing.photos
          }
        }));
        allReviews.push(...reviewsWithListing);
      } catch (error) {
        console.warn(`Failed to load reviews for listing ${listing.id}:`, error);
      }
    }
    
    // Sort reviews by creation date (newest first)
    reviews.value = allReviews.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  } catch (error) {
    console.error('Failed to load user reviews:', error);
    reviews.value = [];
  }
}

watch(targetUserId, (userId) => {
  if (userId) {
    loadUserProfile(userId);
  }
}, { immediate: true });
</script>

<template>
  <div class="user-profile-page">

    <!-- Error State -->
    <div v-if="error" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ error }}
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <div class="small text-secondary mt-2">{{ $t('userProfile.loadingProfile') }}</div>
    </div>

    <!-- Profile Content -->
    <div v-else-if="user" class="profile-content">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="profile-card">
          <!-- User Avatar and Basic Info -->
          <div class="profile-main">
            <div class="profile-avatar">
              <img 
                v-if="user.profilePicture" 
                :src="user.profilePicture" 
                :alt="user.username"
                class="avatar-image"
              />
              <div v-else class="avatar-placeholder">
                <i class="bi bi-person-fill"></i>
              </div>
            </div>
            
            <div class="profile-info">
              <h1 class="profile-name">{{ user.username }}</h1>
              <p class="profile-username">@{{ user.username }}</p>
              <div class="profile-meta">
                <!-- <span class="meta-item">
                  <i class="bi bi-geo-alt me-1"></i>
                  {{ user.city || 'Location not specified' }}
                </span> -->
                <span class="meta-item">
                  <i class="bi bi-calendar me-1"></i>
                  {{ $t('userProfile.joined', { date: formatDate(user.createdAt) }) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Dual Ratings Section -->
          <div class="ratings-section">
            <div class="rating-card renter-rating">
              <div class="rating-header">
                <i class="bi bi-person-check me-2"></i>
                <span class="rating-title">{{ $t('userProfile.rating.asRenter') }}</span>
              </div>
              <div class="rating-content">
                <div v-if="hasRenterRating">
                  <div class="rating-score">
                  <span class="score-number">{{ renterRatingDisplay.toFixed(1) }}</span>
                    <div class="rating-stars">
                    <StarRating :rating="renterRatingDisplay" :size="'sm'" />
                    </div>
                  </div>
                  <div class="rating-text">
                  <span :class="`text-${getRatingColor(renterRatingDisplay)}`">
                    {{ getRatingText(renterRatingDisplay) }}
                    </span>
                  </div>
                  <div class="rating-count">
                  {{ $t('userProfile.reviewCount', { count: renterReviewCountDisplay }) }}
                  </div>
                </div>
                <div v-else class="rating-empty">
                  {{ $t('userProfile.noRatingsYet') }}
                </div>
              </div>
            </div>

            <div class="rating-card owner-rating">
              <div class="rating-header">
                <i class="bi bi-house-check me-2"></i>
                <span class="rating-title">{{ $t('userProfile.rating.asOwner') }}</span>
              </div>
              <div class="rating-content">
                <div v-if="hasOwnerRating">
                  <div class="rating-score">
                  <span class="score-number">{{ ownerRatingDisplay.toFixed(1) }}</span>
                    <div class="rating-stars">
                    <StarRating :rating="ownerRatingDisplay" :size="'sm'" />
                    </div>
                  </div>
                  <div class="rating-text">
                  <span :class="`text-${getRatingColor(ownerRatingDisplay)}`">
                    {{ getRatingText(ownerRatingDisplay) }}
                    </span>
                  </div>
                  <div class="rating-count">
                  {{ $t('userProfile.reviewCount', { count: ownerReviewCountDisplay }) }}
                  </div>
                </div>
                <div v-else class="rating-empty">
                  {{ $t('userProfile.noRatingsYet') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-box"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ user?._count?.items ?? totalListings }}</div>
              <div class="stat-label">{{ $t('userProfile.stats.listings') }}</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-star"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ totalReviews }}</div>
              <div class="stat-label">{{ $t('userProfile.stats.reviews') }}</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-calendar-check"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">
                {{ (user?._count?.renterOrders || 0) + (user?._count?.ownerOrders || 0) }}
              </div>
              <div class="stat-label">{{ $t('userProfile.stats.totalBookings') }}</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-award"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ user?._count?.reviewsAsSubject || 0 }}</div>
              <div class="stat-label">{{ $t('userProfile.stats.reviewsAsSubject') }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="tabs-section">
        <ul class="nav nav-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button 
              class="nav-link" 
              :class="{ active: activeTab === 'listings' }"
              @click="activeTab = 'listings'"
            >
              <i class="bi bi-box me-2"></i>
              {{ $t('userProfile.tabs.listings', { count: totalListings }) }}
            </button>
          </li>
          <li v-if="isOwnProfile" class="nav-item" role="presentation">
            <button 
              class="nav-link" 
              :class="{ active: activeTab === 'inactive' }"
              @click="activeTab = 'inactive'"
            >
              <i class="bi bi-eye-slash me-2"></i>
              {{ $t('userProfile.tabs.inactive', { count: totalInactiveListings }) }}
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button 
              class="nav-link" 
              :class="{ active: activeTab === 'reviews' }"
              @click="activeTab = 'reviews'"
            >
              <i class="bi bi-star me-2"></i>
              {{ $t('userProfile.tabs.reviews', { count: totalReviews }) }}
            </button>
          </li>
        </ul>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Listings Tab -->
          <div v-if="activeTab === 'listings'" class="tab-pane active">
            <div v-if="listings.length > 0" class="listings-grid">
              <ItemCard 
                v-for="listing in listings" 
                :key="listing.id" 
                :item="listing"
                class="listing-item"
              />
            </div>
            <div v-else class="empty-state">
              <i class="bi bi-box empty-icon"></i>
              <h5>{{ $t('userProfile.empty.listingsTitle') }}</h5>
              <p class="text-muted">{{ $t('userProfile.empty.listingsBody') }}</p>
            </div>
          </div>

          <!-- Inactive Listings Tab -->
          <div v-if="activeTab === 'inactive' && isOwnProfile" class="tab-pane active">
            <div v-if="loadingInactive" class="text-center py-4">
              <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
              <div class="small text-secondary mt-2">{{ $t('userProfile.loadingInactive') }}</div>
            </div>
            <div v-else-if="inactiveListings.length > 0" class="listings-grid">
              <ItemCard 
                v-for="listing in inactiveListings" 
                :key="listing.id" 
                :item="listing"
                class="listing-item"
              />
            </div>
            <div v-else class="empty-state">
              <i class="bi bi-eye-slash empty-icon"></i>
              <h5>{{ $t('userProfile.empty.inactiveTitle') }}</h5>
              <p class="text-muted">{{ $t('userProfile.empty.inactiveBody') }}</p>
            </div>
          </div>

          <!-- Reviews Tab -->
          <div v-if="activeTab === 'reviews'" class="tab-pane active">
            <div v-if="displayReviews.length > 0" class="reviews-list">
              <div 
                v-for="review in displayReviews" 
                :key="review.id" 
                class="review-card"
              >
                <div class="review-header">
                  <div class="reviewer-info">
                    <div class="reviewer-avatar">
                      <img 
                        v-if="getReviewer(review)?.profilePicture" 
                        :src="getReviewer(review).profilePicture" 
                        :alt="getReviewer(review).username"
                      />
                      <div v-else class="avatar-placeholder">
                        <i class="bi bi-person-fill"></i>
                      </div>
                    </div>
                    <div class="reviewer-details">
                      <h6 class="reviewer-name">{{ getReviewer(review)?.username || $t('userProfile.anonymous') }}</h6>
                      <!-- <p class="reviewer-username">{{ getReviewer(review)?.id || '' }}</p> -->
                    </div>
                  </div>
                  <div class="review-rating">
                    <StarRating :rating="review.ratingOverall" :size="'sm'" />
                    <span class="rating-date">{{ getReviewDate(review) }}</span>
                  </div>
                </div>
                
                <div class="review-content">
                  <p class="review-text">
                    {{ getReviewBody(review) || $t('userProfile.noReviewComment') }}
                  </p>
                  <div class="review-meta">
                    <span class="review-type badge bg-primary">
                      {{ getReviewSubjectType(review) }}
                    </span>
                    <span v-if="getReviewItemTitle(review)" class="review-item">
                      {{ $t('userProfile.forItem') }} <strong>{{ getReviewItemTitle(review) }}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <i class="bi bi-star empty-icon"></i>
              <h5>{{ $t('reviews.noReviews') }}</h5>
              <p class="text-muted">{{ $t('reviews.noReviewsDescription') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-profile-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Profile Header */
.profile-header {
  margin-bottom: 2rem;
}

.profile-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.profile-main {
  display: flex;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 2rem;
}

.profile-avatar {
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border: 4px solid white;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 48px;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 2.5rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 0.5rem 0;
}

.profile-username {
  font-size: 1.25rem;
  color: #718096;
  margin: 0 0 1rem 0;
}

.profile-bio {
  font-size: 1.1rem;
  color: #4a5568;
  margin: 0 0 1rem 0;
  line-height: 1.6;
}

.profile-meta {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  color: #718096;
  font-size: 0.95rem;
}

/* Ratings Section */
.ratings-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.rating-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.5rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.rating-card:hover {
  border-color: #e2e8f0;
  transform: translateY(-2px);
}

.renter-rating {
  border-left: 4px solid #3b82f6;
}

.owner-rating {
  border-left: 4px solid #10b981;
}

.rating-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #4a5568;
}

.rating-content {
  text-align: center;
}

.rating-score {
  margin-bottom: 0.5rem;
}

.score-number {
  font-size: 3rem;
  font-weight: 700;
  color: #2d3748;
  display: block;
  margin-bottom: 0.5rem;
}

.rating-stars {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.rating-text {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.rating-count {
  font-size: 0.9rem;
  color: #718096;
}

.rating-empty {
  font-size: 0.95rem;
  color: #718096;
  text-align: center;
  padding: 0.75rem 0;
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

/* Tabs Section */
.tabs-section {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.nav-tabs {
  border-bottom: 1px solid #e2e8f0;
  margin: 0;
  padding: 0 2rem;
}

.nav-link {
  border: none;
  background: none;
  color: #718096;
  font-weight: 600;
  padding: 1rem 1.5rem;
  border-radius: 0;
  transition: all 0.3s ease;
}

.nav-link:hover {
  color: #4a5568;
  background: #f8fafc;
}

.nav-link.active {
  color: #3b82f6;
  background: none;
  border-bottom: 3px solid #3b82f6;
}

.tab-content {
  padding: 2rem;
}

/* Listings Grid */
.listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.listing-item {
  transition: transform 0.3s ease;
}

.listing-item:hover {
  transform: translateY(-4px);
}

/* Reviews List */
.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.review-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.review-card:hover {
  border-color: #cbd5e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.reviewer-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.reviewer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.reviewer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reviewer-avatar .avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
}

.reviewer-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 0.25rem 0;
}

.reviewer-username {
  font-size: 0.9rem;
  color: #718096;
  margin: 0;
}

.review-rating {
  text-align: right;
}

.rating-date {
  display: block;
  font-size: 0.8rem;
  color: #718096;
  margin-top: 0.5rem;
}

.review-content {
  margin-top: 1rem;
}

.review-text {
  font-size: 1rem;
  color: #4a5568;
  line-height: 1.6;
  margin: 0 0 1rem 0;
}

.review-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.review-type {
  font-size: 0.8rem;
  padding: 0.25rem 0.75rem;
}

.review-item {
  font-size: 0.9rem;
  color: #718096;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #718096;
}

.empty-icon {
  font-size: 4rem;
  color: #cbd5e0;
  margin-bottom: 1rem;
}

.empty-state h5 {
  color: #4a5568;
  margin-bottom: 0.5rem;
}

/* Dark Mode */
:global([data-bs-theme="dark"]) .user-profile-page {
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .profile-card,
:global([data-bs-theme="dark"]) .tabs-section,
:global([data-bs-theme="dark"]) .stat-card,
:global([data-bs-theme="dark"]) .tab-content {
  border-color: #343a40;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

:global([data-bs-theme="dark"]) .profile-card,
:global([data-bs-theme="dark"]) .rating-card {
  background: transparent;
  box-shadow: none;
}

:global([data-bs-theme="dark"]) .rating-card,
:global([data-bs-theme="dark"]) .review-card {
  border-color: #343a40;
}

:global([data-bs-theme="dark"]) .rating-card:hover,
:global([data-bs-theme="dark"]) .review-card:hover {
  border-color: #495057;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

:global([data-bs-theme="dark"]) .profile-name,
:global([data-bs-theme="dark"]) .score-number,
:global([data-bs-theme="dark"]) .stat-number,
:global([data-bs-theme="dark"]) .reviewer-name {
  color: #f1f3f5;
}

:global([data-bs-theme="dark"]) .profile-username,
:global([data-bs-theme="dark"]) .meta-item,
:global([data-bs-theme="dark"]) .rating-header,
:global([data-bs-theme="dark"]) .rating-title,
:global([data-bs-theme="dark"]) .rating-count,
:global([data-bs-theme="dark"]) .stat-label,
:global([data-bs-theme="dark"]) .reviewer-username,
:global([data-bs-theme="dark"]) .rating-date,
:global([data-bs-theme="dark"]) .review-text,
:global([data-bs-theme="dark"]) .review-item,
:global([data-bs-theme="dark"]) .empty-state,
:global([data-bs-theme="dark"]) .empty-state h5 {
  color: #ced4da;
}

:global([data-bs-theme="dark"]) .ratings-section {
  border-top-color: #343a40;
}

:global([data-bs-theme="dark"]) .nav-tabs {
  border-bottom-color: #343a40;
}

:global([data-bs-theme="dark"]) .nav-link {
  color: #adb5bd;
}

:global([data-bs-theme="dark"]) .nav-link:hover {
  color: #e9ecef;
  background: #2b2b2b;
}

:global([data-bs-theme="dark"]) .nav-link.active {
  color: #8ab4ff;
  border-bottom-color: #8ab4ff;
}

:global([data-bs-theme="dark"]) .empty-icon {
  color: #495057;
}

:global([data-bs-theme="dark"]) .breadcrumb,
:global([data-bs-theme="dark"]) .breadcrumb-item,
:global([data-bs-theme="dark"]) .breadcrumb-item a {
  color: #ced4da;
}

:global([data-bs-theme="dark"]) .breadcrumb-item.active {
  color: #f1f3f5;
}

:global([data-bs-theme="dark"]) .user-profile-page .text-muted,
:global([data-bs-theme="dark"]) .user-profile-page .text-secondary {
  color: #adb5bd !important;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .profile-main {
    flex-direction: column;
    text-align: center;
    gap: 1.5rem;
  }
  
  .profile-avatar {
    width: 100px;
    height: 100px;
    margin: 0 auto;
  }
  
  .profile-name {
    font-size: 2rem;
  }
  
  .ratings-section {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .nav-tabs {
    padding: 0 1rem;
  }
  
  .tab-content {
    padding: 1rem;
  }
  
  .listings-grid {
    grid-template-columns: 1fr;
  }
  
  .review-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .review-rating {
    text-align: left;
  }
}

@media (max-width: 480px) {
  .profile-card {
    padding: 1.5rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .stat-card {
    padding: 1rem;
  }
  
  .stat-number {
    font-size: 1.5rem;
  }
}
</style>
