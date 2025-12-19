<script setup>
import { reactive, ref, watch, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../stores/ui';
import http from '../lib/http';

const { t } = useI18n();
const ui = useUiStore();

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  listing: { type: Object, default: null }, // if passed -> edit
});
const emit = defineEmits(['update:modelValue', 'submit']);

const form = reactive({
  title: '',
  category: '',
  location: '',
  latitude: null,
  longitude: null,
  address: '',
  pricePerDay: 0,
  initialPrice: 0,
  deposit: 0,
  currency: 'ILS',
  description: '',
  photos: [],
});

const cats = reactive({ list: [] });
const locs = reactive({ list: [] });
const photoInput = ref(null);
const uploadingPhotos = ref(false);
const submitting = ref(false);

// Extended category list with fallback categories (using translation keys)
const defaultCategories = [
  'Tools',
  'Electronics',
  'Games',
  'Outdoors',
  'Bicycles',
  'Cameras',
  'Toys',
  'Sea Sport',
  'Board Games',
  'Sports Equipment',
  'Furniture',
  'Appliances',
  'Musical Instruments',
  'Party Supplies',
  'Camping Gear',
  'Water Sports',
  'Winter Sports',
  'Fitness Equipment',
  'Baby Gear',
  'Pet Supplies',
  'Art Supplies',
  'Books',
  'Movies & Media',
  'Garden Tools',
  'Construction Tools',
  'Photography Equipment',
  'Drones',
  'VR Equipment',
  'Gaming Consoles',
  'Audio Equipment'
];

// Helper function to get category translation key
function getCategoryKey(category) {
  if (!category) return '';
  // Convert category name to translation key format
  // Remove spaces, special characters, and convert to lowercase
  return category
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/&/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Computed property for localized categories
const localizedCategories = computed(() => {
  return cats.list.map(cat => ({
    value: cat,
    label: t(`categories.${getCategoryKey(cat)}`, cat) // Fallback to original if translation missing
  }));
});

// Location search
const locationSearchQuery = ref('');
const locationSuggestions = ref([]);
const showingSuggestions = ref(false);
const isSelectingLocation = ref(false); // Track if user is clicking on a suggestion

watch(
  () => props.listing,
  (v) => {
    if (v) {
      Object.assign(form, {
        title: v.title || '',
        category: v.category || '',
        location: v.location || v.address || '',
        latitude: v.latitude || null,
        longitude: v.longitude || null,
        address: v.address || v.location || '',
        pricePerDay: v.pricePerDay ? (v.pricePerDay / 100) : 0, // Convert from cents
        initialPrice: v.initialPrice ? (v.initialPrice / 100) : 0,
        deposit: v.deposit ? (v.deposit / 100) : 0,
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
    title: '',
    category: '',
    location: '',
    latitude: null,
    longitude: null,
    address: '',
    pricePerDay: 0,
    initialPrice: 0,
    deposit: 0,
    currency: 'ILS',
    description: '',
    photos: [],
  });
  locationSearchQuery.value = '';
}

onMounted(async () => {
  // Use default categories only
  cats.list = [...defaultCategories].sort();
  locs.list = []; // Locations removed - using geocoding instead
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

// Photo upload functions
function handlePhotoUpload(event) {
  const files = Array.from(event.target.files || []);
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  files.forEach(file => {
    if (!validTypes.includes(file.type)) {
      ui.showToast(t('listing.invalidFileType'), 'danger');
      return;
    }
    
    if (file.size > maxSize) {
      ui.showToast(t('listing.fileTooLarge'), 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      form.photos.push({
        file: file,
        preview: e.target.result,
        url: null // Will be set after upload
      });
    };
    reader.readAsDataURL(file);
  });

  // Reset input
  if (photoInput.value) {
    photoInput.value.value = '';
  }
}

function removePhoto(index) {
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
  if (!form.title || !form.category) {
    ui.showToast(t('listing.titleAndCategoryRequired'), 'danger');
    return;
  }
  
  if (!form.location && !form.address) {
    ui.showToast(t('listing.locationRequired'), 'danger');
    return;
  }

  if (!form.pricePerDay || form.pricePerDay <= 0) {
    ui.showToast(t('listing.validPriceRequired'), 'danger');
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

    // Prepare form data - prices are already in the correct format (not in cents)
    // The listingsService will convert them to cents
    // Note: Don't include photos in initial creation - they'll be added separately
    const submitData = {
      title: form.title,
      category: form.category,
      location: form.location || form.address,
      address: form.address || form.location,
      latitude: form.latitude,
      longitude: form.longitude,
      pricePerDay: form.pricePerDay, // Keep as is - service will convert
      initialPrice: form.initialPrice || 0,
      deposit: form.deposit || 0,
      currency: form.currency,
      description: form.description,
      // photos: photoUrls, // Photos will be added after item creation
    };

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
          <button class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
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

          <!-- Category and Location Row -->
          <div class="row g-3 mb-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">
                {{ $t('listing.category') }} <span class="text-danger">*</span>
              </label>
              <select v-model="form.category" class="form-select form-select-lg">
                <option value="">{{ $t('forms.chooseCategory') }}</option>
                <option v-for="cat in localizedCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">
                {{ $t('listing.location') }} <span class="text-danger">*</span>
              </label>
              <div class="position-relative">
                <div class="input-group">
                  <span class="input-group-text">
                    <i class="bi bi-geo-alt"></i>
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
              </div>
            </div>
          </div>

          <!-- Price Fields -->
          <div class="card bg-light p-3 mb-3">
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

.form-label {
  color: #495057;
  margin-bottom: 0.5rem;
}

.form-control:focus,
.form-select:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
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
