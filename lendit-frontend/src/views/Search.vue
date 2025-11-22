<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useUiStore } from '../stores/ui';
import { fetchListings, fetchCategories, fetchLocations } from '../services/listingsService';
import ItemCard from '../components/ItemCard.vue';
import PaginationBar from '../components/PaginationBar.vue';
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
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    currentLocation.value = { lat, lng, address: null };
    // Set default radius if not already set
    const radius = state.value.radiusKm || 15;
    setPatch({ lat, lng, radiusKm: radius });
    
    // Try to get address from coordinates (reverse geocoding)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data.display_name) {
        currentLocation.value.address = data.display_name;
      }
    } catch (e) {
      // Reverse geocoding failed, but we still have coordinates
      console.warn('Failed to get address:', e);
    }
  } catch (err) {
    locationError.value = err.message || 'Failed to get your location. Please allow location access or enter coordinates manually.';
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

// Watch for manual lat/lng changes
watch(() => [state.value.lat, state.value.lng], ([lat, lng]) => {
  if (lat && lng) {
    useManualLocation();
  }
});

// If you want infinite scroll instead of the pager, keep an accumulator:
// - store all items in an array and append when sentinel becomes visible and page < total_pages.
</script>

<template>
  <h1 class="h4 mb-3">Search</h1>

  <div class="row g-3">
    <!-- Filters -->
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

        <div class="mb-3">
          <label class="form-label">Location (City)</label>
          <select v-model="state.location" class="form-select">
            <option value="">Anywhere</option>
            <option v-for="l in locations" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>

        <!-- Location-based Search -->
        <div class="mb-3">
          <label class="form-label">Search by Location & Radius</label>
          <div class="card bg-light p-3">
            <div v-if="currentLocation.lat && currentLocation.lng" class="mb-2">
              <div class="small text-success">
                <i class="bi bi-geo-alt-fill me-1"></i>
                <strong>Location set:</strong>
                <div class="mt-1">
                  {{ currentLocation.lat.toFixed(4) }}, {{ currentLocation.lng.toFixed(4) }}
                  <span v-if="currentLocation.address" class="d-block text-muted small">
                    {{ currentLocation.address }}
                  </span>
                </div>
              </div>
            </div>

            <div class="d-grid gap-2 mb-2">
              <button
                type="button"
                class="btn btn-outline-primary btn-sm"
                @click="getCurrentLocation"
                :disabled="locationLoading"
              >
                <i class="bi bi-geo-alt me-1"></i>
                {{ locationLoading ? 'Getting location...' : 'Use My Location' }}
              </button>
            </div>

            <div v-if="locationError" class="alert alert-warning alert-sm py-2 mb-2">
              <small>{{ locationError }}</small>
            </div>

            <div class="row g-2 mb-2">
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
            </div>

            <div class="mb-2">
              <label class="form-label small">
                Search Radius: {{ (state.radiusKm || 15) }} km
              </label>
              <input
                v-model.number="state.radiusKm"
                type="range"
                min="1"
                max="100"
                step="1"
                class="form-range"
                :disabled="!state.lat || !state.lng"
              />
              <div class="d-flex justify-content-between small text-muted">
                <span>1 km</span>
                <span>50 km</span>
                <span>100 km</span>
              </div>
              <div class="mt-1">
                <input
                  v-model.number="state.radiusKm"
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  class="form-control form-control-sm"
                  placeholder="Custom radius"
                  :disabled="!state.lat || !state.lng"
                  style="max-width: 120px;"
                />
                <small class="text-muted">Enter custom radius (0.1-1000 km)</small>
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
          </div>
        </div>

        <div class="row g-2 mb-3">
          <div class="col">
            <label class="form-label">Price min</label>
            <input v-model.number="state.price_min" type="number" min="0" class="form-control" />
          </div>
          <div class="col">
            <label class="form-label">Price max</label>
            <input v-model.number="state.price_max" type="number" min="0" class="form-control" />
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Minimum Rating</label>
          <select v-model.number="state.minRating" class="form-select">
            <option value="">Any rating</option>
            <option :value="5">5 stars</option>
            <option :value="4">4+ stars</option>
            <option :value="3">3+ stars</option>
            <option :value="2">2+ stars</option>
            <option :value="1">1+ stars</option>
          </select>
        </div>

        <div class="row g-2 mb-3">
          <div class="col">
            <label class="form-label">From</label>
            <input v-model="state.date_from" type="date" class="form-control" />
          </div>
          <div class="col">
            <label class="form-label">To</label>
            <input v-model="state.date_to" type="date" class="form-control" />
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Sort by</label>
          <select v-model="state.sort" class="form-select">
            <option value="relevance">Relevance</option>
            <option value="distance">Distance (when location set)</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="rating_desc">Rating</option>
          </select>
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-primary" type="submit">
            <i class="bi bi-search me-1"></i> Apply
          </button>
          <button class="btn btn-outline-secondary" type="button" @click="clearFilters">Reset</button>
        </div>
      </form>
    </div>

    <!-- Results -->
    <div class="col-12 col-lg-9">
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

      <!-- For infinite scroll alternative:
      <InfiniteScrollSentinel v-if="data.page < data.total_pages" @visible="() => { setPage(state.page + 1); runSearchAppend(); }" />
      -->
    </div>
  </div>
</template>
