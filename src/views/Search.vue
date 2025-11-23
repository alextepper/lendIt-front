<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useUiStore } from '../stores/ui';
import { fetchListings, fetchCategories, fetchLocations } from '../services/listingsService';
import ItemCard from '../components/ItemCard.vue';
import PaginationBar from '../components/PaginationBar.vue';
import SearchMap from '../components/SearchMap.vue';
import { useQuerySync } from '../composables/useQuerySync';
// import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel.vue' // if you prefer infinite scroll

const ui = useUiStore();

// URL-synced search state
const { state, setPatch, setPage, reset } = useQuerySync({
  q: '',
  category: '',
  location: '',
  price_min: '',
  price_max: '',
  minRating: '',
  date_from: '',
  date_to: '',
  sort: 'relevance',
  page: 1,
  per_page: 12,
  lat: '',
  lng: '',
  radiusKm: '',
});

const categories = ref([]);
const locations = ref([]);
const data = ref({ items: [], page: 1, per_page: 12, total: 0, total_pages: 1 });
const loading = ref(false);
const error = ref(null);
const locationLoading = ref(false);
const locationError = ref(null);
const currentLocation = ref({ lat: null, lng: null, address: null });
const viewMode = ref('map'); // 'map' or 'list'
const locationSearchQuery = ref('');
const locationSuggestions = ref([]);
const showingSuggestions = ref(false);
const geocodingLoading = ref(false);

// Computed property for radius to ensure it's always a number
const radiusValue = computed({
  get: () => {
    const val = state.value.radiusKm;
    return val && val !== '' ? Number(val) : 15;
  },
  set: (newVal) => {
    setPatch({ radiusKm: Number(newVal) });
  }
});

// Fetch meta and initialize location
onMounted(async () => {
  try {
    [categories.value, locations.value] = await Promise.all([fetchCategories(), fetchLocations()]);
  } catch (e) {
    // non-blocking
  }
  
  // Initialize location from URL if present
  if (state.value.lat && state.value.lng) {
    useManualLocation();
  }
  
  await runSearch();
});

// Derived label
const resultsLabel = computed(() => {
  const t = data.value.total;
  if (t === 0) return 'No items found';
  const start = (data.value.page - 1) * data.value.per_page + 1;
  const end = Math.min(data.value.page * data.value.per_page, t);
  return `Showing ${start}–${end} of ${t}`;
});

async function runSearch() {
  loading.value = true;
  error.value = null;
  ui.setLoading(true);
  try {
    // Filter out empty parameters and zero price values before sending to API
    const params = Object.fromEntries(
      Object.entries(state.value).filter(([key, value]) => {
        // Filter out empty strings, null, undefined
        if (value === '' || value === null || value === undefined) {
          return false;
        }
        // Filter out zero price values (they would exclude all items)
        if ((key === 'price_min' || key === 'price_max') && value === 0) {
          return false;
        }
        return true;
      })
    );
    data.value = await fetchListings(params);
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load';
  } finally {
    loading.value = false;
    ui.setLoading(false);
  }
}

function applyFilters(ev) {
  ev?.preventDefault?.();
  setPage(1);
  runSearch();
}

function clearFilters() {
  reset();
  runSearch();
}

function onPageChange(p) {
  setPage(p);
  runSearch();
}

// Location functions
async function getCurrentLocation() {
  if (!navigator.geolocation) {
    locationError.value = 'Geolocation is not supported by your browser';
    return;
  }

  locationLoading.value = true;
  locationError.value = null;

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve, 
        (error) => {
          // Provide user-friendly error messages
          let errorMessage = 'Failed to get your location. ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Please allow location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage += 'An unknown error occurred.';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000, // Accept cached location up to 1 minute old
        }
      );
    });

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy; // Accuracy in meters

    // Log coordinates for debugging
    console.log('Geolocation result:', { lat, lng, accuracy: `${accuracy}m` });

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Invalid location coordinates received');
    }

    // Warn if accuracy is poor
    if (accuracy > 1000) {
      console.warn(`Location accuracy is ${accuracy}m - this may not be very precise`);
    }

    // Update current location first
    currentLocation.value = { lat, lng, address: null };
    
    // Set default radius if not already set
    const radius = state.value.radiusKm || 15;
    
    // Prevent watch from triggering duplicate search
    isSettingLocation = true;
    
    // Update state
    setPatch({ lat, lng, radiusKm: radius });
    
    // Wait a bit for state to update, then trigger search
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Reset flag and trigger search
    isSettingLocation = false;
    runSearch();
    
    // Try to get address from coordinates (reverse geocoding) - non-blocking
    // Use multiple zoom levels to get the most accurate address possible
    Promise.all([
      // Try with high zoom first (most specific)
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`),
      // Fallback with medium zoom
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&accept-language=en`)
    ])
      .then(responses => Promise.all(responses.map(r => r.ok ? r.json() : null)))
      .then(results => {
        const data = results.find(r => r && r.display_name) || results[0];
        
        if (data && data.display_name) {
          // Prefer more specific address components
          let address = data.display_name;
          
          // Try to get a more specific address if available
          if (data.address) {
            const addr = data.address;
            // Build address from most specific to least specific
            const parts = [];
            if (addr.road || addr.street) parts.push(addr.road || addr.street);
            if (addr.house_number) parts.push(addr.house_number);
            if (addr.suburb || addr.neighbourhood || addr.city_district) {
              parts.push(addr.suburb || addr.neighbourhood || addr.city_district);
            }
            if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
            if (addr.county) parts.push(addr.county);
            if (addr.state) parts.push(addr.state);
            if (addr.country) parts.push(addr.country);
            
            if (parts.length > 0) {
              address = parts.join(', ');
            }
          }
          
          currentLocation.value.address = address;
          console.log('📍 Reverse geocoding result:', address);
        }
      })
      .catch(e => {
        // Reverse geocoding failed, but we still have coordinates
        console.warn('Failed to get address:', e);
      });
  } catch (err) {
    locationError.value = err.message || 'Failed to get your location. Please allow location access or enter coordinates manually.';
    console.error('Geolocation error:', err);
  } finally {
    locationLoading.value = false;
  }
}

function useManualLocation() {
  if (state.value.lat && state.value.lng) {
    currentLocation.value = {
      lat: parseFloat(state.value.lat),
      lng: parseFloat(state.value.lng),
      address: null,
    };
    // Set default radius if not already set
    if (!state.value.radiusKm) {
      setPatch({ radiusKm: 15 });
    }
  }
}

function clearLocation() {
  currentLocation.value = { lat: null, lng: null, address: null };
  setPatch({ lat: '', lng: '', radiusKm: '', sort: 'relevance' });
  // Trigger search after clearing location to use regular endpoint
  runSearch();
}

// Watch for manual lat/lng changes (but avoid triggering on initial getCurrentLocation)
let isSettingLocation = false;

// Sync location search query with current location address
watch(() => currentLocation.value.address, (newAddress) => {
  if (newAddress && !locationSearchQuery.value) {
    locationSearchQuery.value = newAddress;
  }
});

watch(() => [state.value.lat, state.value.lng], ([lat, lng], [oldLat, oldLng]) => {
  // Only trigger if lat/lng actually changed and weren't set by getCurrentLocation
  if (lat && lng && (lat !== oldLat || lng !== oldLng) && !isSettingLocation) {
    useManualLocation();
    // Trigger search when location is manually set
    runSearch();
  }
});

// Watch for radius changes and trigger search
let radiusTimeout = null;
watch(() => state.value.radiusKm, (newRadius, oldRadius) => {
  if (state.value.lat && state.value.lng && newRadius != null && newRadius !== '' && newRadius !== oldRadius) {
    // Clear previous timeout
    if (radiusTimeout) clearTimeout(radiusTimeout);
    // Debounce search to avoid too many requests
    radiusTimeout = setTimeout(() => {
      runSearch();
    }, 500);
  }
});

// Geocoding functions - convert address to coordinates
let geocodeTimeout = null;

async function searchLocation(query) {
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
    locationError.value = 'Invalid location coordinates';
    return;
  }

  console.log('📍 Location selected:', {
    name: suggestion.display_name,
    lat,
    lng,
    type: suggestion.type
  });

  locationSearchQuery.value = suggestion.display_name;
  locationSuggestions.value = [];
  showingSuggestions.value = false;
  locationError.value = null;

  // Update location
  currentLocation.value = {
    lat,
    lng,
    address: suggestion.display_name,
    accuracy: null // No accuracy for geocoded locations
  };

  // Prevent watch from triggering duplicate search
  isSettingLocation = true;

  // Update state with new coordinates (this will also update the lat/lng inputs)
  const radius = state.value.radiusKm || 15;
  setPatch({ lat, lng, radiusKm: radius });

  // Wait for state to update, then trigger search
  setTimeout(() => {
    isSettingLocation = false;
    runSearch();
  }, 150);
}

function clearLocationSearch() {
  locationSearchQuery.value = '';
  locationSuggestions.value = [];
  showingSuggestions.value = false;
}

// Handle location change from map drag
function handleLocationChanged(newLocation) {
  if (newLocation && newLocation.lat && newLocation.lng) {
    // Update current location
    currentLocation.value = { ...newLocation };
    
    // Prevent watch from triggering duplicate search
    isSettingLocation = true;
    
    // Update state with new location
    setPatch({ lat: newLocation.lat, lng: newLocation.lng });
    
    // Wait for state to update, then trigger search
    setTimeout(() => {
      isSettingLocation = false;
      runSearch();
    }, 150);
  }
}

// If you want infinite scroll instead of the pager, keep an accumulator:
// - store all items in an array and append when sentinel becomes visible and page < total_pages.
</script>

<template>
  <div class="search-page">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h4 mb-0">Search</h1>
      <div class="btn-group" role="group">
        <input
          type="radio"
          class="btn-check"
          id="view-map"
          value="map"
          v-model="viewMode"
        />
        <label class="btn btn-outline-primary btn-sm" for="view-map">
          <i class="bi bi-map me-1"></i> Map
        </label>
        <input
          type="radio"
          class="btn-check"
          id="view-list"
          value="list"
          v-model="viewMode"
        />
        <label class="btn btn-outline-primary btn-sm" for="view-list">
          <i class="bi bi-list-ul me-1"></i> List
        </label>
      </div>
    </div>

    <div class="row g-3">
      <!-- Filters Sidebar -->
      <div class="col-12 col-lg-3">
      <form class="card p-3" @submit.prevent="applyFilters">
        <h2 class="h6">Filters</h2>

        <div class="mb-3">
          <label class="form-label">Keyword</label>
          <input v-model="state.q" class="form-control" placeholder="drill, PS5, tent…" />
        </div>

        <div class="mb-3">
          <label class="form-label">Category</label>
          <select v-model="state.category" class="form-select">
            <option value="">Any</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        

        <!-- Location-based Search -->
        <div class="mb-3">
          <!-- <label class="form-label">Search by Location & Radius</label>
          <div class="small text-muted mb-2">
            <i class="bi bi-info-circle me-1"></i>
            Drag the blue marker on the map to change search center
          </div> -->
          <!-- <div class="card bg-light p-3"> -->
            <!-- <div v-if="currentLocation.lat && currentLocation.lng" class="mb-2">
              <div class="small text-success">
                <i class="bi bi-geo-alt-fill me-1"></i>
                <strong>Your Location:</strong>
                <div class="mt-1">
                  <div class="fw-bold">
                    {{ currentLocation.lat.toFixed(6) }}, {{ currentLocation.lng.toFixed(6) }}
                  </div>
                  <div v-if="currentLocation.accuracy" class="text-muted small">
                    <i class="bi bi-crosshair me-1"></i>
                    Accuracy: ~{{ Math.round(currentLocation.accuracy) }}m
                  </div>
                  <div v-if="currentLocation.address" class="text-muted small mt-1">
                    <i class="bi bi-map me-1"></i>
                    {{ currentLocation.address }}
                    <small class="d-block text-warning mt-1">
                      <i class="bi bi-exclamation-triangle me-1"></i>
                      Note: Address may show nearest city center, but coordinates above are your exact location
                    </small>
                  </div>
                  <div v-else class="text-muted small mt-1">
                    <i class="bi bi-info-circle me-1"></i>
                    Address lookup in progress...
                  </div>
                </div>
              </div>
            </div> -->

            <div class="mb-2">
              <label class="form-label small">Search by Location</label>
              <div class="position-relative">
                <div class="input-group input-group-sm">
                  <span class="input-group-text">
                    <i class="bi bi-search"></i>
                  </span>
                  <input
                    v-model="locationSearchQuery"
                    type="text"
                    class="form-control"
                    placeholder="Type address or place name..."
                    @input="searchLocation(locationSearchQuery)"
                    @focus="showingSuggestions = locationSuggestions.length > 0"
                    @blur="setTimeout(() => { showingSuggestions = false; }, 200)"
                    @keydown.enter.prevent="locationSuggestions.length > 0 && selectLocation(locationSuggestions[0])"
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
              <!-- <small class="text-muted">Type at least 3 characters to search</small> -->
            </div>

            <div class="d-grid gap-2 mb-2">
              <button
                type="button"
                class="btn btn-outline-primary btn-sm"
                @click="getCurrentLocation"
                :disabled="locationLoading"
              >
                <span v-if="locationLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
                <i v-else class="bi bi-geo-alt me-1"></i>
                {{ locationLoading ? 'Getting location...' : (currentLocation.lat ? 'Update My Location' : 'Use My Location') }}
              </button>
            </div>

            <div v-if="locationError" class="alert alert-warning alert-sm py-2 mb-2">
              <small>{{ locationError }}</small>
            </div>

            <!-- <div class="row g-2 mb-2">
              <div class="col-6">
                <label class="form-label small">Latitude</label>
                <input
                  v-model.number="state.lat"
                  type="number"
                  step="any"
                  class="form-control form-control-sm"
                  placeholder="32.0853"
                />
              </div>
              <div class="col-6">
                <label class="form-label small">Longitude</label>
                <input
                  v-model.number="state.lng"
                  type="number"
                  step="any"
                  class="form-control form-control-sm"
                  placeholder="34.7818"
                />
              </div>
            </div> -->

            <div v-if="state.lat && state.lng" class="mb-2">
              <label class="form-label small">
                Search Radius: <strong>{{ radiusValue }} km</strong>
              </label>
              <input
                v-model.number="radiusValue"
                type="range"
                min="1"
                max="100"
                step="1"
                class="form-range"
              />
              <div class="d-flex justify-content-between small text-muted mt-1">
                <span>1 km</span>
                <span>50 km</span>
                <span>100 km</span>
              </div>
            </div>

            <button
              v-if="currentLocation.lat && currentLocation.lng"
              type="button"
              class="btn btn-outline-danger btn-sm w-100"
              @click="clearLocation"
            >
              <i class="bi bi-x-circle me-1"></i> Clear Location
            </button>
          <!-- </div> -->
        </div>

        <!-- <div class="row g-2 mb-3">
          <div class="col">
            <label class="form-label">Price min</label>
            <input v-model.number="state.price_min" type="number" min="0" class="form-control" />
          </div>
          <div class="col">
            <label class="form-label">Price max</label>
            <input v-model.number="state.price_max" type="number" min="0" class="form-control" />
          </div>
        </div> -->

        <!-- <div class="mb-3">
          <label class="form-label">Minimum Rating</label>
          <select v-model.number="state.minRating" class="form-select">
            <option value="">Any rating</option>
            <option :value="5">5 stars</option>
            <option :value="4">4+ stars</option>
            <option :value="3">3+ stars</option>
            <option :value="2">2+ stars</option>
            <option :value="1">1+ stars</option>
          </select>
        </div> -->

        <!-- <div class="row g-2 mb-3">
          <div class="col">
            <label class="form-label">From</label>
            <input v-model="state.date_from" type="date" class="form-control" />
          </div>
          <div class="col">
            <label class="form-label">To</label>
            <input v-model="state.date_to" type="date" class="form-control" />
          </div>
        </div> -->
<!-- 
        <div class="mb-3">
          <label class="form-label">Sort by</label>
          <select v-model="state.sort" class="form-select">
            <option value="relevance">Relevance</option>
            <option value="distance">Distance (when location set)</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="rating_desc">Rating</option>
          </select>
        </div> -->

        <div class="d-flex gap-2">
          <button class="btn btn-primary" type="submit">
            <i class="bi bi-search me-1"></i> Apply
          </button>
          <button class="btn btn-outline-secondary" type="button" @click="clearFilters">Reset</button>
        </div>
      </form>
    </div>

    <!-- Map/Results Area -->
    <div class="col-12 col-lg-9">
      <!-- Map View -->
      <div v-if="viewMode === 'map'" class="map-container">
        <SearchMap
          :key="`map-${viewMode}`"
          :user-location="currentLocation"
          :items="data.items"
          :radius-km="state.radiusKm || 15"
          @location-changed="handleLocationChanged"
        />
      </div>

      <!-- List View -->
      <div v-else>
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="small text-secondary">{{ resultsLabel }}</div>
          <div class="d-flex align-items-center gap-2">
            <label class="small text-secondary">Per page</label>
            <select
              v-model.number="state.per_page"
              class="form-select form-select-sm"
              style="width: auto"
              @change="applyFilters"
            >
              <option :value="12">12</option>
              <option :value="24">24</option>
              <option :value="48">48</option>
            </select>
          </div>
        </div>

        <div v-if="error" class="alert alert-danger">{{ error }}</div>

        <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
          <div v-for="item in data.items" :key="item.id" class="col">
            <ItemCard :item="item" />
          </div>

          <div v-if="!loading && data.items.length === 0" class="col-12">
            <div class="alert alert-warning">No items matched your filters.</div>
          </div>
        </div>

        <div class="mt-3">
          <PaginationBar :page="data.page" :total-pages="data.total_pages" @change="onPageChange" />
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  min-height: calc(100vh - 200px);
}

.map-container {
  height: calc(100vh - 200px);
  min-height: 600px;
  position: sticky;
  top: 20px;
  width: 100%;
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

@media (max-width: 991px) {
  .map-container {
    height: 500px;
    min-height: 500px;
    position: relative;
    top: 0;
  }
}
</style>
