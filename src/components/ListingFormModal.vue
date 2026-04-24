<script setup>
import { reactive, ref, watch, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../stores/ui';
import { fetchPopularTags } from '../services/listingsService';
import http from '../lib/http';
import { compressImageBeforeUpload } from '../utils/imageCompression';

const { t } = useI18n();
const ui = useUiStore();

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  listing: { type: Object, default: null }, // if passed -> edit
});
const emit = defineEmits(['update:modelValue', 'submit']);

const LISTING_TYPES = ['rent', 'sale', 'giveaway'];

const form = reactive({
  listingType: 'rent',
  title: '',
  tags: [],
  location: '',
  latitude: null,
  longitude: null,
  address: '',
  pricePerDay: 0,
  initialPrice: 0,
  deposit: 0,
  sellPrice: 0,
  currency: 'ILS',
  description: '',
  photos: [],
});

const locs = reactive({ list: [] });
const MAX_TAGS = 10;
const tagInputQuery = ref('');
const tagDropdownOpen = ref(false);
const isSelectingTag = ref(false);
const popularTagsFromApi = ref([]);
const loadingTags = ref(false);

// Template sets: quick-add tag groups (tags may come from API or be custom)
const TAG_TEMPLATES = [
  { id: 'tools', tags: ['drill', 'hammer', 'screwdriver', 'lawn mower'] },
  { id: 'electronics', tags: ['camera', 'laptop', 'projector', 'drone'] },
  { id: 'outdoor', tags: ['tent', 'camping stove', 'bike', 'kayak'] },
  { id: 'gaming', tags: ['playstation', 'xbox', 'board games'] },
  { id: 'baby', tags: ['stroller', 'crib', 'baby gear'] },
  { id: 'fitness', tags: ['treadmill', 'weights', 'fitness equipment'] },
];

const availableTagsForDropdown = computed(() => {
  const selected = new Set(form.tags.map(t => String(t).toLowerCase()));
  return popularTagsFromApi.value.filter(t => !selected.has(String(t).toLowerCase()));
});

const tagQueryNormalized = computed(() => (tagInputQuery.value || '').trim());
const tagSuggestions = computed(() => {
  const selected = new Set(form.tags.map(t => String(t).toLowerCase()));
  const q = tagQueryNormalized.value;
  const qLower = q.toLowerCase();

  const base = availableTagsForDropdown.value
    .filter(t => String(t).toLowerCase() !== qLower)
    .map(t => ({ tag: t, isQuery: false }));

  // Always show what the user typed as the first option (if non-empty and not already selected).
  if (q && !selected.has(qLower)) {
    return [{ tag: q, isQuery: true }, ...base];
  }
  return base;
});

let tagSearchTimeout = null;
async function loadPopularTags(q = '') {
  loadingTags.value = true;
  try {
    const tags = await fetchPopularTags(q, 20);
    popularTagsFromApi.value = tags;
  } catch (e) {
    console.warn('Failed to fetch popular tags:', e);
    popularTagsFromApi.value = [];
  } finally {
    loadingTags.value = false;
  }
}
const photoInput = ref(null);
const uploadingPhotos = ref(false);
const submitting = ref(false);

function addTag(tag) {
  const normalized = (tag || '').trim();
  if (!normalized || form.tags.length >= MAX_TAGS) return;
  const lower = normalized.toLowerCase();
  if (form.tags.some(t => t.toLowerCase() === lower)) return;
  form.tags.push(normalized);
  tagInputQuery.value = '';
  tagDropdownOpen.value = false;
}

function removeTag(index) {
  form.tags.splice(index, 1);
}

function applyTemplate(template) {
  const toAdd = template.tags.filter(t => {
    const lower = t.toLowerCase();
    return !form.tags.some(sel => sel.toLowerCase() === lower);
  });
  const remaining = MAX_TAGS - form.tags.length;
  toAdd.slice(0, remaining).forEach(t => form.tags.push(t));
  tagDropdownOpen.value = false;
  tagInputQuery.value = '';
}

function handleTagInputKeydown(e) {
  if (e.key === 'Enter' && tagInputQuery.value.trim()) {
    e.preventDefault();
    addTag(tagInputQuery.value);
  } else if (e.key === 'Backspace' && !tagInputQuery.value && form.tags.length) {
    form.tags.pop();
  }
}

function addTagSuggestion(suggestion) {
  const tag = suggestion?.tag;
  if (!tag) return;
  isSelectingTag.value = true;
  addTag(tag);
  isSelectingTag.value = false;
}

function handleTagDropdownBlur() {
  if (isSelectingTag.value) return;
  setTimeout(() => {
    if (!isSelectingTag.value) tagDropdownOpen.value = false;
  }, 150);
}

// Location search
const locationSearchQuery = ref('');
const locationSuggestions = ref([]);
const showingSuggestions = ref(false);
const isSelectingLocation = ref(false); // Track if user is clicking on a suggestion
const locationLoading = ref(false);

// Fetch popular tags when modal opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) loadPopularTags('');
  }
);

// Debounced tag search when user types (500ms)
watch(
  () => tagInputQuery.value,
  (q) => {
    if (tagSearchTimeout) clearTimeout(tagSearchTimeout);
    tagSearchTimeout = setTimeout(() => {
      if (props.modelValue) loadPopularTags(q || '');
      tagSearchTimeout = null;
    }, 500);
  }
);

watch(
  () => props.listing,
  (v) => {
    if (v) {
      const existingTags = v.tags || (v.category ? [v.category] : []);
      // API returns type: forRent | forSale | giveaway; map to form values
      const typeFromApi = v.type || v.listingType;
      const typeMap = { forRent: 'rent', forSale: 'sale', giveaway: 'giveaway' };
      const type = typeMap[typeFromApi] ||
        (v.sellPrice != null && v.sellPrice > 0 ? 'sale' :
         (v.pricePerDay != null && v.pricePerDay > 0 ? 'rent' : 'giveaway'));
      Object.assign(form, {
        listingType: type,
        title: v.title || '',
        tags: Array.isArray(existingTags) ? [...existingTags] : [],
        location: v.location || v.address || '',
        latitude: v.latitude || null,
        longitude: v.longitude || null,
        address: v.address || v.location || '',
        pricePerDay: v.pricePerDay ? (v.pricePerDay / 100) : 0,
        initialPrice: v.initialPrice ? (v.initialPrice / 100) : 0,
        deposit: v.deposit ? (v.deposit / 100) : 0,
        sellPrice: v.sellPrice ? (v.sellPrice / 100) : 0,
        currency: v.currency || 'ILS',
        description: v.description || '',
        photos: (v.photos || []).map(photo => ({
          url: typeof photo === 'string' ? photo : photo.url,
          publicUrl: typeof photo === 'string' ? photo : photo.publicUrl || photo.url,
          preview: typeof photo === 'string' ? photo : photo.url,
          file: null
        })),
      });
      locationSearchQuery.value = v.address || v.location || '';
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

function resetForm() {
  Object.assign(form, {
    listingType: 'rent',
    title: '',
    tags: [],
    location: '',
    latitude: null,
    longitude: null,
    address: '',
    pricePerDay: 0,
    initialPrice: 0,
    deposit: 0,
    sellPrice: 0,
    currency: 'ILS',
    description: '',
    photos: [],
  });
  locationSearchQuery.value = '';
  tagInputQuery.value = '';
  tagDropdownOpen.value = false;
}

onMounted(() => {
  locs.list = [];
});

// Location search functions
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
  if (!suggestion || !suggestion.display_name) {
    return;
  }

  const lat = parseFloat(suggestion.lat);
  const lng = parseFloat(suggestion.lon);
  
  if (isNaN(lat) || isNaN(lng)) {
    return;
  }

  isSelectingLocation.value = true;
  locationSearchQuery.value = suggestion.display_name || '';
  locationSuggestions.value = [];
  showingSuggestions.value = false;
  
  form.location = suggestion.display_name;
  form.address = suggestion.display_name;
  form.latitude = lat;
  form.longitude = lng;

  // Reset flag after a short delay
  setTimeout(() => {
    isSelectingLocation.value = false;
  }, 100);
}

function handleLocationBlur() {
  // Don't close suggestions if user is clicking on a suggestion
  if (isSelectingLocation.value) {
    return;
  }
  // Delay closing to allow click events to fire
  setTimeout(() => {
    if (!isSelectingLocation.value) {
      showingSuggestions.value = false;
    }
  }, 200);
}

async function getCurrentLocation() {
  if (submitting.value || locationLoading.value) return;
  if (!navigator.geolocation) {
    ui.showToast('Geolocation is not supported by your browser', 'danger');
    return;
  }
  locationLoading.value = true;
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          let msg = 'Failed to get location. ';
          if (err.code === 1) msg += 'Please allow location access.';
          else if (err.code === 2) msg += 'Location unavailable.';
          else if (err.code === 3) msg += 'Request timed out.';
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`);
    const data = await res.json().catch(() => ({}));
    const displayName = data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    selectLocation({ display_name: displayName, lat: String(lat), lon: String(lng) });
    ui.showToast('Location set from your device', 'success');
  } catch (e) {
    ui.showToast(e?.message || 'Failed to get location', 'danger');
  } finally {
    locationLoading.value = false;
  }
}

// Photo upload functions
async function handlePhotoUpload(event) {
  const files = Array.from(event.target.files || []);
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      ui.showToast(t('listing.invalidFileType'), 'danger');
      continue;
    }
    
    let fileToUse = file;
    try {
      const compressed = await compressImageBeforeUpload(file, { maxSizeBytes: maxSize });
      fileToUse = compressed.file;
    } catch (e) {
      console.warn('Image compression failed, using original.', e);
    }

    if (fileToUse.size > maxSize) {
      ui.showToast(t('listing.fileTooLarge'), 'danger');
      continue;
    }

    const preview = URL.createObjectURL(fileToUse);
    form.photos.push({
      file: fileToUse,
      preview,
      url: null // Will be set after upload
    });
  }

  // Reset input
  if (photoInput.value) {
    photoInput.value.value = '';
  }
}

function removePhoto(index) {
  const p = form.photos[index];
  if (p?.preview && typeof p.preview === 'string' && p.preview.startsWith('blob:')) {
    URL.revokeObjectURL(p.preview);
  }
  form.photos.splice(index, 1);
}

// Upload photos to backend
async function uploadPhotos() {
  const photosToUpload = form.photos.filter(photo => photo.file && !photo.url);
  
  if (photosToUpload.length === 0) {
    // Return existing URLs
    return form.photos.map(photo => photo.url || photo.publicUrl).filter(Boolean);
  }

  uploadingPhotos.value = true;
  
  try {
    const formData = new FormData();
    photosToUpload.forEach(photo => {
      formData.append('files', photo.file);
    });
    formData.append('folder', 'items');

    const { data } = await http.post('/uploads/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60 seconds for multiple files
    });

    // Update photos with URLs
    const uploadedUrls = data.urls || [];
    let urlIndex = 0;
    
    form.photos.forEach(photo => {
      if (photo.file && !photo.url) {
        if (uploadedUrls[urlIndex]) {
          photo.url = uploadedUrls[urlIndex];
          photo.publicUrl = uploadedUrls[urlIndex];
          urlIndex++;
        }
      }
    });

    return form.photos.map(photo => photo.url || photo.publicUrl).filter(Boolean);
  } catch (error) {
    console.error('Photo upload error:', error);
    ui.showToast(error?.response?.data?.message || t('listing.photoUploadFailed'), 'danger');
    throw error;
  } finally {
    uploadingPhotos.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
  resetForm();
  submitting.value = false;
}

// Watch for modal close to reset submitting state
watch(() => props.modelValue, (isOpen) => {
  if (!isOpen) {
    submitting.value = false;
  }
});

async function addPhotosToItem(itemId, photoUrls) {
  if (!photoUrls || photoUrls.length === 0) {
    return;
  }

  try {
    // Add each photo to the item
    for (let i = 0; i < photoUrls.length; i++) {
      await http.post(`/items/${itemId}/photos`, {
        url: photoUrls[i],
        position: i
      });
    }
  } catch (error) {
    console.error('Error adding photos to item:', error);
    throw error;
  }
}

async function submit() {
  // Validation
  if (!form.title) {
    ui.showToast(t('listing.titleRequired'), 'danger');
    return;
  }
  if (!form.tags || form.tags.length === 0) {
    ui.showToast(t('listing.tagsRequired'), 'danger');
    return;
  }
  
  if (!form.location && !form.address) {
    ui.showToast(t('listing.locationRequired'), 'danger');
    return;
  }

  if (form.listingType === 'rent' && (!form.pricePerDay || form.pricePerDay <= 0)) {
    ui.showToast(t('listing.validPriceRequired'), 'danger');
    return;
  }
  if (form.listingType === 'sale' && (!form.sellPrice || form.sellPrice <= 0)) {
    ui.showToast(t('listing.validSellPriceRequired'), 'danger');
    return;
  }

  submitting.value = true;

  try {
    // Upload photos first
    let photoUrls = [];
    try {
      photoUrls = await uploadPhotos();
    } catch (error) {
      // Error already shown in uploadPhotos
      submitting.value = false;
      return;
    }

    // Prepare form data - prices in display format; service converts to cents
    const submitData = {
      listingType: form.listingType,
      title: form.title,
      tags: form.tags,
      location: form.location || form.address,
      address: form.address || form.location,
      latitude: form.latitude,
      longitude: form.longitude,
      currency: form.currency,
      description: form.description,
    };
    if (form.listingType === 'rent') {
      submitData.pricePerDay = form.pricePerDay;
      submitData.initialPrice = form.initialPrice || 0;
      submitData.deposit = form.deposit || 0;
    } else if (form.listingType === 'sale') {
      submitData.sellPrice = form.sellPrice;
    }

    // Emit submit event with photos to handle in parent component
    // The parent should handle the API call and close the modal on success
    emit('submit', { ...submitData, photoUrls });
    
    // Note: Modal will be closed by parent component on success
    // If parent handles errors, it should reset submitting state
  } catch (error) {
    console.error('Submit error:', error);
    submitting.value = false;
  }
}
</script>

<template>
  <div
    class="modal fade"
    :class="{ show: modelValue }"
    style="display: block"
    v-if="modelValue"
    tabindex="-1"
    @click.self="close"
  >
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header border-bottom">
          <h5 class="modal-title fw-bold">
            <i class="bi bi-plus-circle me-2"></i>
            {{ listing ? $t('listing.editListing') : $t('listing.createNewListing') }}
          </h5>
          <button class="btn-close" @click="close" :aria-label="$t('common.close')"></button>
        </div>
        <div class="modal-body">
          <!-- Listing Type Choice -->
          <div class="mb-4">
            <label class="form-label fw-semibold">
              {{ $t('listing.listingType') }} <span class="text-danger">*</span>
            </label>
            <div class="listing-type-choices">
              <button
                v-for="t in LISTING_TYPES"
                :key="t"
                type="button"
                class="listing-type-btn"
                :class="{ active: form.listingType === t }"
                @click="form.listingType = t"
              >
                <i class="bi" :class="t === 'rent' ? 'bi-calendar-check' : t === 'sale' ? 'bi-cash' : 'bi-gift'"></i>
                <span>{{ $t(`listing.type.${t}`) }}</span>
              </button>
            </div>
          </div>

          <!-- Title -->
          <div class="mb-3">
            <label class="form-label fw-semibold">
              {{ $t('listing.title') }} <span class="text-danger">*</span>
            </label>
            <input 
              v-model="form.title" 
              class="form-control form-control-lg" 
              :placeholder="$t('listing.enterItemTitle')"
            />
          </div>

          <!-- Tags and Location Row -->
          <div class="row g-3 mb-3">
            <div class="col-md-6 position-relative">
              <label class="form-label fw-semibold">
                {{ $t('listing.tags') }} <span class="text-danger">*</span>
              </label>
              <!-- Templates -->
              <!-- <div class="d-flex flex-wrap gap-1 mb-2">
                <button
                  v-for="tpl in TAG_TEMPLATES"
                  :key="tpl.id"
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  @click="applyTemplate(tpl)"
                >
                  {{ $t(`listing.tagTemplate.${tpl.id}`) }}
                </button>
              </div> -->
              <!-- Tag input: tags inside + dropdown -->
              <div
                class="tag-input-wrapper position-relative"
                :class="{ 'tag-input-focused': tagDropdownOpen }"
              >
                <div class="tag-input-inner">
                  <span
                    v-for="(tag, idx) in form.tags"
                    :key="idx"
                    class="tag-pill"
                  >
                    {{ tag }}
                    <button
                      type="button"
                      class="tag-pill-remove"
                      :aria-label="$t('common.remove')"
                      @click="removeTag(idx)"
                    >
                      <i class="bi bi-x"></i>
                    </button>
                  </span>
                  <input
                    v-if="form.tags.length < MAX_TAGS"
                    v-model="tagInputQuery"
                    type="text"
                    class="tag-input-field"
                    :placeholder="form.tags.length ? '' : $t('listing.tagsPlaceholder')"
                    @focus="tagDropdownOpen = true"
                    @keydown="handleTagInputKeydown"
                  />
                  <button
                    v-if="form.tags.length < MAX_TAGS"
                    type="button"
                    class="tag-dropdown-btn"
                    :aria-expanded="tagDropdownOpen"
                    aria-haspopup="listbox"
                    @click="tagDropdownOpen = !tagDropdownOpen"
                    @blur="handleTagDropdownBlur"
                  >
                    <i class="bi" :class="tagDropdownOpen ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                  </button>
                </div>
              </div>
              <div
                v-if="tagDropdownOpen && form.tags.length < MAX_TAGS"
                class="tag-dropdown"
                @blur="handleTagDropdownBlur"
              >
                <button
                  v-for="s in tagSuggestions"
                  :key="`${s.isQuery ? 'q:' : 't:'}${s.tag}`"
                  type="button"
                  class="tag-suggestion-item"
                  @mousedown.prevent="addTagSuggestion(s)"
                >
                  <span class="tag-suggestion-text">
                    <span v-if="s.isQuery" class="tag-suggestion-add-prefix">+</span>
                    {{ s.tag }}
                  </span>
                  <span class="tag-suggestion-plus" aria-hidden="true">+</span>
                </button>
                <div v-if="!tagSuggestions.length" class="tag-dropdown-empty">
                  {{ $t('listing.allTagsAdded') }}
                </div>
              </div>
              <small class="text-muted d-block mt-1">{{ $t('listing.tagsHint') }}</small>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">
                {{ $t('listing.location') }} <span class="text-danger">*</span>
              </label>
              <div class="position-relative">
                <div class="input-group">
                  <span
                    class="input-group-text location-icon-clickable"
                    role="button"
                    :title="$t('search.useMyLocation')"
                    @click="getCurrentLocation"
                    :aria-label="$t('search.useMyLocation')"
                    :class="{ 'opacity-50': submitting }"
                  >
                    <span v-if="locationLoading" class="spinner-border spinner-border-sm" role="status"></span>
                    <i v-else class="bi bi-geo-alt"></i>
                  </span>
                  <input
                    v-model="locationSearchQuery"
                    type="text"
                    class="form-control form-select-lg"
                    :placeholder="$t('listing.searchForLocation')"
                    @input="searchLocationQuery(locationSearchQuery)"
                    @focus="showingSuggestions = locationSuggestions.length > 0"
                    @blur="handleLocationBlur"
                    @keyup.enter.prevent="locationSuggestions.length > 0 && selectLocation(locationSuggestions[0])"
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
                      <div class="fw-semibold small">{{ suggestion.display_name?.split(',')[0] || $t('listing.location') }}</div>
                      <div class="text-muted" style="font-size: 0.75rem;">{{ suggestion.display_name || '' }}</div>
                    </div>
                  </div>
                </div>
                <div class="mt-2">
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    @click="getCurrentLocation"
                    :disabled="locationLoading || submitting"
                  >
                    <span v-if="locationLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
                    <i v-else class="bi bi-geo-alt me-1"></i>
                    {{ locationLoading ? $t('search.gettingLocation') : $t('search.useMyLocation') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Price Fields (conditional) -->
          <div v-if="form.listingType === 'rent'" class="card bg-light p-3 mb-3">
            <h6 class="fw-semibold mb-3">
              <i class="bi bi-currency-exchange me-2"></i>
              {{ $t('listing.pricing') }}
            </h6>
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label fw-semibold">
                  {{ $t('listing.pricePerDay') }} <span class="text-danger">*</span>
                </label>
                <div class="input-group">
                  <input 
                    v-model.number="form.pricePerDay" 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    class="form-control" 
                    placeholder="0.00"
                  />
                  <span class="input-group-text">{{ form.currency }}</span>
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold">
                  {{ $t('listing.initialPrice') }}
                  <i class="bi bi-question-circle text-muted ms-1" 
                     :title="$t('listing.initialPriceTooltip')"></i>
                </label>
                <div class="input-group">
                  <input 
                    v-model.number="form.initialPrice" 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    class="form-control" 
                    placeholder="0.00"
                  />
                  <span class="input-group-text">{{ form.currency }}</span>
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold">
                  {{ $t('listing.deposit') }}
                  <i class="bi bi-question-circle text-muted ms-1" 
                     :title="$t('listing.depositTooltip')"></i>
                </label>
                <div class="input-group">
                  <input 
                    v-model.number="form.deposit" 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    class="form-control" 
                    placeholder="0.00"
                  />
                  <span class="input-group-text">{{ form.currency }}</span>
                </div>
              </div>
            </div>
            <div class="mt-2">
              <label class="form-label fw-semibold">{{ $t('listing.currency') }}</label>
              <select v-model="form.currency" class="form-select">
                <option value="ILS">ILS (₪)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div v-else-if="form.listingType === 'sale'" class="card bg-light p-3 mb-3">
            <h6 class="fw-semibold mb-3">
              <i class="bi bi-cash me-2"></i>
              {{ $t('listing.sellPrice') }}
            </h6>
            <div class="row g-3 align-items-end">
              <div class="col-md-6">
                <label class="form-label fw-semibold">
                  {{ $t('listing.sellPrice') }} <span class="text-danger">*</span>
                </label>
                <div class="input-group">
                  <input 
                    v-model.number="form.sellPrice" 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    class="form-control" 
                    placeholder="0.00"
                  />
                  <span class="input-group-text">{{ form.currency }}</span>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">{{ $t('listing.currency') }}</label>
                <select v-model="form.currency" class="form-select">
                  <option value="ILS">ILS (₪)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>

          <div v-else-if="form.listingType === 'giveaway'" class="alert alert-info mb-3">
            <i class="bi bi-gift me-2"></i>
            {{ $t('listing.giveawayNote') }}
          </div>

          <!-- Photos Upload -->
          <div class="mb-3">
            <label class="form-label fw-semibold">
              <i class="bi bi-images me-2"></i>
              {{ $t('listing.photos') }}
            </label>
            <div class="photo-upload-section">
              <input 
                ref="photoInput"
                type="file" 
                @change="handlePhotoUpload"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                class="d-none"
              />
              <button 
                type="button" 
                class="btn btn-outline-primary w-100"
                @click="photoInput?.click()"
                :disabled="uploadingPhotos"
              >
                <i class="bi bi-camera me-2"></i>
                {{ uploadingPhotos ? $t('listing.uploading') : $t('listing.addPhotos') }}
              </button>
              <small class="text-muted d-block mt-1">
                <i class="bi bi-info-circle me-1"></i>
                {{ $t('listing.photoUploadInfo') }}
              </small>
              
              <!-- Photo Preview Grid -->
              <div v-if="form.photos.length > 0" class="photo-preview-grid mt-3">
                <div 
                  v-for="(photo, index) in form.photos" 
                  :key="index"
                  class="photo-preview-item"
                >
                  <img :src="photo.preview || photo.url" :alt="`Photo ${index + 1}`" class="photo-thumbnail" />
                  <button 
                    type="button" 
                    class="btn btn-sm btn-danger photo-remove-btn"
                    @click="removePhoto(index)"
                    title="Remove photo"
                  >
                    <i class="bi bi-x-lg"></i>
                  </button>
                  <div v-if="index === 0" class="badge bg-primary photo-primary-badge">
                    <i class="bi bi-star-fill me-1"></i>{{ $t('listing.primary') }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="mb-3">
            <label class="form-label fw-semibold">{{ $t('listing.description') }}</label>
            <textarea 
              v-model="form.description" 
              rows="5" 
              class="form-control" 
              :placeholder="$t('listing.descriptionPlaceholder')"
            />
            <small class="text-muted">{{ form.description.length }} {{ $t('listing.characters') }}</small>
          </div>
        </div>
        <div class="modal-footer border-top">
          <button 
            class="btn btn-outline-secondary" 
            @click="close"
            :disabled="submitting"
          >
            <i class="bi bi-x-lg me-1"></i>{{ $t('listing.cancel') }}
          </button>
          <button 
            class="btn btn-primary" 
            @click="submit"
            :disabled="submitting"
          >
            <span v-if="submitting" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            <i v-else class="bi bi-check-lg me-1"></i>
            {{ submitting ? (listing ? $t('listing.saving') : $t('listing.creating')) : (listing ? $t('listing.saveChanges') : $t('listing.createListing')) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.modal-dialog {
  max-width: 800px;
}

.modal-content {
  border: none;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  border-radius: 0.75rem;
}

.modal-header {
  background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
  color: white;
  border-radius: 0.75rem 0.75rem 0 0;
  padding: 1.25rem 1.5rem;
}

.modal-header .btn-close {
  filter: invert(1);
  opacity: 0.8;
}

.modal-header .btn-close:hover {
  opacity: 1;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
}

/* Listing type choice buttons */
.listing-type-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.listing-type-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 2px solid #dee2e6;
  border-radius: 0.5rem;
  background: #fff;
  color: #6c757d;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.listing-type-btn:hover {
  border-color: #0d6efd;
  color: #0d6efd;
  background: rgba(13, 110, 253, 0.05);
}

.listing-type-btn.active {
  border-color: #0d6efd;
  background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
  color: white;
}

.listing-type-btn i {
  font-size: 1.1em;
}

.form-label {
  color: #495057;
  margin-bottom: 0.5rem;
}

.form-control:focus,
.form-select:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}

/* Tag Input - tags inside the field */
.tag-input-wrapper {
  display: block;
  min-height: calc(1.5em + 1rem + 2px);
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  color: #212529;
  background-color: #fff;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.tag-input-wrapper:hover {
  border-color: #adb5bd;
}

.tag-input-wrapper.tag-input-focused {
  border-color: #0d6efd;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}

.tag-input-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  min-height: 1.5em;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2em 0.5em;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
  border-radius: 0.35rem;
  white-space: nowrap;
}

.tag-pill-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1em;
  height: 1.1em;
  padding: 0;
  margin-left: 0.15rem;
  background: rgba(255, 255, 255, 0.25);
  border: none;
  border-radius: 50%;
  color: inherit;
  font-size: 0.9em;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s;
}

.tag-pill-remove:hover {
  background: rgba(255, 255, 255, 0.4);
}

.tag-input-field {
  flex: 1;
  min-width: 100px;
  padding: 0.125rem 0;
  border: none;
  outline: none;
  font-size: inherit;
  font-family: inherit;
  background: transparent;
}

.tag-input-field::placeholder {
  color: #6c757d;
}

.tag-dropdown-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: 0.25rem;
  background: transparent;
  border: none;
  color: #6c757d;
  cursor: pointer;
  border-radius: 0.25rem;
  flex-shrink: 0;
}

.tag-dropdown-btn:hover {
  color: #0d6efd;
  background: rgba(13, 110, 253, 0.08);
}

.tag-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 2px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1050;
}

.tag-dropdown-empty {
  padding: 0.75rem;
  color: #6c757d;
  font-size: 0.875rem;
}

.tag-suggestion-item {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  text-align: left;
  border: none;
  background: transparent;
  font-size: 0.9375rem;
  color: #212529;
  cursor: pointer;
  transition: background 0.15s;
}

.tag-suggestion-item:hover {
  background: #f8f9fa;
}

.tag-suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tag-suggestion-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-suggestion-add-prefix {
  display: inline-block;
  width: 1rem;
  font-weight: 800;
  color: #0d6efd;
}

.tag-suggestion-plus {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #0d6efd;
  color: #fff;
  font-weight: 800;
  line-height: 1;
}

/* Location: clickable geo icon */
.location-icon-clickable {
  cursor: pointer;
}
.location-icon-clickable:hover {
  background-color: #e9ecef;
}

/* Location Suggestions */
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

.suggestion-item i {
  color: #4285F4;
  margin-top: 0.125rem;
}

/* Photo Upload */
.photo-upload-section {
  border: 2px dashed #dee2e6;
  border-radius: 0.5rem;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s ease;
}

.photo-upload-section:hover {
  border-color: #0d6efd;
  background-color: #f8f9ff;
}

.photo-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
}

.photo-preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 2px solid #dee2e6;
  transition: all 0.2s ease;
}

.photo-preview-item:hover {
  border-color: #0d6efd;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.photo-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-remove-btn {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.photo-preview-item:hover .photo-remove-btn {
  opacity: 1;
}

.photo-primary-badge {
  position: absolute;
  bottom: 0.25rem;
  left: 0.25rem;
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
}

/* Price Card */
.card.bg-light {
  background-color: #f8f9fa !important;
  border: 1px solid #e9ecef;
}

@media (max-width: 768px) {
  .modal-dialog {
    margin: 0.5rem;
  }
  
  .photo-preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
  }
}
</style>
