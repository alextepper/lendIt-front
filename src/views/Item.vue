<script setup>
import { onMounted, ref, computed, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { fetchItem, fetchItemCalendar, updateAvailability, checkBookingAvailability } from '../services/itemService';
import { updateListing, fetchCategories, deleteListing, toggleListingActive } from '../services/listingsService';
import { fetchBookingCalendarData } from '../services/bookingCalendarService';
import { fetchItemReviews } from '../services/reviewsService';
import BookingCard from '../components/BookingCard.vue';
import BookingFlow from '../components/BookingFlow.vue';
import OwnerPanel from '../components/OwnerPanel.vue';
import ReviewsSection from '../components/ReviewsSection.vue';
import AvailabilityCalendar from '../components/AvailabilityCalendar.vue';
import BookingCalendar from '../components/BookingCalendar.vue';
import { Modal } from 'bootstrap';
import { getItemPhotoUrl } from '../utils/imageUtils';
import http from '../lib/http';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const ui = useUiStore();
const auth = useAuthStore();
const item = ref(null);
const loading = ref(true);
const error = ref(null);
const bookingModal = ref(null);
const ownerModal = ref(null);
const editMode = ref(false);
const saving = ref(false);
const unavailableDates = ref([]);
const availabilityData = ref({});
const updatingAvailability = ref(false);

// Booking calendar data
const bookings = ref([]);
const loadingBookings = ref(false);

// Reviews data
const reviews = ref([]);
const loadingReviews = ref(false);
const reviewsError = ref(null);

// Categories for dropdown
const categories = ref([]);

// Edit form
const editForm = reactive({
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
});

// Location search
const locationSearchQuery = ref('');
const locationSuggestions = ref([]);
const showingSuggestions = ref(false);
const isSelectingLocation = ref(false);

// Photo management
const photoInput = ref(null);
const uploadingPhotos = ref(false);
const editPhotos = ref([]); // Photos in edit mode (with id, url, position)
const currentPhotoIndex = ref(0); // For carousel
const fullscreenCarousel = ref(false); // Fullscreen carousel state

// Swipe gesture handling
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchEndX = ref(0);
const touchEndY = ref(0);
const minSwipeDistance = 50; // Minimum distance for a swipe

// Store original values for cancel
const originalItem = ref(null);

// Check if current user is the owner
const isOwner = computed(() => {
  return auth.user && item.value && auth.user.id === item.value.owner?.id;
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const id = route.params.id;
    item.value = await fetchItem(id);
    
    // Initialize edit form with current values
    editForm.title = item.value.title || '';
    editForm.category = item.value.category || '';
    editForm.location = item.value.address || item.value.location || '';
    editForm.latitude = item.value.latitude || null;
    editForm.longitude = item.value.longitude || null;
    editForm.address = item.value.address || item.value.location || '';
    editForm.pricePerDay = item.value.pricePerDay/100 || 0;
    editForm.initialPrice = item.value.initialPrice/100 || 0;
    editForm.deposit = item.value.deposit/100 || 0;
    editForm.currency = item.value.currency || 'ILS';
    editForm.description = item.value.description || '';
    
    // Initialize location search query
    locationSearchQuery.value = item.value.address || item.value.location || '';
    
    // Initialize photos for edit mode - preserve id and position
    editPhotos.value = (item.value.photos || [])
      .map(photo => {
        const photoObj = typeof photo === 'string' ? { url: photo } : photo;
        return {
          id: photoObj.id || null,
          url: photoObj.url,
          publicUrl: photoObj.publicUrl || photoObj.url,
          position: photoObj.position ?? 0,
          preview: photoObj.url,
          file: null,
          isNew: false
        };
      })
      .sort((a, b) => a.position - b.position); // Sort by position
    
    // Store original for cancel
    originalItem.value = JSON.parse(JSON.stringify(item.value));
    
    // Load unavailable dates if user is owner
    if (isOwner.value) {
      const calendarData = await fetchItemCalendar(id);
      unavailableDates.value = calendarData.unavailableDates;
      availabilityData.value = calendarData.availability || {};
      
      // Load bookings for the current month
      await loadBookings();
    }
    
    // Load reviews for the item
    await loadReviews();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || t('item.failedToLoad');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  
  // Load categories for edit mode
  try {
    categories.value = await fetchCategories();
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
});

function showBookingModal() {
  if (!auth.isAuthed) {
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  
  const modalEl = document.getElementById('bookingModal');
  if (modalEl) {
    const modal = new Modal(modalEl);
    modal.show();
  }
}

function closeBookingModal() {
  const modalEl = document.getElementById('bookingModal');
  if (modalEl) {
    const modal = Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

function showOwnerModal() {
  const modalEl = document.getElementById('ownerModal');
  if (modalEl) {
    const modal = new Modal(modalEl);
    modal.show();
  }
}

function onBookingConfirmed(bookingData) {
  // Close modal on successful booking
  const modalEl = document.getElementById('bookingModal');
  if (modalEl) {
    const modal = Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
  console.log('Booking confirmed:', bookingData);
}

function toggleEditMode() {
  if (editMode.value) {
    // If currently in edit mode, save changes
    saveChanges();
  } else {
    // Enable edit mode
    editMode.value = true;
    ui.showToast(t('item.editModeEnabled'), 'info');
  }
}

function cancelEdit() {
  // Restore original values
  editForm.title = originalItem.value.title || '';
  editForm.category = originalItem.value.category || '';
  editForm.location = originalItem.value.address || originalItem.value.location || '';
  editForm.latitude = originalItem.value.latitude || null;
  editForm.longitude = originalItem.value.longitude || null;
  editForm.address = originalItem.value.address || originalItem.value.location || '';
  editForm.pricePerDay = originalItem.value.pricePerDay/100 || 0;
  editForm.initialPrice = originalItem.value.initialPrice/100 || 0;
  editForm.deposit = originalItem.value.deposit/100 || 0;
  editForm.currency = originalItem.value.currency || 'ILS';
  editForm.description = originalItem.value.description || '';
  
  // Restore location search query
  locationSearchQuery.value = originalItem.value.address || originalItem.value.location || '';
  locationSuggestions.value = [];
  showingSuggestions.value = false;
  
  // Restore original photos
  editPhotos.value = (originalItem.value.photos || [])
    .map(photo => {
      const photoObj = typeof photo === 'string' ? { url: photo } : photo;
      return {
        id: photoObj.id || null,
        url: photoObj.url,
        publicUrl: photoObj.publicUrl || photoObj.url,
        position: photoObj.position ?? 0,
        preview: photoObj.url,
        file: null,
        isNew: false
      };
    })
    .sort((a, b) => a.position - b.position);
  
  editMode.value = false;
  ui.showToast(t('item.changesDiscarded'), 'info');
}

// Photo management functions
async function handlePhotoUpload(event) {
  const files = Array.from(event.target.files || []);
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  const maxPhotos = 10;

  for (const file of files) {
    if (editPhotos.value.length >= maxPhotos) {
      ui.showToast(t('item.maxPhotosReached', { max: maxPhotos }), 'warning');
      break;
    }
    
    if (!validTypes.includes(file.type)) {
      ui.showToast(t('item.invalidFileType'), 'danger');
      continue;
    }
    
    if (file.size > maxSize) {
      ui.showToast(t('item.fileTooLarge'), 'danger');
      continue;
    }

    // Upload immediately using single file endpoint
    uploadingPhotos.value = true;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await http.post('/uploads/image?folder=items', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      // Add to editPhotos with position
      const position = editPhotos.value.length;
      editPhotos.value.push({
        id: null, // Will be set when added to item
        url: data.url || data.publicUrl,
        publicUrl: data.publicUrl || data.url,
        position: position,
        preview: data.url || data.publicUrl,
        file: file,
        isNew: true
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      ui.showToast(error?.response?.data?.message || t('item.photoUploadFailed'), 'danger');
    } finally {
      uploadingPhotos.value = false;
    }
  }

  // Reset input
  if (photoInput.value) {
    photoInput.value.value = '';
  }
}

async function removePhoto(photoIndex) {
  const photo = editPhotos.value[photoIndex];
  if (!photo) return;

  // If photo is already saved (has id), delete from backend
  if (photo.id && !photo.isNew) {
    if (!confirm(t('item.deletePhotoConfirm'))) {
      return;
    }
    
    try {
      await http.delete(`/items/${item.value.id}/photos/${photo.id}`);
      ui.showToast(t('item.photoDeleted'), 'success');
    } catch (error) {
      console.error('Failed to delete photo:', error);
      ui.showToast(error?.response?.data?.message || t('item.photoDeleteFailed'), 'danger');
      return; // Don't remove from UI if deletion failed
    }
  }

  // Remove from local array
  editPhotos.value.splice(photoIndex, 1);
  
  // Reorder positions
  editPhotos.value.forEach((p, index) => {
    p.position = index;
  });
}

async function setMainPhoto(photoIndex) {
  const photo = editPhotos.value[photoIndex];
  if (!photo) return;

  // If photo is already saved (has id), use API
  if (photo.id && !photo.isNew) {
    try {
      await http.patch(`/items/${item.value.id}/photos/${photo.id}/main`);
      
      // Swap positions: selected photo becomes 0, current main (position 0) gets selected photo's position
      const currentMainIndex = editPhotos.value.findIndex(p => p.position === 0 && p.id !== photo.id);
      if (currentMainIndex !== -1) {
        const currentMain = editPhotos.value[currentMainIndex];
        currentMain.position = photo.position;
      }
      photo.position = 0;
      
      // Re-sort by position
      editPhotos.value.sort((a, b) => a.position - b.position);
      
      ui.showToast(t('item.mainPhotoUpdated'), 'success');
    } catch (error) {
      console.error('Failed to set main photo:', error);
      ui.showToast(error?.response?.data?.message || t('item.mainPhotoUpdateFailed'), 'danger');
    }
  } else {
    // For new photos, just reorder locally
    const currentMainIndex = editPhotos.value.findIndex(p => p.position === 0);
    if (currentMainIndex !== -1) {
      editPhotos.value[currentMainIndex].position = photo.position;
    }
    photo.position = 0;
    editPhotos.value.sort((a, b) => a.position - b.position);
    ui.showToast(t('item.mainPhotoWillBeSet'), 'info');
  }
}

async function addPhotosToItem(itemId) {
  const newPhotos = editPhotos.value.filter(photo => photo.isNew);
  
  if (newPhotos.length === 0) {
    return;
  }

  try {
    // Add each new photo to the item with correct position
    for (const photo of newPhotos) {
      const response = await http.post(`/items/${itemId}/photos`, {
        url: photo.url || photo.publicUrl,
        position: photo.position
      });
      
      // Update photo with id from response
      if (response.data && response.data.id) {
        photo.id = response.data.id;
        photo.isNew = false;
      }
    }
  } catch (error) {
    console.error('Error adding photos to item:', error);
    throw error;
  }
}

async function saveChanges() {
  // Validate
  if (!editForm.title?.trim()) {
    ui.showToast(t('item.titleRequired'), 'warning');
    return;
  }
  if (!editForm.category) {
    ui.showToast(t('item.categoryRequired'), 'warning');
    return;
  }
  if (!editForm.location && !editForm.address) {
    ui.showToast(t('item.locationRequired'), 'warning');
    return;
  }
  if (!editForm.pricePerDay || editForm.pricePerDay < 0) {
    ui.showToast(t('item.validPriceRequired'), 'warning');
    return;
  }
  
  saving.value = true;
  try {
    // Update listing data
    const payload = {
      title: editForm.title,
      category: editForm.category,
      location: editForm.location || editForm.address,
      address: editForm.address || editForm.location,
      latitude: editForm.latitude,
      longitude: editForm.longitude,
      pricePerDay: editForm.pricePerDay,
      initialPrice: editForm.initialPrice,
      deposit: editForm.deposit,
      currency: editForm.currency,
      description: editForm.description,
    };
    
    await updateListing(item.value.id, payload);
    
    // Add new photos to item (photos are already uploaded in handlePhotoUpload)
    try {
      await addPhotosToItem(item.value.id);
    } catch (error) {
      console.error('Failed to add photos:', error);
      ui.showToast(t('item.listingUpdatedButPhotosFailed'), 'warning');
    }
    
    // Reload item to get updated data including photos
    await load();
    
    editMode.value = false;
    ui.showToast(t('item.listingUpdated'), 'success');
  } catch (e) {
    console.error('Failed to update listing:', e);
    ui.showToast(e?.response?.data?.message || t('item.listingUpdateFailed'), 'danger');
  } finally {
    saving.value = false;
  }
}

const deleting = ref(false);
const togglingActive = ref(false);

async function toggleActive() {
  if (!item.value) return;
  
  // Default to true if isActive field doesn't exist (assume active by default)
  const currentActive = item.value.isActive !== undefined ? item.value.isActive : (item.value.active !== undefined ? item.value.active : true);
  const newActiveStatus = !currentActive;
  const action = newActiveStatus ? 'activate' : 'deactivate';
  
  if (!confirm(`Are you sure you want to ${action} this listing?`)) {
    return;
  }
  
  togglingActive.value = true;
  try {
    const updated = await toggleListingActive(item.value.id, newActiveStatus);
    item.value = { ...item.value, ...updated, isActive: newActiveStatus, active: newActiveStatus };
    originalItem.value = JSON.parse(JSON.stringify(item.value));
    ui.showToast(t('item.listingStatusUpdated', { status: newActiveStatus ? t('item.activate') : t('item.deactivate') }), 'success');
  } catch (e) {
    console.error('Failed to toggle listing status:', e);
    ui.showToast(e?.response?.data?.message || t('item.listingStatusUpdateFailed'), 'danger');
  } finally {
    togglingActive.value = false;
  }
}

async function deleteItem() {
  if (!item.value) return;
  
  if (!confirm(t('item.deleteConfirm'))) {
    return;
  }
  
  deleting.value = true;
  try {
    await deleteListing(item.value.id);
    ui.showToast(t('item.listingDeleted'), 'success');
    // Redirect to user's listings or home page
    router.push({ name: 'dashboard' });
  } catch (e) {
    console.error('Failed to delete listing:', e);
    ui.showToast(e?.response?.data?.message || t('item.listingDeleteFailed'), 'danger');
  } finally {
    deleting.value = false;
  }
}

async function handleAvailabilityUpdate(payload) {
  updatingAvailability.value = true;
  try {
    await updateAvailability(item.value.id, payload);
    
    // Update local unavailable dates
    if (payload.action === 'block') {
      // Add new blocked dates
      unavailableDates.value = [...new Set([...unavailableDates.value, ...payload.dates])];
      ui.showToast(`Blocked ${payload.dates.length} date(s)`, 'success');
    } else {
      // Remove unblocked dates
      unavailableDates.value = unavailableDates.value.filter(d => !payload.dates.includes(d));
      ui.showToast(`Unblocked ${payload.dates.length} date(s)`, 'success');
    }
  } catch (e) {
    console.error('Failed to update availability:', e);
    ui.showToast(e?.response?.data?.message || 'Failed to update availability', 'danger');
  } finally {
    updatingAvailability.value = false;
  }
}

async function loadBookings(month = null) {
  if (!isOwner.value) return;
  
  loadingBookings.value = true;
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    try {
      // Try to fetch real data from backend
      const response = await fetchBookingCalendarData(item.value.id, targetMonth);
      console.log('Backend response:', response);
      bookings.value = response.bookings || [];
    } catch (backendError) {
      console.warn('Backend not ready, using mock data:', backendError);
      
      // Fallback to mock data when backend is not ready
      bookings.value = [
        {
          id: '1',
          startDate: '2024-01-15',
          endDate: '2024-01-17',
          customerName: 'John Doe',
          status: 'CONFIRMED',
          totalAmount: 15000
        },
        {
          id: '2',
          startDate: '2024-01-20',
          endDate: '2024-01-22',
          customerName: 'Jane Smith',
          status: 'PENDING',
          totalAmount: 12000
        }
      ];
    }
  } catch (e) {
    console.error('Failed to load bookings:', e);
    ui.showToast('Failed to load bookings', 'danger');
  } finally {
    loadingBookings.value = false;
  }
}

function handleBookingRefresh(params) {
  loadBookings(params.month);
}

function handleViewBooking(data) {
  console.log('View booking:', data);
  // Implement booking details modal or navigation
  ui.showToast(`Viewing booking for ${data.date.toLocaleDateString()}`, 'info');
}

async function loadReviews() {
  if (!item.value?.id) return;
  
  console.log('Loading reviews for item:', item.value.id);
  loadingReviews.value = true;
  reviewsError.value = null;
  
  try {
    const reviewsData = await fetchItemReviews(item.value.id);
    console.log('Reviews data received:', reviewsData);
    reviews.value = reviewsData;
  } catch (error) {
    console.error('Failed to load reviews:', error);
    reviewsError.value = error?.response?.data?.message || 'Failed to load reviews';
  } finally {
    loadingReviews.value = false;
  }
}

// Location search functions
let geocodeTimeout = null;
let blurTimeout = null;

async function searchLocationQuery(query) {
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
    return;
  }

  isSelectingLocation.value = true;
  locationSearchQuery.value = suggestion.display_name || '';
  locationSuggestions.value = [];
  showingSuggestions.value = false;
  
  editForm.location = suggestion.display_name;
  editForm.address = suggestion.display_name;
  editForm.latitude = lat;
  editForm.longitude = lng;

  // Clear any pending blur timeout
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }

  // Reset flag after a short delay
  window.setTimeout(() => {
    isSelectingLocation.value = false;
  }, 100);
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

function formatPrice(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount / 100)
}

// Computed property for display photos
const displayPhotos = computed(() => {
  return editMode.value ? editPhotos.value : (item.value?.photos || []);
});

// Helper function to get photo URL for carousel
function getCarouselPhotoUrl(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    return getItemPhotoUrl(photo);
  }
  // Handle photo object
  const url = photo.preview || photo.url || photo.publicUrl;
  return url ? getItemPhotoUrl(url) : null;
}

// Carousel navigation functions
function nextPhoto() {
  if (displayPhotos.value.length > 0) {
    currentPhotoIndex.value = (currentPhotoIndex.value + 1) % displayPhotos.value.length;
  }
}

function previousPhoto() {
  if (displayPhotos.value.length > 0) {
    currentPhotoIndex.value = (currentPhotoIndex.value - 1 + displayPhotos.value.length) % displayPhotos.value.length;
  }
}

// Reset carousel when photos change or mode changes
watch(() => [displayPhotos.value.length, editMode.value], () => {
  if (currentPhotoIndex.value >= displayPhotos.value.length) {
    currentPhotoIndex.value = 0;
  }
});

// Swipe gesture handlers
function handleTouchStart(e) {
  touchStartX.value = e.touches[0].clientX;
  touchStartY.value = e.touches[0].clientY;
}

function handleTouchMove(e) {
  touchEndX.value = e.touches[0].clientX;
  touchEndY.value = e.touches[0].clientY;
}

function handleTouchEnd() {
  if (!touchStartX.value || !touchEndX.value) return;
  
  const distanceX = touchStartX.value - touchEndX.value;
  const distanceY = touchStartY.value - touchEndY.value;
  
  // Check if it's a horizontal swipe (more horizontal than vertical)
  if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
    if (distanceX > 0) {
      // Swipe left - next photo
      nextPhoto();
    } else {
      // Swipe right - previous photo
      previousPhoto();
    }
  }
  
  // Reset
  touchStartX.value = 0;
  touchStartY.value = 0;
  touchEndX.value = 0;
  touchEndY.value = 0;
}

// Fullscreen carousel functions
function openFullscreenCarousel() {
  fullscreenCarousel.value = true;
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeFullscreenCarousel() {
  fullscreenCarousel.value = false;
  document.body.style.overflow = ''; // Restore scrolling
}

// Keyboard navigation for fullscreen
function handleFullscreenKeydown(e) {
  if (!fullscreenCarousel.value) return;
  
  if (e.key === 'Escape') {
    closeFullscreenCarousel();
  } else if (e.key === 'ArrowLeft') {
    previousPhoto();
  } else if (e.key === 'ArrowRight') {
    nextPhoto();
  }
}

// Add keyboard listener when fullscreen is open
watch(fullscreenCarousel, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleFullscreenKeydown);
  } else {
    window.removeEventListener('keydown', handleFullscreenKeydown);
  }
});
</script>

<template>
  <div class="item-page">
    <!-- Breadcrumb -->
    <!-- <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb small mb-0">
        <li class="breadcrumb-item"><router-link to="/">{{ $t('item.home') }}</router-link></li>
        <li class="breadcrumb-item">
          <router-link :to="{ name: 'search', query: { category: item?.category } }">{{
            item?.category || $t('item.items')
          }}</router-link>
        </li>
        <li class="breadcrumb-item active" aria-current="page">{{ item?.title || $t('item.title') }}</li>
      </ol>
    </nav> -->

    <!-- Error State -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
      <div class="small text-secondary mt-2">{{ $t('item.loading') }}</div>
    </div>

    <!-- Item Content -->
    <div v-else-if="item">
      <!-- Item Header - Always at top -->
      <div class="item-header mb-4" :class="{ 'edit-mode': editMode }">
        <div class="d-flex justify-content-between align-items-start gap-4">
          <!-- Left Content -->
          <div class="flex-grow-1">
            <!-- Title with Rating (View Mode) -->
            <div v-if="!editMode" class="item-title-section mb-2">
              <div class="d-flex align-items-center gap-3 flex-wrap">
                <!-- Thumbnail (Owners Only) -->
                <div v-if="isOwner" class="item-thumbnail">
                <img 
                  v-if="item.photos && item.photos.length > 0"
                  :src="getItemPhotoUrl(item.photos)" 
                  :alt="item.title"
                  class="thumbnail-image"
                />
                <div v-else class="thumbnail-placeholder">
                  <i class="bi bi-image"></i>
                </div>
              </div>
                <!-- Title -->
              <h1 class="item-title mb-0">{{ item.title }}</h1>
                <!-- Rating -->
                <div class="item-rating d-flex align-items-center gap-1">
                  <i class="bi bi-star-fill text-warning"></i>
                  <span class="fw-semibold">{{ item.rating || '0.0' }}</span>
                  <span class="text-muted small">({{ item.reviews_count || 0 }})</span>
            </div>
                <!-- Category Badge -->
                <span class="badge bg-primary">{{ item.category }}</span>
              </div>
            </div>
            
            <!-- Title Input (Edit Mode) -->
            <div v-else class="mb-3">
              <label class="form-label small fw-bold">{{ $t('item.title') }}</label>
              <input 
                v-model="editForm.title" 
                type="text" 
                class="form-control form-control-lg" 
                :placeholder="$t('item.itemTitle')"
                :disabled="saving"
              />
            </div>

            <!-- Address (View Mode) -->
            <div v-if="!editMode" class="item-address mb-2">
              <div class="d-flex align-items-center gap-1 text-muted">
                <i class="bi bi-geo-alt"></i>
                <span>{{ item.location || item.address }}</span>
              </div>
            </div>

            <!-- Prices (View Mode) -->
            <div v-if="!editMode" class="item-prices d-flex flex-wrap align-items-center gap-3">
              <div class="price-main">
                <span class="fw-bold fs-5 text-primary">{{ formatPrice(item.pricePerDay) }}</span>
                <span class="text-muted ms-1">{{ $t('item.perDay') }}</span>
              </div>
              <template v-if="item.initialPrice">
                <span class="text-muted">·</span>
                <div class="price-secondary">
                  <span class="small text-muted">{{ $t('item.initial') }}</span>
                  <span class="fw-semibold ms-1">{{ formatPrice(item.initialPrice) }}</span>
                </div>
              </template>
              <template v-if="item.deposit">
                <span class="text-muted">·</span>
                <div class="price-secondary">
                  <span class="small text-muted">{{ $t('item.deposit') }}</span>
                  <span class="fw-semibold ms-1">{{ formatPrice(item.deposit) }}</span>
                </div>
              </template>
            </div>
            <div v-else class="row g-3">
              <div class="col-md-6">
                <label class="form-label small fw-bold">{{ $t('item.category') }}</label>
                <select v-model="editForm.category" class="form-select" :disabled="saving">
                  <option value="">{{ $t('item.choose') }}</option>
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-bold">{{ $t('item.location') }} <span class="text-danger">*</span></label>
                <div class="position-relative">
                  <div class="input-group">
                    <span class="input-group-text">
                      <i class="bi bi-geo-alt"></i>
                    </span>
                    <input
                      v-model="locationSearchQuery"
                      type="text"
                      class="form-control"
                      :placeholder="$t('search.locationSearchPlaceholder')"
                      @input="searchLocationQuery(locationSearchQuery)"
                      @focus="showingSuggestions = locationSuggestions.length > 0"
                      @blur="handleLocationBlur"
                      @keyup.enter.prevent="locationSuggestions.length > 0 && selectLocation(locationSuggestions[0])"
                      :disabled="saving"
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
                        <div class="fw-semibold small">{{ suggestion.display_name?.split(',')[0] || $t('item.location') }}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">{{ suggestion.display_name || '' }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-2">
                <label class="form-label small fw-bold">{{ $t('item.price') }}</label>
                <input 
                  v-model.number="editForm.pricePerDay" 
                  type="number" 
                  min="0" 
                  step="1" 
                  class="form-control"
                  :disabled="saving"
                />
              </div>
              <div class="col-md-2">
                <label class="form-label small fw-bold">{{ $t('item.initial') }}</label>
                <input 
                  v-model.number="editForm.initialPrice" 
                  type="number" 
                  min="0" 
                  step="1" 
                  class="form-control"
                  :disabled="saving"
                  placeholder="0"
                />
              </div>
              <div class="col-md-2">
                <label class="form-label small fw-bold">{{ $t('item.deposit') }}</label>
                <input 
                  v-model.number="editForm.deposit" 
                  type="number" 
                  min="0" 
                  step="1" 
                  class="form-control"
                  :disabled="saving"
                  placeholder="0"
                />
              </div>
              <div class="col-12 col-md-12">
                <label class="form-label small fw-bold">{{ $t('item.currency') }}</label>
                <select v-model="editForm.currency" class="form-select" :disabled="saving">
                  <option value="ILS">ILS (₪)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Action Buttons - Top Right Corner -->
          <div class="d-flex flex-column gap-2 item-actions">
            <!-- Owner Actions -->
            <template v-if="isOwner">
              <button
                class="btn btn-sm"
                :class="editMode ? 'btn-success' : 'btn-primary'"
                @click="toggleEditMode"
                title="Toggle edit mode"
                :disabled="saving"
              >
                <span v-if="saving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                <i v-else class="bi" :class="editMode ? 'bi-check-lg' : 'bi-pencil'"></i>
                <span class="d-none d-lg-inline ms-1">{{ saving ? $t('item.saving') : (editMode ? $t('item.save') : $t('item.edit')) }}</span>
              </button>
              <button
                v-if="editMode"
                class="btn btn-sm btn-outline-secondary"
                @click="cancelEdit"
                title="Cancel editing"
                :disabled="saving"
              >
                <i class="bi bi-x-lg"></i>
                <span class="d-none d-lg-inline ms-1">{{ $t('item.cancel') }}</span>
              </button>
              <button
                v-if="editMode"
                class="btn btn-sm"
                :class="(item?.isActive !== false && item?.active !== false) ? 'btn-outline-warning' : 'btn-outline-success'"
                @click="toggleActive"
                :title="(item?.isActive !== false && item?.active !== false) ? $t('item.deactivateListing') : $t('item.activateListing')"
                :disabled="saving || togglingActive"
              >
                <span v-if="togglingActive" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                <i v-else class="bi" :class="(item?.isActive !== false && item?.active !== false) ? 'bi-eye-slash' : 'bi-eye'"></i>
                <span class="d-none d-lg-inline ms-1">{{ (item?.isActive !== false && item?.active !== false) ? $t('item.deactivate') : $t('item.activate') }}</span>
              </button>
              <button
                v-if="editMode"
                class="btn btn-sm btn-outline-danger"
                @click="deleteItem"
                title="Delete listing"
                :disabled="saving || deleting"
              >
                <span v-if="deleting" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                <i v-else class="bi bi-trash"></i>
                <span class="d-none d-lg-inline ms-1">{{ $t('item.delete') }}</span>
              </button>
            </template>
            
            <!-- Non-Owner Actions -->
            <template v-else>
              <!-- TODO: Booking functionality - Coming soon -->
              <button
                class="btn btn-sm btn-primary"
                @click="showBookingModal"
                title="Book this item"
              >
                <i class="bi bi-calendar-check"></i>
                <span class="d-none d-lg-inline ms-1">{{ $t('item.bookNow') }}</span>
              </button>
              
              <button
                class="btn btn-sm btn-primary"
                @click="showOwnerModal"
                title="Message owner"
              >
                <i class="bi bi-chat-dots"></i>
                <span class="d-none d-lg-inline ms-1">{{ $t('item.message') }}</span>
              </button>
              <!-- <button
                class="btn btn-sm btn-outline-danger"
                type="button"
                title="Report"
              >
                <i class="bi bi-flag"></i>
                <span class="d-none d-lg-inline ms-1">{{ $t('item.report') }}</span>
              </button> -->
            </template>
            
            <!-- Share button (always visible) -->
            <button
              class="btn btn-outline-secondary btn-sm"
              @click="navigator.clipboard.writeText(location.href)"
              title="Share"
            >
              <i class="bi bi-share"></i>
              <span class="d-none d-lg-inline ms-1">{{ $t('item.share') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="row g-4">
        <!-- Main Content Column -->
        <div class="col-lg-8">
          <!-- Image Carousel (Non-Owners or Owners in Edit Mode) -->
          <div v-if="!isOwner || editMode" class="image-carousel-container mb-4">
            <div v-if="displayPhotos?.length > 0" class="image-carousel">
              <!-- Main Image Display -->
              <div 
                class="carousel-main"
                @touchstart="handleTouchStart"
                @touchmove="handleTouchMove"
                @touchend="handleTouchEnd"
              >
                <div class="ratio ratio-16x9 bg-light rounded carousel-image-wrapper">
                  <transition name="carousel-fade" mode="out-in">
                    <img
                      :key="currentPhotoIndex"
                      :src="getCarouselPhotoUrl(displayPhotos[currentPhotoIndex])"
                      class="w-100 h-100 object-fit-cover rounded carousel-image-clickable carousel-image"
                      :alt="`${item.title} - Photo ${currentPhotoIndex + 1}`"
                      @click="openFullscreenCarousel"
                      style="cursor: pointer;"
                    />
                  </transition>
                </div>
                <!-- Navigation Arrows (only if more than 1 photo) -->
                <template v-if="displayPhotos.length > 1">
                  <button
                    class="carousel-btn carousel-btn-prev"
                    @click="previousPhoto"
                    :aria-label="$t('item.previousPhoto')"
                  >
                    <i class="bi bi-chevron-left"></i>
                  </button>
                  <button
                    class="carousel-btn carousel-btn-next"
                    @click="nextPhoto"
                    :aria-label="$t('item.nextPhoto')"
                  >
                    <i class="bi bi-chevron-right"></i>
                  </button>
                  <!-- Photo Counter -->
                  <div class="carousel-counter">
                    {{ currentPhotoIndex + 1 }} / {{ displayPhotos.length }}
                  </div>
                </template>
              </div>
              <!-- Thumbnail Strip (only if more than 1 photo) -->
              <div v-if="displayPhotos.length > 1" class="carousel-thumbnails">
                <button
                  v-for="(photo, index) in displayPhotos"
                  :key="index"
                  class="thumbnail-btn"
                  :class="{ active: index === currentPhotoIndex }"
                  @click="currentPhotoIndex = index"
                  :aria-label="$t('item.viewPhoto', { index: index + 1 })"
                >
                  <img
                    :src="getCarouselPhotoUrl(photo)"
                    :alt="`Thumbnail ${index + 1}`"
                    class="thumbnail-img"
                  />
                </button>
              </div>
            </div>
            <div v-else class="no-photos-placeholder">
              <div class="ratio ratio-16x9 bg-light rounded d-flex align-items-center justify-content-center">
                <div class="text-center text-muted">
                  <i class="bi bi-image display-4 d-block mb-2"></i>
                  <p class="mb-0">{{ $t('item.noPhotosAvailable') }}</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Photo Management (Edit Mode Only) -->
          <div v-if="editMode && isOwner" class="card p-3 p-md-4 mt-3 mt-md-4">
            <h2 class="h5 mb-3">
              <i class="bi bi-images me-2"></i>
              {{ $t('item.managePhotos') }}
            </h2>
            
            <input 
              ref="photoInput"
              type="file" 
              @change="handlePhotoUpload"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              class="d-none"
            />
            
            <div class="mb-3">
              <button 
                type="button" 
                class="btn btn-outline-primary w-100"
                @click="photoInput?.click()"
                :disabled="uploadingPhotos || editPhotos.length >= 10"
              >
                <i class="bi bi-camera me-2"></i>
                {{ uploadingPhotos ? $t('item.uploading') : $t('item.addPhotos') }}
              </button>
              <small class="text-muted d-block mt-2">
                <i class="bi bi-info-circle me-1"></i>
                {{ $t('item.photoUploadInfo') }}
              </small>
            </div>
            
            <!-- Photo Preview Grid -->
            <div v-if="editPhotos.length > 0" class="photo-preview-grid">
              <div 
                v-for="(photo, index) in editPhotos" 
                :key="photo.id || index"
                class="photo-preview-item"
                :class="{ 'is-primary': photo.position === 0 }"
              >
                <img 
                  :src="photo.preview || (photo.url ? getItemPhotoUrl(photo.url) : null) || (photo.publicUrl ? getItemPhotoUrl(photo.publicUrl) : null)" 
                  :alt="`Photo ${index + 1}`" 
                  class="photo-thumbnail" 
                />
                <button 
                  type="button" 
                  class="btn btn-sm btn-danger photo-remove-btn"
                  @click="removePhoto(index)"
                  title="Remove photo"
                  :disabled="saving"
                >
                  <i class="bi bi-x-lg"></i>
                </button>
                <button
                  v-if="photo.position !== 0"
                  type="button"
                  class="btn btn-sm btn-primary photo-set-main-btn"
                  @click="setMainPhoto(index)"
                  title="Set as main photo"
                  :disabled="saving"
                >
                  <i class="bi bi-star"></i>
                </button>
                <div v-if="photo.position === 0" class="badge bg-primary photo-primary-badge">
                  <i class="bi bi-star-fill me-1"></i>{{ $t('item.primary') }}
                </div>
                <div v-if="photo.isNew" class="badge bg-success photo-new-badge">
                  <i class="bi bi-plus-circle me-1"></i>{{ $t('item.new') }}
                </div>
              </div>
            </div>
            <div v-else class="text-center text-muted py-4">
              <i class="bi bi-image fs-1 d-block mb-2"></i>
              <p class="mb-0">{{ $t('item.noPhotosYet') }}</p>
            </div>
          </div>

          <!-- Description Card -->
          <div class="card p-3 p-md-4">
            <h2 class="h5 mb-3">{{ $t('item.aboutThisItem') }}</h2>
            <p v-if="!editMode" class="mb-0 text-muted">{{ item.description }}</p>
            <div v-else>
              <label class="form-label small fw-bold">{{ $t('item.description') }}</label>
              <textarea 
                v-model="editForm.description" 
                class="form-control" 
                rows="6" 
                :placeholder="$t('item.description')"
                :disabled="saving"
              ></textarea>
            </div>
          </div>

          <!-- Availability Calendar (Owner Only) -->
          <!-- <div v-if="isOwner" class="mt-3 mt-md-4">
            <AvailabilityCalendar
              :item-id="item.id"
              :unavailable-dates="unavailableDates"
              :availability-data="availabilityData"
              :disabled="updatingAvailability"
              @update="handleAvailabilityUpdate"
            />
          </div> -->

          <!-- Booking Calendar (Owner Only) -->
          <div v-if="isOwner" class="mt-3 mt-md-4">
            <BookingCalendar
              :item-id="item.id"
              :item="item"
              :bookings="bookings"
              :loading="loadingBookings"
              @refresh="handleBookingRefresh"
              @view-booking="handleViewBooking"
            />
          </div>
        </div>

        <!-- Sidebar Column -->
        <div class="col-lg-4">
          <div class="sidebar-content">
            <!-- Reviews Section -->
            <ReviewsSection 
              :item="item" 
              :can-review="!isOwner"
              :reviews="reviews"
              :loading="loadingReviews"
              :error="reviewsError"
              @refresh="loadReviews"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Modal -->
    <div class="modal fade" id="bookingModal" tabindex="-1" aria-labelledby="bookingModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="bookingModalLabel">Book this item</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <BookingFlow 
              v-if="item"
              :item="item"
              @close="closeBookingModal"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Owner Modal -->
    <div class="modal fade" id="ownerModal" tabindex="-1" aria-labelledby="ownerModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="ownerModalLabel">Owner Information</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-0">
            <OwnerPanel v-if="item?.owner" :owner="item.owner" :item-id="item.id" />
          </div>
        </div>
      </div>
    </div>

    <!-- Fullscreen Carousel Modal -->
    <div 
      v-if="fullscreenCarousel && displayPhotos?.length > 0" 
      class="fullscreen-carousel-modal"
      @click.self="closeFullscreenCarousel"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <div class="fullscreen-carousel-content">
        <!-- Close Button -->
        <button
          class="fullscreen-close-btn"
          @click="closeFullscreenCarousel"
          :aria-label="$t('item.closeFullscreen')"
        >
          <i class="bi bi-x-lg"></i>
        </button>
        
        <!-- Main Image -->
        <div class="fullscreen-image-container">
          <img
            :src="getCarouselPhotoUrl(displayPhotos[currentPhotoIndex])"
            :alt="`${item.title} - Photo ${currentPhotoIndex + 1}`"
            class="fullscreen-image"
          />
        </div>
        
        <!-- Navigation Arrows -->
        <template v-if="displayPhotos.length > 1">
          <button
            class="fullscreen-nav-btn fullscreen-nav-prev"
            @click="previousPhoto"
            :aria-label="$t('item.previousPhoto')"
          >
            <i class="bi bi-chevron-left"></i>
          </button>
          <button
            class="fullscreen-nav-btn fullscreen-nav-next"
            @click="nextPhoto"
            :aria-label="$t('item.nextPhoto')"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
          
          <!-- Photo Counter -->
          <div class="fullscreen-counter">
            {{ currentPhotoIndex + 1 }} / {{ displayPhotos.length }}
          </div>
          
          <!-- Thumbnail Strip -->
          <div class="fullscreen-thumbnails">
            <button
              v-for="(photo, index) in displayPhotos"
              :key="index"
              class="fullscreen-thumbnail-btn"
              :class="{ active: index === currentPhotoIndex }"
              @click="currentPhotoIndex = index"
              :aria-label="$t('item.viewPhoto', { index: index + 1 })"
            >
              <img
                :src="getCarouselPhotoUrl(photo)"
                :alt="`Thumbnail ${index + 1}`"
                class="fullscreen-thumbnail-img"
              />
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-page {
  max-width: 1400px;
  margin: 0 auto;
}

.item-header {
  padding: 1.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
  background: #fff;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.item-title-section {
  margin-bottom: 0.75rem;
}

.item-title {
  font-size: 2rem;
  font-weight: 700;
  color: #212529;
  margin: 0;
  line-height: 1.3;
}

.item-rating {
  padding: 0.25rem 0.75rem;
  background: #fff3cd;
  border-radius: 1rem;
  font-size: 0.95rem;
}

.item-address {
  font-size: 1rem;
  color: #6c757d;
}

.item-prices {
  margin-top: 0.5rem;
}

.price-main {
  font-size: 1.25rem;
}

.price-secondary {
  font-size: 0.95rem;
}

/* Item Thumbnail for Owners */
.item-thumbnail {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 3px solid #fff;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
  font-size: 24px;
}

.item-meta {
  font-size: 0.95rem;
}

.item-actions {
  flex-shrink: 0;
  align-items: flex-end;
}

.item-actions .btn {
  white-space: nowrap;
  min-width: fit-content;
}

/* Sticky sidebar on desktop */
.sidebar-content {
  position: sticky;
  top: 1rem;
}

/* Modal body padding fix */
.modal-body {
  padding: 0 !important;
}

.modal-body .card {
  border: none;
  box-shadow: none;
}

/* Desktop optimizations */
@media (min-width: 992px) {
  .item-actions .btn {
    min-width: 120px;
  }
}

/* Tablet optimizations */
@media (max-width: 991px) {
  .item-title {
    font-size: 1.75rem;
  }
  
  .item-header {
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .item-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .sidebar-content {
    position: static;
  }
  
  .photo-preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }
}

/* Edit mode styling */
.item-header.edit-mode {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 2px dashed #0d6efd;
}

.form-label.small {
  margin-bottom: 0.25rem;
  color: #6c757d;
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

/* Photo Management Styles */
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

.photo-new-badge {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .item-header {
    padding: 1rem;
    flex-direction: column;
  }
  
  .item-title {
    font-size: 1.5rem;
  }
  
  .item-thumbnail {
    width: 60px;
    height: 60px;
  }
  
  .thumbnail-placeholder {
    font-size: 18px;
  }
  
  .item-actions {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  
  .item-actions .btn {
    flex: 1;
    min-width: auto;
    padding: 0.5rem 0.75rem;
  }
  
  .item-actions .btn span {
    display: none !important;
  }
  
  .item-actions .btn i {
    margin: 0 !important;
  }
  
  .item-rating {
    font-size: 0.85rem;
    padding: 0.2rem 0.5rem;
  }
  
  .price-main {
    font-size: 1.1rem;
  }
  
  .photo-preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
  }
}

@media (max-width: 576px) {
  .item-title {
    font-size: 1.25rem;
  }
  
  .item-thumbnail {
    width: 50px;
    height: 50px;
  }
  
  .thumbnail-placeholder {
    font-size: 16px;
  }
  
  .item-header {
    margin-bottom: 1rem !important;
  }
  
  .item-actions {
    gap: 0.5rem !important;
  }
  
  .photo-preview-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  
  .card {
    padding: 1rem !important;
  }
}

/* Image Carousel Styles */
.image-carousel-container {
  position: relative;
}

.carousel-main {
  position: relative;
  margin-bottom: 1rem;
  overflow: hidden;
}

.carousel-image-wrapper {
  position: relative;
  overflow: hidden;
}

.carousel-image-wrapper .ratio {
  position: relative;
}

.carousel-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Carousel fade transition animation */
.carousel-fade-enter-active {
  transition: opacity 0.4s ease-in-out, transform 0.4s ease-in-out;
}

.carousel-fade-leave-active {
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
}

.carousel-fade-enter-from {
  opacity: 0;
  transform: scale(1.05);
}

.carousel-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #212529;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.carousel-btn:hover {
  background: white;
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.carousel-btn-prev {
  left: 1rem;
}

.carousel-btn-next {
  right: 1rem;
}

.carousel-counter {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 10;
}

.carousel-thumbnails {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0;
  scrollbar-width: thin;
}

.carousel-thumbnails::-webkit-scrollbar {
  height: 6px;
}

.carousel-thumbnails::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.carousel-thumbnails::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.carousel-thumbnails::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.thumbnail-btn {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  padding: 0;
  border: 3px solid transparent;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s ease;
}

.thumbnail-btn:hover {
  border-color: #0d6efd;
  transform: translateY(-2px);
}

.thumbnail-btn.active {
  border-color: #0d6efd;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.no-photos-placeholder {
  border: 2px dashed #dee2e6;
  border-radius: 0.5rem;
}

/* Photo Preview Grid Updates */
.photo-preview-item.is-primary {
  border-color: #0d6efd;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
}

.photo-set-main-btn {
  position: absolute;
  bottom: 0.25rem;
  left: 0.25rem;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.photo-preview-item:hover .photo-set-main-btn {
  opacity: 1;
}

@media (max-width: 768px) {
  .carousel-btn {
    width: 40px;
    height: 40px;
    font-size: 1.25rem;
  }
  
  .carousel-btn-prev {
    left: 0.5rem;
  }
  
  .carousel-btn-next {
    right: 0.5rem;
  }
  
  .carousel-counter {
    bottom: 0.5rem;
    right: 0.5rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
  
  .thumbnail-btn {
    width: 60px;
    height: 60px;
  }
}

/* Fullscreen Carousel Styles */
.fullscreen-carousel-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fullscreen-carousel-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.fullscreen-close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10000;
  backdrop-filter: blur(10px);
}

.fullscreen-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.fullscreen-image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 90vw;
  max-height: 80vh;
  margin: 2rem 0;
}

.fullscreen-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 0.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.fullscreen-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10000;
  backdrop-filter: blur(10px);
}

.fullscreen-nav-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-50%) scale(1.1);
}

.fullscreen-nav-prev {
  left: 2rem;
}

.fullscreen-nav-next {
  right: 2rem;
}

.fullscreen-counter {
  position: absolute;
  bottom: 6rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  font-size: 1rem;
  font-weight: 500;
  z-index: 10000;
  backdrop-filter: blur(10px);
}

.fullscreen-thumbnails {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1rem;
  backdrop-filter: blur(10px);
  max-width: 90vw;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.fullscreen-thumbnails::-webkit-scrollbar {
  height: 6px;
}

.fullscreen-thumbnails::-webkit-scrollbar-track {
  background: transparent;
}

.fullscreen-thumbnails::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.fullscreen-thumbnail-btn {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  padding: 0;
  border: 3px solid transparent;
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.fullscreen-thumbnail-btn:hover {
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.fullscreen-thumbnail-btn.active {
  border-color: white;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.fullscreen-thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.carousel-image-clickable {
  transition: transform 0.2s ease;
}

.carousel-image-clickable:hover {
  transform: scale(1.02);
}

@media (max-width: 768px) {
  .fullscreen-carousel-content {
    padding: 1rem;
  }
  
  .fullscreen-close-btn {
    top: 0.5rem;
    right: 0.5rem;
    width: 40px;
    height: 40px;
    font-size: 1.25rem;
  }
  
  .fullscreen-nav-btn {
    width: 48px;
    height: 48px;
    font-size: 1.5rem;
  }
  
  .fullscreen-nav-prev {
    left: 0.5rem;
  }
  
  .fullscreen-nav-next {
    right: 0.5rem;
  }
  
  .fullscreen-counter {
    bottom: 5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  
  .fullscreen-thumbnails {
    bottom: 0.5rem;
    padding: 0.75rem;
    gap: 0.5rem;
  }
  
  .fullscreen-thumbnail-btn {
    width: 60px;
    height: 60px;
  }
  
  .fullscreen-image-container {
    max-height: 70vh;
    margin: 1rem 0;
  }
}
</style>
