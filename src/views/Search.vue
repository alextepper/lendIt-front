<script setup>
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../stores/ui';

const route = useRoute();
import { fetchListings } from '../services/listingsService';
import ItemCard from '../components/ItemCard.vue';
import PaginationBar from '../components/PaginationBar.vue';
import SearchMapSkeleton from '../components/SearchMapSkeleton.vue';
// Lazy-load Leaflet + SearchMap as a separate chunk so the main page paints
// instantly with the skeleton instead of waiting for ~150kB of map JS/CSS.
const SearchMap = defineAsyncComponent({
  loader: () => import('../components/SearchMap.vue'),
  loadingComponent: SearchMapSkeleton,
  delay: 0,
  timeout: 30000,
});
import { useQuerySync } from '../composables/useQuerySync';
import { getItemPhotoUrl } from '../utils/imageUtils';
import { useSeo, buildCanonical } from '../composables/useSeo';
import { markPrerendered, notifyPrerenderReady } from '../composables/usePrerender';
// import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel.vue' // if you prefer infinite scroll

const { t } = useI18n();
const ui = useUiStore();

// Default type from route: /search|/ -> forRent, /sell -> forSale, /giveaway -> giveaway
const getDefaultType = () => (route.path === '/sell' ? 'forSale' : route.path === '/giveaway' ? 'giveaway' : 'forRent');

const pageTitle = computed(() => {
  if (route.path === '/sell') return t('nav.sell');
  if (route.path === '/giveaway') return t('nav.giveaway');
  return t('nav.forRent');
});

// Per-route SEO (title / description / canonical / OG tags).
// Defaults are tuned for the Hebrew-Israel market since `/` is the default landing.
const seoConfig = computed(() => {
  const base = {
    title: 'Sharo | השכרת מוצרים וציוד בין אנשים בישראל',
    description:
      'חפשו אלפי מוצרים זמינים להשכרה באזור שלכם בישראל - כלי עבודה, ציוד קמפינג, מצלמות, אלקטרוניקה, ספורט ועוד. השכירו מהשכנים בקלות.',
    ogType: 'website',
    canonical: buildCanonical(route.path === '/' ? '/' : route.path),
  };
  if (route.path === '/sell') {
    return {
      ...base,
      title: 'מוצרים יד שנייה למכירה בישראל | Sharo',
      description:
        'מצאו מוצרים יד שנייה במצב מצוין למכירה בישראל - אלקטרוניקה, ריהוט, כלי עבודה ועוד. תחפשו לפי אזור ותחסכו כסף.',
    };
  }
  if (route.path === '/giveaway') {
    return {
      ...base,
      title: 'מוצרים בחינם להעברה בישראל | Sharo',
      description:
        'קבלו מוצרים בחינם משכנים באזור שלכם בישראל. רהיטים, ספרים, ציוד לתינוק ועוד - הכל בחינם, על בסיס כל הקודם זוכה.',
    };
  }
  if (route.path === '/search' || route.path === '/') {
    return base;
  }
  return base;
});

// Re-apply SEO when route or category query changes (e.g. category filter
// from a sitemap-indexed URL like /search?category=Tools).
const { updateSeo } = useSeo();
watch(() => [route.path, route.query.category], () => {
  const cfg = seoConfig.value;
  const categoryQuery = route.query.category;
  const finalTitle = categoryQuery
    ? `${categoryQuery} להשכרה בישראל | Sharo`
    : cfg.title;
  const finalDescription = categoryQuery
    ? `מצאו ${categoryQuery} להשכרה באזור שלכם בישראל. השוו מחירים, קראו ביקורות והשכירו מהשכנים בקלות.`
    : cfg.description;
  updateSeo({
    title: finalTitle,
    description: finalDescription,
    ogTitle: finalTitle,
    ogDescription: finalDescription,
    ogType: cfg.ogType,
    canonical: cfg.canonical,
  });
}, { immediate: true });

// URL-synced search state
const { state, setPatch, setPage, reset } = useQuerySync({
  q: '',
  type: getDefaultType(),
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
const isSelectingLocation = ref(false);
const geocodingLoading = ref(false);
const filtersCollapsed = ref(true); // Start collapsed to show input field

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
  // Geolocation is blocked in headless Puppeteer (used by the prerenderer)
  // and can take many seconds to fail. Don't make the prerender snapshot
  // wait on it - fire prerender-ready as soon as we have either listings
  // or a 4-second budget elapsed, whichever comes first.
  markPrerendered(
    new Promise((resolve) => {
      const done = () => resolve();
      const timer = setTimeout(done, 4000);
      const stopWatch = watch(
        () => data.value.items.length,
        (n) => {
          if (n > 0) {
            clearTimeout(timer);
            stopWatch();
            done();
          }
        }
      );
    }),
    { timeoutMs: 6000 }
  );

  // If URL already has lat/lng (e.g. shared link), respect that
  if (state.value.lat && state.value.lng) {
    isInitialLoad = true;
    useManualLocation();
    await runSearch();
    isInitialLoad = false;
    return;
  }

  // Otherwise, try to get user's current location
  // If location isn't available, show all items
  isInitialLoad = true;
  try {
    await getCurrentLocation();
  } catch (err) {
    // Location not available - show all items without location filter
    console.log('Location not available, showing all items');
    isInitialLoad = false;
    await runSearch();
    return;
  }
  // Snapshot is already covered above; nothing else to do here.
  notifyPrerenderReady();
});

// Derived label
const resultsLabel = computed(() => {
  const t = data.value.total;
  if (t === 0) return 'No items found';
  const start = (data.value.page - 1) * data.value.per_page + 1;
  const end = Math.min(data.value.page * data.value.per_page, t);
  return `Showing ${start}–${end} of ${t}`;
});

// Debounce search to prevent duplicate calls
let searchTimeout = null;
let isSearching = false;

async function runSearch() {
  // Clear any pending search
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
  
  // If already searching, queue the next search
  if (isSearching) {
    searchTimeout = setTimeout(() => runSearch(), 200);
    return;
  }
  
  isSearching = true;
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
    isSearching = false;
    
    // Execute queued search if any
    if (searchTimeout) {
      const timeout = searchTimeout;
      searchTimeout = null;
      clearTimeout(timeout);
      runSearch();
    }
  }
}

function applyFilters(ev) {
  ev?.preventDefault?.();
  setPage(1);
  runSearch();
  // Auto-collapse filters after applying
  filtersCollapsed.value = true;
}

function toggleFilters() {
  filtersCollapsed.value = !filtersCollapsed.value;
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
    throw new Error('Geolocation is not supported by your browser');
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
          locationError.value = errorMessage;
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
    
    // Update state - only set radiusKm if it's not already set to avoid triggering watch
    if (state.value.radiusKm) {
      setPatch({ lat, lng });
    } else {
      setPatch({ lat, lng, radiusKm: radius });
    }
    
    // Wait a bit for state to update, then trigger search
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Reset flags and trigger search
    isSettingLocation = false;
    isInitialLoad = false; // Mark initial load as complete
    lastSearchedLocation = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    runSearch();
    
    // Try to get address from coordinates (reverse geocoding) - non-blocking
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
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
    locationLoading.value = false;
    // Re-throw error so onMounted can handle it and show all items
    throw err;
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
let isInitialLoad = true; // Track if we're in initial load phase

// Sync location search query with current location address
watch(() => currentLocation.value.address, (newAddress) => {
  if (newAddress && !locationSearchQuery.value) {
    locationSearchQuery.value = newAddress;
  }
});

watch(() => [state.value.lat, state.value.lng], ([lat, lng], [oldLat, oldLng]) => {
  // Don't trigger during initial load or when location is being set programmatically
  if (isInitialLoad || isSettingLocation) return;
  
  // Only trigger if lat/lng actually changed
  if (lat && lng && (lat !== oldLat || lng !== oldLng)) {
    useManualLocation();
    // Trigger search when location is manually set
    const locationKey = `${parseFloat(lat).toFixed(6)},${parseFloat(lng).toFixed(6)}`;
    if (lastSearchedLocation !== locationKey) {
      lastSearchedLocation = locationKey;
      runSearch();
    }
  }
});

// Watch for radius changes and trigger search
let radiusTimeout = null;
watch(() => state.value.radiusKm, (newRadius, oldRadius) => {
  // Don't trigger during initial load or when location is being set (to avoid duplicate searches)
  if (isInitialLoad || isSettingLocation) return;
  
  if (state.value.lat && state.value.lng && newRadius != null && newRadius !== '' && newRadius !== oldRadius) {
    // Clear previous timeout
    if (radiusTimeout) clearTimeout(radiusTimeout);
    // Debounce search to avoid too many requests
    radiusTimeout = window.setTimeout(() => {
      runSearch();
    }, 500);
  }
});

// Geocoding functions - convert address to coordinates
let geocodeTimeout = null;
let blurTimeout = null;

async function searchLocation(query) {
  if (!query || query.trim().length < 3) {
    locationSuggestions.value = [];
    showingSuggestions.value = false;
    return;
  }

  if (geocodeTimeout) {
    clearTimeout(geocodeTimeout);
  }
  geocodeTimeout = window.setTimeout(async () => {
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
  if (!suggestion || !suggestion.display_name) {
    return;
  }

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

  isSelectingLocation.value = true;
  locationSearchQuery.value = suggestion.display_name;
  locationSuggestions.value = [];
  showingSuggestions.value = false;
  locationError.value = null;

  // Clear any pending blur timeout
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }

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
  window.setTimeout(() => {
    isSettingLocation = false;
    isSelectingLocation.value = false;
    runSearch();
  }, 150);
}

function handleLocationBlur() {
  // Don't close suggestions if user is clicking on a suggestion
  if (isSelectingLocation.value) {
    return;
  }
  // Clear any existing blur timeout
  if (blurTimeout) {
    clearTimeout(blurTimeout);
  }
  // Delay closing to allow click events to fire
  blurTimeout = window.setTimeout(() => {
    if (!isSelectingLocation.value) {
      showingSuggestions.value = false;
    }
    blurTimeout = null;
  }, 200);
}

function clearLocationSearch() {
  locationSearchQuery.value = '';
  locationSuggestions.value = [];
  showingSuggestions.value = false;
}

// Track last location to prevent duplicate searches
let lastSearchedLocation = null;

// Handle location change from map drag
function handleLocationChanged(newLocation) {
  if (newLocation && newLocation.lat && newLocation.lng) {
    // Check if this is the same location we just searched (e.g., address update)
    const locationKey = `${newLocation.lat.toFixed(6)},${newLocation.lng.toFixed(6)}`;
    const isAddressUpdate = lastSearchedLocation === locationKey;
    
    // Update current location
    currentLocation.value = { ...newLocation };
    
    // If this is just an address update (same coordinates), don't search again
    if (isAddressUpdate) {
      return;
    }
    
    // Don't trigger search during initial load (map initialization)
    if (isInitialLoad) {
      lastSearchedLocation = locationKey;
      return;
    }
    
    // Prevent watch from triggering duplicate search
    isSettingLocation = true;
    
    // Update state with new location
    setPatch({ lat: newLocation.lat, lng: newLocation.lng });
    
    // Wait for state to update, then trigger search
    window.setTimeout(() => {
      isSettingLocation = false;
      lastSearchedLocation = locationKey;
      runSearch();
    }, 200);
  }
}

// Helper function to get item thumbnail for mobile list view
function getItemThumbnail(item) {
  if (item.thumbnail) {
    return getItemPhotoUrl(item.thumbnail);
  }
  if (item.photos && item.photos.length > 0) {
    return getItemPhotoUrl(item.photos);
  }
  return null;
}

// Format price for mobile list view
function formatPrice(amount) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount / 100);
}

function formatItemPrice(item) {
  const t = item?.type || ((item?.sellPrice ?? item?.sell_price) > 0 ? 'forSale' : (item?.pricePerDay ?? item?.price_per_day) > 0 ? 'forRent' : 'giveaway');
  if (t === 'giveaway') return 'Free';
  if (t === 'forSale') return formatPrice(item.sellPrice || item.sell_price || 0);
  return `${formatPrice(item.pricePerDay || item.price_per_day || 0)}/day`;
}

// If you want infinite scroll instead of the pager, keep an accumulator:
// - store all items in an array and append when sentinel becomes visible and page < total_pages.
</script>

<template>
  <div class="search-page">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div class="d-flex align-items-center gap-2">
        <h1 class="h4 mb-0">{{ pageTitle }}</h1>
        <!-- <button
          class="btn btn-outline-secondary btn-sm"
          @click="toggleFilters"
          :aria-expanded="!filtersCollapsed"
          aria-controls="filtersCollapse"
        >
          <i class="bi" :class="filtersCollapsed ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
          <span class="d-none d-sm-inline ms-1">{{ filtersCollapsed ? 'Show' : 'Hide' }} Filters</span>
        </button> -->
      </div>
      <div class="btn-group" role="group">
        <input
          type="radio"
          class="btn-check"
          id="view-map"
          value="map"
          v-model="viewMode"
        />
        <label class="btn btn-outline-primary btn-sm" for="view-map">
          <i class="bi bi-map me-1"></i> {{ $t('search.map') }}
        </label>
        <input
          type="radio"
          class="btn-check"
          id="view-list"
          value="list"
          v-model="viewMode"
        />
        <label class="btn btn-outline-primary btn-sm" for="view-list">
          <i class="bi bi-list-ul me-1"></i> {{ $t('search.list') }}
        </label>
      </div>
    </div>

    <div class="row g-3">
      <!-- Filters Sidebar -->
      <div class="col-12 col-lg-3">
      <div class="card">
        <!-- Collapsed state: Show input field -->
        <div v-show="filtersCollapsed" class="p-2">
          <div class="position-relative">
            <input
              type="text"
              class="form-control search-input-collapsed"
              :placeholder="$t('search.placeholder')"
              readonly
              @click="toggleFilters"
              @focus="toggleFilters"
            />
            <i class="bi bi-search position-absolute search-icon-collapsed"></i>
          </div>
        </div>
        
        <!-- Expanded state: Show header and filters -->
        <template v-if="!filtersCollapsed">
          <button
            class="btn btn-link btn-sm p-0 text-decoration-none w-100"
            @click="toggleFilters"
            :aria-expanded="!filtersCollapsed"
            aria-controls="filtersCollapse"
          >
            <div class="card-header d-flex justify-content-between align-items-center p-2">
              <h2 class="h6 mb-0">{{ $t('search.filters') }}</h2>
              <i class="bi filters-chevron bi-chevron-up"></i>
            </div>
          </button>
        
          <div id="filtersCollapse">
            <form class="card-body p-3" @submit.prevent="applyFilters">
        <div class="mb-3">
          <label class="form-label">{{ $t('search.keyword') }}</label>
          <input v-model="state.q" class="form-control" :placeholder="$t('search.placeholder')" />
        </div>

        <!-- <div class="mb-3">
          <label class="form-label">{{ $t('search.category') }}</label>
          <input 
            v-model="state.category" 
            class="form-control" 
            type="text"
            :placeholder="$t('search.category')"
          />
        </div> -->

        

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
              <label class="form-label small">{{ $t('search.location') }}</label>
              <div class="position-relative">
                <div class="input-group input-group-sm">
                  <span class="input-group-text">
                    <i class="bi bi-search"></i>
                  </span>
                  <input
                    v-model="locationSearchQuery"
                    type="text"
                    class="form-control"
                    :placeholder="$t('search.locationSearchPlaceholder')"
                    @input="searchLocation(locationSearchQuery)"
                    @focus="showingSuggestions = locationSuggestions.length > 0"
                    @blur="handleLocationBlur"
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
                {{ locationLoading ? $t('search.gettingLocation') : (currentLocation.lat ? $t('search.updateMyLocation') : $t('search.useMyLocation')) }}
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
                {{ $t('search.searchRadius') }}: <strong>{{ radiusValue }} {{ $t('search.km') }}</strong>
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
              <i class="bi bi-x-circle me-1"></i> {{ $t('search.clearLocation') }}
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
            <i class="bi bi-search me-1"></i> {{ $t('search.apply') }}
          </button>
          <button class="btn btn-outline-secondary" type="button" @click="clearFilters">{{ $t('search.reset') }}</button>
        </div>
            </form>
          </div>
        </template>
      </div>
    </div>

    <!-- Map/Results Area -->
    <div class="col-12 col-lg-9">
      <!-- Map View -->
      <div v-show="viewMode === 'map'" class="map-container">
        <SearchMap
          :user-location="currentLocation"
          :items="data.items"
          :radius-km="state.radiusKm || 15"
          @location-changed="handleLocationChanged"
        />
      </div>

      <!-- List View -->
      <div v-show="viewMode === 'list'">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="small text-secondary">{{ resultsLabel }}</div>
          <div class="d-flex align-items-center gap-2">
            <label class="small text-secondary">{{ $t('search.perPage') }}</label>
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

        <!-- Desktop Grid View (lg and up) -->
        <div class="items-grid row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 d-none d-lg-flex">
          <div v-for="item in data.items" :key="item.id" class="col">
            <ItemCard :item="item" />
          </div>

          <div v-if="!loading && data.items.length === 0" class="col-12">
            <div class="alert alert-warning">{{ $t('search.noResults') }}</div>
          </div>
        </div>

        <!-- Mobile/Tablet List View (below lg) -->
        <div class="d-lg-none">
          <div v-for="item in data.items" :key="item.id" class="mobile-list-item">
            <router-link :to="`/item/${item.id}`" class="mobile-list-item-link">
              <div class="mobile-list-item-content">
                <div class="mobile-list-item-info">
                  <h3 class="mobile-list-item-title">{{ item.title }}</h3>
                  <div class="mobile-list-item-meta">
                    <div class="mobile-list-item-location">
                      <i class="bi bi-geo-alt-fill"></i>
                      <span>{{ item.location || item.address || 'Location not specified' }}</span>
                    </div>
                    <div v-if="item.distance" class="mobile-list-item-distance">
                      <i class="bi bi-arrow-right"></i>
                      {{ item.distance.toFixed(1) }} km
                    </div>
                  </div>
                  <div class="mobile-list-item-footer">
                    <span class="mobile-list-item-price">{{ formatItemPrice(item) }}</span>
                    <span class="mobile-list-item-rating">
                      <i class="bi bi-star-fill"></i>
                      {{ item.rating ?? '—' }}
                      <span class="text-muted">({{ item.reviews_count ?? 0 }})</span>
                    </span>
                  </div>
                </div>
                <div class="mobile-list-item-image">
                  <img
                    v-if="getItemThumbnail(item)"
                    :src="getItemThumbnail(item)"
                    :alt="item.title"
                    class="mobile-list-item-img"
                  />
                  <div v-else class="mobile-list-item-placeholder">
                    <i class="bi bi-image"></i>
                  </div>
                </div>
              </div>
            </router-link>
          </div>

          <div v-if="!loading && data.items.length === 0" class="alert alert-warning">No items matched your filters.</div>
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

/* Mobile List View Styles */
.mobile-list-item {
  margin-bottom: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  overflow: hidden;
  background: white;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.mobile-list-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.mobile-list-item-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.mobile-list-item-link:hover {
  color: inherit;
  text-decoration: none;
}

.mobile-list-item-content {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  padding: 0.75rem;
}

.mobile-list-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mobile-list-item-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #212529;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.mobile-list-item-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.mobile-list-item-location {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #6c757d;
  overflow: hidden;
}

.mobile-list-item-location i {
  color: #4285F4;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.mobile-list-item-location span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-list-item-distance {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #0d6efd;
  font-size: 0.75rem;
  font-weight: 500;
}

.mobile-list-item-distance i {
  font-size: 0.7rem;
}

.mobile-list-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid #f0f0f0;
}

.mobile-list-item-price {
  font-weight: 700;
  font-size: 0.9rem;
  color: #0d6efd;
}

.mobile-list-item-rating {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #212529;
}

.mobile-list-item-rating i {
  color: #ffc107;
  font-size: 0.75rem;
}

.mobile-list-item-image {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 0.375rem;
  overflow: hidden;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-list-item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mobile-list-item-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #adb5bd;
  font-size: 1.5rem;
}

/* Filters Collapse Styles */
.card-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.card-header:hover {
  background-color: #e9ecef;
}

.card-header button {
  color: #6c757d;
  transition: color 0.2s ease;
}

.card-header button:hover {
  color: #0d6efd;
}

/* Filters Collapse Animation */
.filters-collapse-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.filters-collapse-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.filters-collapse-enter-from {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.filters-collapse-enter-to {
  max-height: 3000px; /* Large enough to accommodate any filter content */
  opacity: 1;
  transform: translateY(0);
}

.filters-collapse-leave-from {
  max-height: 3000px;
  opacity: 1;
  transform: translateY(0);
}

.filters-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}

/* Ensure smooth animation and prevent layout shift */
#filtersCollapse {
  will-change: max-height, opacity, transform;
  display: block;
}

/* Chevron icon rotation animation */
.filters-chevron {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

.card-header:hover .filters-chevron {
  transform: scale(1.1);
}

/* Collapsed filters input styling */
.search-input-collapsed {
  cursor: pointer;
  padding-left: 2.5rem;
  background-color: #fff;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.search-input-collapsed:hover {
  border-color: #adb5bd;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.1);
}

.search-input-collapsed:focus {
  border-color: #86b7fe;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
  outline: 0;
}

.search-icon-collapsed {
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  pointer-events: none;
  z-index: 1;
}

/* Desktop Grid View Styles - Only apply on lg and up */
@media (min-width: 992px) {
  .items-grid {
    display: flex !important;
    flex-wrap: wrap !important;
    margin-left: calc(var(--bs-gutter-x, 0.75rem) * -0.5);
    margin-right: calc(var(--bs-gutter-x, 0.75rem) * -0.5);
  }

  .items-grid > .col {
    flex: 0 0 auto;
    width: 33.333333%;
    padding-left: calc(var(--bs-gutter-x, 0.75rem) * 0.5);
    padding-right: calc(var(--bs-gutter-x, 0.75rem) * 0.5);
  }
}
</style>
