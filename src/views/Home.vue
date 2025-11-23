<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchListings } from '../services/listingsService'
import { useUiStore } from '../stores/ui'
import { getItemPhotoUrl } from '../utils/imageUtils'

const router = useRouter()
const ui = useUiStore()

// Search state
const searchQuery = ref('')
const locationSearchQuery = ref('')
const locationSuggestions = ref([])
const showingSuggestions = ref(false)
const selectedLocation = ref(null) // Store selected location with coordinates

// Featured categories with sample items
const categories = ref([
  {
    name: 'Tools',
    icon: 'bi-tools',
    color: 'primary',
    items: []
  },
  {
    name: 'Electronics',
    icon: 'bi-laptop',
    color: 'success',
    items: []
  },
  {
    name: 'Games',
    icon: 'bi-controller',
    color: 'info',
    items: []
  },
  {
    name: 'Outdoors',
    icon: 'bi-backpack2',
    color: 'warning',
    items: []
  }
])

const loading = ref(false)

// Load featured items for each category
async function loadFeaturedItems() {
  loading.value = true
  try {
    for (const category of categories.value) {
      const data = await fetchListings({
        category: category.name,
        per_page: 4,
        sort: 'rating_desc'
      })
      category.items = data.items || []
    }
  } catch (error) {
    console.warn('Failed to load featured items:', error)
  } finally {
    loading.value = false
  }
}

// Geocoding functions - convert address to coordinates
let geocodeTimeout = null;

async function searchLocationQuery(query) {
  if (!query || query.trim().length < 3) {
    locationSuggestions.value = [];
    showingSuggestions.value = false;
    return;
  }

  clearTimeout(geocodeTimeout);
  geocodeTimeout = setTimeout(async () => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&accept-language=en`
      );
      const data = await response.json();
      locationSuggestions.value = data || [];
      showingSuggestions.value = data && data.length > 0;
    } catch (e) {
      console.error('Geocoding error:', e);
      locationSuggestions.value = [];
      showingSuggestions.value = false;
    }
  }, 300);
}

function selectLocation(suggestion) {
  const lat = parseFloat(suggestion.lat);
  const lng = parseFloat(suggestion.lon);
  
  if (isNaN(lat) || isNaN(lng)) {
    return;
  }

  locationSearchQuery.value = suggestion.display_name;
  locationSuggestions.value = [];
  showingSuggestions.value = false;
  
  // Store selected location with coordinates
  selectedLocation.value = {
    name: suggestion.display_name,
    lat,
    lng
  };
}

// Search functionality
function handleSearch() {
  // Allow search with just location, or just query, or both
  if (!searchQuery.value.trim() && !selectedLocation.value && !locationSearchQuery.value) {
    return;
  }
  
  const queryParams = {};
  
  // Add search query if provided
  if (searchQuery.value.trim()) {
    queryParams.q = searchQuery.value.trim();
  }
  
  // If location with coordinates is selected, use lat/lng
  if (selectedLocation.value) {
    queryParams.lat = selectedLocation.value.lat;
    queryParams.lng = selectedLocation.value.lng;
    queryParams.radiusKm = 15; // Default radius
  } else if (locationSearchQuery.value) {
    // Fallback to text location if no coordinates
    queryParams.location = locationSearchQuery.value;
  }
  
  router.push({
    name: 'search',
    query: queryParams
  })
}

// Navigate to category search
function searchCategory(categoryName) {
  router.push({
    name: 'search',
    query: { category: categoryName }
  })
}

// Navigate to specific item search
function searchItem(itemTitle) {
  router.push({
    name: 'search',
    query: { q: itemTitle }
  })
}

// Format price for display
function formatPrice(price) {
  // Backend sends prices in cents, so divide by 100 for display
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price / 100)
}

function formatPriceForBackend(amount) {
  // Convert display price to backend format (multiply by 100)
  return Math.round(amount * 100);
}

onMounted(() => {
  loadFeaturedItems()
})
</script>

<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero-section bg-primary text-white py-5 mb-5 rounded">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-lg-6">
            <h1 class="display-4 fw-bold mb-3">{{ $t('app.title') }}</h1>
            <p class="lead mb-4">{{ $t('app.tagline') }}</p>
            
            <!-- Search Form -->
            <div class="search-form">
              <div class="row g-2">
                <div class="col-md-6">
                  <div class="input-group">
                    <span class="input-group-text">
                      <i class="bi bi-search"></i>
                    </span>
                    <input
                      v-model="searchQuery"
                      type="text"
                      class="form-control"
                      placeholder="What are you looking for?"
                      @keyup.enter="handleSearch"
                    />
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="position-relative">
                    <div class="input-group">
                      <span class="input-group-text">
                        <i class="bi bi-geo-alt"></i>
                      </span>
                      <input
                        v-model="locationSearchQuery"
                        type="text"
                        class="form-control"
                        placeholder="Location (optional)"
                        @input="searchLocationQuery(locationSearchQuery)"
                        @focus="showingSuggestions = locationSuggestions.length > 0"
                        @blur="setTimeout(() => { showingSuggestions = false; }, 200)"
                        @keyup.enter.prevent="locationSuggestions.length > 0 && selectLocation(locationSuggestions[0]) || handleSearch()"
                      />
                    </div>
                    <div v-if="showingSuggestions && locationSuggestions.length > 0" class="location-suggestions">
                      <div
                        v-for="suggestion in locationSuggestions"
                        :key="suggestion.place_id"
                        class="suggestion-item"
                        @mousedown.prevent="selectLocation(suggestion)"
                      >
                        <i class="bi bi-geo-alt"></i>
                        <div class="flex-grow-1">
                          <div class="fw-semibold small">{{ suggestion.display_name.split(',')[0] }}</div>
                          <div class="text-muted" style="font-size: 0.75rem;">{{ suggestion.display_name }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-md-2">
                  <button
                    class="btn btn-light w-100"
                    @click="handleSearch"
                    :disabled="!searchQuery.trim() && !selectedLocation && !locationSearchQuery.trim()"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="col-lg-6 text-center">
            <div class="hero-image">
              <i class="bi bi-house-heart display-1 opacity-75"></i>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Categories -->
    <section class="featured-categories">
      <div class="container">
        <div class="row">
          <div class="col-12">
            <h2 class="h3 mb-4 text-center">Popular Categories</h2>
            <p class="text-center text-secondary mb-5">Discover items in your area</p>
          </div>
        </div>

        <!-- Category Sections -->
        <div v-for="category in categories" :key="category.name" class="category-section mb-5">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h3 class="h4 mb-0">
              <i :class="[category.icon, `text-${category.color}`]"></i>
              {{ category.name }}
            </h3>
            <button
              class="btn btn-outline-primary btn-sm"
              @click="searchCategory(category.name)"
            >
              View All <i class="bi bi-arrow-right"></i>
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="row">
            <div v-for="n in 4" :key="n" class="col-lg-3 col-md-6 mb-3">
              <div class="card">
                <div class="card-img-top bg-light" style="height: 200px;">
                  <div class="d-flex align-items-center justify-content-center h-100">
                    <div class="spinner-border text-primary" role="status"></div>
                  </div>
                </div>
                <div class="card-body">
                  <div class="placeholder-glow">
                    <span class="placeholder col-7"></span>
                    <span class="placeholder col-4"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Items Grid -->
          <div v-else class="row">
            <div
              v-for="item in category.items"
              :key="item.id"
              class="col-lg-3 col-md-6 mb-3"
            >
              <div class="card h-100 product-card" @click="searchItem(item.title)">
                <div class="card-img-top-container">
                  <img
                    v-if="item.thumbnail || (item.photos && item.photos.length > 0)"
                    :src="getItemPhotoUrl(item.thumbnail || item.photos)"
                    :alt="item.title"
                    class="card-img-top"
                    loading="lazy"
                  />
                  <div v-else class="card-img-top bg-light d-flex align-items-center justify-content-center">
                    <i class="bi bi-image text-muted display-4"></i>
                  </div>
                  <div class="card-img-overlay">
                    <span class="badge bg-primary">{{ item.category }}</span>
                  </div>
                </div>
                <div class="card-body d-flex flex-column">
                  <h5 class="card-title h6 mb-2">{{ item.title }}</h5>
                  <div class="d-flex align-items-center mb-2">
                    <i class="bi bi-geo-alt text-muted me-1"></i>
                    <small class="text-muted">{{ item.location }}</small>
                  </div>
                  <div class="d-flex align-items-center mb-2">
                    <i class="bi bi-star-fill text-warning me-1"></i>
                    <small class="text-muted">{{ item.rating }} ({{ item.reviews_count }})</small>
                  </div>
                  <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center">
                      <span class="h6 text-primary mb-0">
                        {{ formatPrice(item.pricePerDay) }}/day
                      </span>
                      <button class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-search"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="!loading && category.items.length === 0" class="text-center py-4">
            <i class="bi bi-inbox display-4 text-muted mb-3"></i>
            <p class="text-muted">No items found in this category</p>
            <button
              class="btn btn-primary"
              @click="searchCategory(category.name)"
            >
              Browse {{ category.name }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Call to Action -->
    <section class="cta-section bg-light py-5 mt-5">
      <div class="container text-center">
        <h2 class="h3 mb-3">Ready to start renting?</h2>
        <p class="text-secondary mb-4">Join thousands of users who are already renting and lending items</p>
        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <router-link class="btn btn-primary btn-lg" to="/search">
            <i class="bi bi-search me-2"></i>Browse All Items
          </router-link>
          <router-link class="btn btn-outline-primary btn-lg" to="/dashboard">
            <i class="bi bi-plus-circle me-2"></i>List Your Item
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero-section {
  background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
}

.search-form .form-control {
  border: none;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.search-form .input-group-text {
  background: white;
  border: none;
  color: #6c757d;
}

.product-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #e9ecef;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
  border-color: #0d6efd;
}

.card-img-top-container {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.card-img-top {
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-card:hover .card-img-top {
  transform: scale(1.05);
}

.card-img-overlay {
  top: 0.5rem;
  right: 0.5rem;
  padding: 0;
}

.category-section {
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 2rem;
}

.category-section:last-child {
  border-bottom: none;
}

.hero-image {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.location-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 2px;
}

.suggestion-item {
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background-color: #f8f9fa;
}

.suggestion-item:active {
  background-color: #e9ecef;
}

.suggestion-item i {
  color: #4285F4;
  margin-top: 0.125rem;
}

@media (max-width: 768px) {
  .hero-section .display-4 {
    font-size: 2rem;
  }
  
  .search-form .col-md-2 {
    margin-top: 0.5rem;
  }
}
</style>
