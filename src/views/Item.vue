<script setup>
import { onMounted, ref, computed, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { fetchItem, fetchItemCalendar, updateAvailability, checkBookingAvailability } from '../services/itemService';
import { updateListing, deleteListing, toggleListingActive } from '../services/listingsService';
import { fetchBookingCalendarData } from '../services/bookingCalendarService';
import BookingCard from '../components/BookingCard.vue';
import BookingFlow from '../components/BookingFlow.vue';
import OwnerPanel from '../components/OwnerPanel.vue';
import ReviewsSection from '../components/ReviewsSection.vue';
import AvailabilityCalendar from '../components/AvailabilityCalendar.vue';
import BookingCalendar from '../components/BookingCalendar.vue';
import { Modal } from 'bootstrap';
import { getItemPhotoUrl } from '../utils/imageUtils';
import http from '../lib/http';
import { useAuthModal } from '../composables/useAuthModal';
import { requireAuth, resumePendingAction } from '../auth/requireAuth';
import { useSeo, generateIsraelTitle } from '../composables/useSeo';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const ui = useUiStore();
const auth = useAuthStore();
const { openLoginModal, closeModals } = useAuthModal();
const { updateSeo } = useSeo();
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

// Reviews data - use from item response
const reviews = computed(() => item.value?.reviews || []);
const loadingReviews = ref(false);
const reviewsError = ref(null);


// Edit form
const editForm = reactive({
  title: '',
  // Tags for the item (e.g., "console", "part", etc.)
  tags: [],
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

// Tags input
const newTag = ref('');

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
    editForm.tags = Array.isArray(item.value.tags) ? [...item.value.tags] : [];
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
    
    // Use bookings and orders from item response (no need for separate API call)
    // Transform bookings/orders to the format expected by BookingCalendar
    if (isOwner.value) {
      // Use bookings from item response if available
      const itemBookings = item.value.bookings || [];
      const itemOrders = item.value.orders || [];
      
      // Combine bookings and orders, transforming to consistent format
      const allBookings = [
        ...itemBookings.map(booking => ({
          id: booking.id,
          startDate: booking.startDate || booking.from || booking.start,
          endDate: booking.endDate || booking.to || booking.end,
          status: booking.status,
          renter: booking.renter || booking.counterparty,
          owner: booking.owner,
          item: booking.item || item.value,
          totalAmount: booking.totalAmount || booking.priceTotal || booking.total,
          currency: booking.currency || item.value.currency,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        })),
        ...itemOrders.map(order => ({
          id: order.id,
          startDate: order.start || order.startDate || order.from,
          endDate: order.end || order.endDate || order.to,
          status: order.status,
          renter: order.renter,
          owner: order.owner,
          item: order.item || item.value,
          totalAmount: order.priceTotal || order.totalAmount || order.total,
          currency: order.currency || item.value.currency,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        }))
      ];
      
      bookings.value = allBookings;
      
      // Load unavailable dates if user is owner (still needed for availability calendar)
      try {
        const calendarData = await fetchItemCalendar(id);
        unavailableDates.value = calendarData.unavailableDates;
        availabilityData.value = calendarData.availability || {};
      } catch (e) {
        console.warn('Failed to load calendar data:', e);
        // Use blockedDates from item response as fallback
        unavailableDates.value = (item.value.blockedDates || []).map(blocked => ({
          date: blocked.from || blocked.date,
          reason: blocked.reason
        }));
      }
    }
    
    // Reviews are already in item.reviews, no need to fetch separately
    
    // Update SEO metadata for this item page
    updateItemSeo();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || t('item.failedToLoad');
  } finally {
    loading.value = false;
  }
}

// Function to update SEO metadata for item pages
function updateItemSeo() {
  if (!item.value) return;
  
  const itemTitle = item.value.title || '';
  const itemDescription = item.value.description || '';
  const itemLocation = item.value.location || item.value.address || '';
  const itemPrice = item.value.pricePerDay ? (item.value.pricePerDay / 100).toFixed(0) : '';
  const itemCategory = item.value.category || '';
  
  // Get first photo URL
  const itemImage = item.value.photos && item.value.photos.length > 0 
    ? getItemPhotoUrl(item.value.photos[0])
    : 'https://www.sharo-app.com/logo.png';
  
  // Generate SEO-friendly title
  const seoTitle = generateIsraelTitle(itemTitle);
  
  // Generate description with location and price
  const seoDescription = `${itemDescription.substring(0, 150)}... - להשכרה ב${itemLocation} ב-₪${itemPrice} ליום. השכירו עכשיו ב-Sharo.`;
  
  // Generate keywords
  const keywords = [
    `השכרת ${itemTitle}`,
    `${itemTitle} להשכרה`,
    itemCategory ? `השכרת ${itemCategory}` : null,
    itemLocation ? `השכרה ב${itemLocation}` : null,
    'השכרת ציוד',
    'השכרת מוצרים'
  ].filter(Boolean).join(', ');
  
  const currentUrl = window.location.href;
  
  updateSeo({
    title: seoTitle,
    description: seoDescription,
    keywords: keywords,
    ogTitle: `${itemTitle} - להשכרה ב-Sharo`,
    ogDescription: seoDescription,
    ogImage: itemImage,
    ogUrl: currentUrl,
    productSchema: {
      title: itemTitle,
      description: itemDescription,
      image: itemImage,
      images: item.value.photos ? item.value.photos.map(p => getItemPhotoUrl(p)) : [],
      price: itemPrice,
      category: itemCategory,
      location: itemLocation,
      available: item.value.status === 'active',
      rating: item.value.rating,
      reviewCount: item.value.reviews_count || item.value.reviewsCount,
      url: currentUrl
    }
  });
}

onMounted(async () => {
  await load();
  
  // Resume pending action after auth completes
  // Watch for auth state changes - use a flag to prevent multiple executions
  let hasResumed = false;
  watch(() => auth.isAuthed, async (isAuthed) => {
    if (isAuthed && !hasResumed) {
      // Small delay to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Resume pending action
      const action = await resumePendingAction({
        BOOK: async (action) => {
          // Only resume if this is the right item
          if (action.itemId === item.value?.id) {
            hasResumed = true;
            // Open booking modal
            const modalEl = document.getElementById('bookingModal');
            if (modalEl) {
              const modal = new Modal(modalEl);
              modal.show();
            }
          }
        },
        MESSAGE: async (action) => {
          // Only resume if this is the right item
          if (action.itemId === item.value?.id) {
            hasResumed = true;
            // Open owner modal
            const modalEl = document.getElementById('ownerModal');
            if (modalEl) {
              const modal = new Modal(modalEl);
              modal.show();
            }
          }
        }
      });
      
      // Close login modal if open and action was handled
      if (action) {
        closeModals();
      }
    }
  }, { immediate: false });
});

async function showBookingModal() {
  await requireAuth(
    { type: 'BOOK', itemId: item.value?.id },
    () => {
      const modalEl = document.getElementById('bookingModal');
      if (modalEl) {
        const modal = new Modal(modalEl);
        modal.show();
      }
    }
  );
}

function closeBookingModal() {
  const modalEl = document.getElementById('bookingModal');
  if (modalEl) {
    const modal = Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

async function showOwnerModal() {
  await requireAuth(
    { type: 'MESSAGE', ownerId: item.value?.owner?.id, itemId: item.value?.id },
    () => {
      const modalEl = document.getElementById('ownerModal');
      if (modalEl) {
        const modal = new Modal(modalEl);
        modal.show();
      }
    }
  );
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
  editForm.tags = Array.isArray(originalItem.value.tags) ? [...originalItem.value.tags] : [];
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
      tags: Array.isArray(editForm.tags)
        ? editForm.tags
            .map(tag => String(tag).trim())
            .filter(tag => tag.length > 0)
        : [],
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

function addTag() {
  const value = newTag.value.trim();
  if (!value) return;

  // Avoid duplicates (case-insensitive)
  const exists = editForm.tags.some(
    tag => String(tag).toLowerCase() === value.toLowerCase()
  );
  if (!exists) {
    editForm.tags.push(value);
  }
  newTag.value = '';
}

function removeTag(index) {
  if (index < 0 || index >= editForm.tags.length) return;
  editForm.tags.splice(index, 1);
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
  if (!isOwner.value || !item.value) return;
  
  // Prevent duplicate requests if already loading
  if (loadingBookings.value) {
    console.log('Bookings already loading, skipping duplicate request');
    return;
  }
  
  loadingBookings.value = true;
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    // If we need to fetch for a specific month, make API call
    // Otherwise, use bookings from item response (already loaded)
    if (month) {
      // Fetch bookings for specific month if needed
      try {
        const response = await fetchBookingCalendarData(item.value.id, targetMonth);
        console.log('Backend response for month:', response);
        bookings.value = response.bookings || [];
      } catch (backendError) {
        console.warn('Failed to fetch bookings for month, using item data:', backendError);
        // Fallback to item bookings if month fetch fails
        const itemBookings = item.value.bookings || [];
        const itemOrders = item.value.orders || [];
        bookings.value = [
          ...itemBookings,
          ...itemOrders
        ];
      }
    } else {
      // Use bookings from item response (already loaded in load())
      const itemBookings = item.value.bookings || [];
      const itemOrders = item.value.orders || [];
      
      bookings.value = [
        ...itemBookings.map(booking => ({
          id: booking.id,
          startDate: booking.startDate || booking.from || booking.start,
          endDate: booking.endDate || booking.to || booking.end,
          status: booking.status,
          renter: booking.renter || booking.counterparty,
          owner: booking.owner,
          item: booking.item || item.value,
          totalAmount: booking.totalAmount || booking.priceTotal || booking.total,
          currency: booking.currency || item.value.currency,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        })),
        ...itemOrders.map(order => ({
          id: order.id,
          startDate: order.start || order.startDate || order.from,
          endDate: order.end || order.endDate || order.to,
          status: order.status,
          renter: order.renter,
          owner: order.owner,
          item: order.item || item.value,
          totalAmount: order.priceTotal || order.totalAmount || order.total,
          currency: order.currency || item.value.currency,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        }))
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
  // Only fetch if month is specified and different from current month
  // Otherwise, use bookings already loaded from item response
  if (params?.month) {
    loadBookings(params.month);
  } else {
    // Refresh from item data (no API call needed)
    loadBookings();
  }
}

function handleViewBooking(data) {
  console.log('View booking:', data);
  // Implement booking details modal or navigation
  ui.showToast(`Viewing booking for ${data.date.toLocaleDateString()}`, 'info');
}

// Reviews are loaded from item response, no separate API call needed
function handleReviewsRefresh() {
  // Emit refresh to parent to reload item data
  load();
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

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  // Format as "MMM D, YYYY" (e.g., "Jan 25, 2026")
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
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
    <div v-else-if="item" class="item-layout">
      <!-- Mobile Layout -->
      <div class="mobile-layout">
        <!-- Fixed Top Navigation -->
        <div class="mobile-top-nav">
          <button class="mobile-nav-btn" @click="$router.back()">
            <i class="bi bi-arrow-left"></i>
          </button>
          <div class="mobile-nav-actions">
            <button class="mobile-nav-btn">
              <i class="bi bi-heart"></i>
            </button>
            <button class="mobile-nav-btn" @click="navigator.clipboard.writeText(location.href)">
              <i class="bi bi-share"></i>
            </button>
          </div>
        </div>

        <!-- Hero Image Section -->
        <section class="mobile-hero">
          <div
            class="mobile-hero-media"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          >
            <div v-if="displayPhotos?.length > 0" class="mobile-hero-image">
              <transition name="carousel-fade" mode="out-in">
                <img
                  :key="currentPhotoIndex"
                  :src="getCarouselPhotoUrl(displayPhotos[currentPhotoIndex])"
                  :alt="$t('item.photoAlt', { title: item.title || $t('item.item'), index: currentPhotoIndex + 1 })"
                  @click="openFullscreenCarousel"
                />
              </transition>
            </div>
            <div v-else class="mobile-hero-image mobile-hero-placeholder">
              <i class="bi bi-image"></i>
            </div>

            <div v-if="displayPhotos?.length > 1" class="mobile-hero-counter">
              {{ currentPhotoIndex + 1 }} / {{ displayPhotos.length }}
            </div>

            <div v-if="displayPhotos?.length > 1" class="mobile-hero-dots">
              <div
                v-for="(photo, index) in displayPhotos.slice(0, 3)"
                :key="index"
                class="mobile-dot"
                :class="{ active: index === currentPhotoIndex }"
              ></div>
            </div>
          </div>
        </section>

        <!-- Content Section -->
        <section class="mobile-content">
          <!-- Header -->
          <div class="mobile-header">
            <div class="mobile-header-top">
              <span class="mobile-category">{{ item.category }}</span>
              <div v-if="item.rating" class="mobile-rating">
                <i class="bi bi-star-fill"></i>
                <span>{{ item.rating.toFixed(1) }}</span>
                <span class="mobile-rating-count">({{ item.reviews_count || 0 }} {{ $t('item.reviews') }})</span>
              </div>
            </div>
            <h1 class="mobile-title">{{ item.title }}</h1>
            <p class="mobile-location">
              <i class="bi bi-geo-alt"></i>
              <span>{{ item.location || item.address }}</span>
            </p>
          </div>

          <!-- Description -->
          <div class="mobile-section">
            <h2 class="mobile-section-title">{{ $t('item.aboutThisItem') }}</h2>
            <p class="mobile-description">{{ item.description || $t('item.noDescription') }}</p>
          </div>

          <!-- Key Features (if applicable) -->
          <div v-if="item.condition || item.deposit || item.initialPrice" class="mobile-section">
            <details class="mobile-details" open>
              <summary class="mobile-details-summary">
                <span>{{ $t('item.details') }}</span>
                <i class="bi bi-chevron-down"></i>
              </summary>
              <div class="mobile-details-content">
                <div v-if="item.condition" class="mobile-detail-item">
                  <i class="bi bi-check-circle text-primary"></i>
                  <span>{{ $t('item.condition') }}: {{ item.condition }}</span>
                </div>
                <div v-if="item.deposit" class="mobile-detail-item">
                  <i class="bi bi-shield-check text-primary"></i>
                  <span>{{ $t('item.deposit') }}: {{ formatPrice(item.deposit) }}</span>
                </div>
                <div v-if="item.initialPrice" class="mobile-detail-item">
                  <i class="bi bi-cash text-primary"></i>
                  <span>{{ $t('item.initial') }}: {{ formatPrice(item.initialPrice) }}</span>
                </div>
              </div>
            </details>
          </div>

          <!-- Owner Card -->
          <div v-if="item?.owner && !isOwner" class="mobile-section">
            <div class="mobile-owner-card">
              <div class="mobile-owner-info">
                <div class="mobile-owner-avatar">
                  <img
                    v-if="item.owner.profilePicture"
                    :src="item.owner.profilePicture"
                    :alt="item.owner.username"
                  />
                  <i v-else class="bi bi-person-fill"></i>
                </div>
                <div class="mobile-owner-details">
                  <h3 class="mobile-owner-name">{{ item.owner.username }}</h3>
                  <div class="mobile-owner-meta">
                    <span class="mobile-owner-badge">
                      <i class="bi bi-patch-check-fill text-primary"></i>
                      {{ $t('item.verified') }}
                    </span>
                    <span>•</span>
                    <span>
                      <i class="bi bi-clock"></i>
                      {{ $t('item.fastResponse') }}
                    </span>
                  </div>
                </div>
                <button class="mobile-owner-message" @click="showOwnerModal">
                  <i class="bi bi-chat-dots"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Reviews -->
          <div v-if="reviews && reviews.length > 0" class="mobile-section">
            <div class="mobile-section-header">
              <h2 class="mobile-section-title">{{ $t('item.reviews') }} ({{ reviews.length }})</h2>
              <button class="mobile-see-all">{{ $t('item.seeAll') }}</button>
            </div>
            <div
              v-for="review in reviews.slice(0, 2)"
              :key="review.id"
              class="mobile-review-card"
            >
              <div class="mobile-review-header">
                <div class="mobile-review-user">
                  <div class="mobile-review-avatar">
                    <img
                      v-if="review.reviewer?.profilePicture"
                      :src="review.reviewer.profilePicture"
                      :alt="review.reviewer.username"
                    />
                    <i v-else class="bi bi-person-fill"></i>
                  </div>
                  <div>
                    <p class="mobile-review-name">{{ review.reviewer?.username || $t('userProfile.anonymous') }}</p>
                    <p class="mobile-review-date">{{ formatDate(review.createdAt) }}</p>
                  </div>
                </div>
                <div class="mobile-review-rating">
                  <i v-for="n in 5" :key="n" class="bi" :class="n <= review.ratingOverall ? 'bi-star-fill' : 'bi-star'"></i>
                </div>
              </div>
              <p class="mobile-review-text">{{ review.body || review.comment }}</p>
            </div>
          </div>

          <!-- Deposit Info -->
          <!-- <div v-if="item.deposit" class="mobile-info-box">
            <i class="bi bi-info-circle"></i>
            <p>
              {{ $t('item.depositInfo') }} <strong>{{ formatPrice(item.deposit) }}</strong> {{ $t('item.depositHeldDuring') }}
            </p>
          </div> -->

          <!-- Safety Notice -->
          <div class="mobile-info-box">
            <i class="bi bi-shield-check"></i>
            <p>
              {{ $t('item.safetyNotice') }}
            </p>
          </div>
        </section>

        <!-- Fixed Bottom Bar -->
        <div v-if="!isOwner" class="mobile-bottom-bar">
          <div class="mobile-bottom-price">
            <div class="mobile-bottom-price-value">{{ formatPrice(item.pricePerDay) }}/{{ $t('item.perDay') }}</div>
          </div>
          <button class="mobile-bottom-book-btn" @click="showBookingModal">
            {{ $t('item.bookNow') }}
          </button>
        </div>
      </div>

      <!-- Desktop Layout -->
      <div class="desktop-layout">
      <section class="item-hero">
        <div
          class="hero-media"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        >
          <div v-if="displayPhotos?.length > 0" class="hero-image">
            <transition name="carousel-fade" mode="out-in">
              <img
                :key="currentPhotoIndex"
                :src="getCarouselPhotoUrl(displayPhotos[currentPhotoIndex])"
                :alt="`${item.title} - Photo ${currentPhotoIndex + 1}`"
                class="hero-image-img"
                @click="openFullscreenCarousel"
              />
            </transition>
          </div>
          <div v-else class="hero-image hero-image-placeholder">
            <div class="text-center text-muted">
              <i class="bi bi-image display-4 d-block mb-2"></i>
              <p class="mb-0">{{ $t('item.noPhotosAvailable') }}</p>
            </div>
          </div>

          <template v-if="displayPhotos?.length > 1">
            <button class="hero-nav hero-nav-prev" @click="previousPhoto" :aria-label="$t('item.previousPhoto')">
              <i class="bi bi-chevron-left"></i>
            </button>
            <button class="hero-nav hero-nav-next" @click="nextPhoto" :aria-label="$t('item.nextPhoto')">
              <i class="bi bi-chevron-right"></i>
            </button>
            <div class="hero-counter">
              {{ currentPhotoIndex + 1 }} / {{ displayPhotos.length }}
            </div>
          </template>

          <div class="hero-card">
            <div class="hero-meta">
              <span class="hero-category">{{ item.category }}</span>
              <div class="hero-rating">
                <i class="bi bi-star-fill"></i>
                <span>{{ item.rating || '0.0' }}</span>
                <span class="hero-rating-count">({{ item.reviews_count || 0 }})</span>
              </div>
            </div>
            <h1 class="hero-title">{{ item.title }}</h1>
            <p class="hero-location">
              <i class="bi bi-geo-alt"></i>
              <span>{{ item.location || item.address }}</span>
            </p>
            <div class="hero-price">
              <span class="hero-price-value">{{ formatPrice(item.pricePerDay) }}</span>
              <span class="hero-price-unit">{{ $t('item.perDay') }}</span>
            </div>
            <div v-if="!isOwner" class="hero-actions">
              <button class="btn btn-primary hero-btn hero-btn-book" @click="showBookingModal">
                <i class="bi bi-calendar-check hero-btn-icon"></i>
                <span class="hero-btn-text">{{ $t('item.bookNow') }}</span>
              </button>
              <button class="btn btn-outline-light hero-btn hero-btn-message" @click="showOwnerModal">
                <i class="bi bi-chat-dots hero-btn-icon"></i>
                <span class="hero-btn-text">{{ $t('item.message') }}</span>
              </button>
            </div>
          </div>

          <div v-if="isOwner" class="hero-actions">
            <button
              class="btn btn-sm"
              :class="editMode ? 'btn-success' : 'btn-primary'"
              @click="toggleEditMode"
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
              :disabled="saving || deleting"
            >
              <span v-if="deleting" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              <i v-else class="bi bi-trash"></i>
              <span class="d-none d-lg-inline ms-1">{{ $t('item.delete') }}</span>
            </button>
          </div>
        </div>
      </section>

      <div v-if="displayPhotos?.length > 1" class="hero-thumbnails hide-scrollbar">
        <button
          v-for="(photo, index) in displayPhotos"
          :key="index"
          class="hero-thumb"
          :class="{ active: index === currentPhotoIndex }"
          @click="currentPhotoIndex = index"
          :aria-label="$t('item.viewPhoto', { index: index + 1 })"
        >
          <img :src="getCarouselPhotoUrl(photo)" :alt="$t('item.thumbnailAlt', { index: index + 1 })" />
        </button>
      </div>

      <div class="item-grid">
        <div class="item-main">
          <div v-if="editMode && isOwner" class="item-card edit-card">
            <h2 class="section-title">{{ $t('listing.editListing') }}</h2>
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label small fw-bold">{{ $t('item.title') }}</label>
                <input
                  v-model="editForm.title"
                  type="text"
                  class="form-control form-control-lg"
                  :placeholder="$t('item.itemTitle')"
                  :disabled="saving"
                />
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-bold">{{ $t('item.tags') }}</label>
                <div class="mb-2">
                  <div class="input-group">
                    <input
                      v-model="newTag"
                      type="text"
                      class="form-control form-control-sm"
                      :placeholder="$t('item.tagsPlaceholder')"
                      :disabled="saving"
                      @keyup.enter.prevent="addTag"
                    />
                    <button
                      type="button"
                      class="btn btn-outline-primary btn-sm"
                      :disabled="saving || !newTag.trim()"
                      @click="addTag"
                    >
                      <i class="bi bi-plus-lg"></i>
                      {{ $t('item.addTag') }}
                    </button>
                  </div>
                  <small class="text-muted d-block mt-1">{{ $t('item.tagsHelp') }}</small>
                </div>
                <div v-if="editForm.tags && editForm.tags.length" class="d-flex flex-wrap gap-1">
                  <span
                    v-for="(tag, index) in editForm.tags"
                    :key="`${tag}-${index}`"
                    class="badge bg-secondary d-inline-flex align-items-center"
                  >
                    <span class="me-1">#{{ tag }}</span>
                    <button
                      type="button"
                      class="btn btn-sm btn-link p-0 text-white"
                      @click="removeTag(index)"
                      :disabled="saving"
                    >
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </span>
                </div>
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-bold">
                  {{ $t('item.location') }} <span class="text-danger">*</span>
                </label>
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

              <div class="col-md-4">
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
              <div class="col-md-4">
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
              <div class="col-md-4">
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
              <div class="col-12">
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

          <div v-if="editMode && isOwner" class="item-card">
            <h2 class="section-title">{{ $t('item.managePhotos') }}</h2>
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
            <div v-if="editPhotos.length > 0" class="photo-preview-grid">
              <div
                v-for="(photo, index) in editPhotos"
                :key="photo.id || index"
                class="photo-preview-item"
                :class="{ 'is-primary': photo.position === 0 }"
              >
                <img
                  :src="photo.preview || (photo.url ? getItemPhotoUrl(photo.url) : null) || (photo.publicUrl ? getItemPhotoUrl(photo.publicUrl) : null)"
                  :alt="$t('item.photoAlt', { title: item.title || $t('item.item'), index: index + 1 })"
                  class="photo-thumbnail"
                />
                <button
                  type="button"
                  class="btn btn-sm btn-danger photo-remove-btn"
                  @click="removePhoto(index)"
                  :title="$t('item.removePhoto')"
                  :disabled="saving"
                >
                  <i class="bi bi-x-lg"></i>
                </button>
                <button
                  v-if="photo.position !== 0"
                  type="button"
                  class="btn btn-sm btn-primary photo-set-main-btn"
                  @click="setMainPhoto(index)"
                  :title="$t('item.setMainPhoto')"
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

          <div class="item-card">
            <h2 class="section-title">{{ $t('item.aboutThisItem') }}</h2>
            <p v-if="!editMode" class="section-text">{{ item.description }}</p>
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

          <div v-if="item?.owner && !isOwner" class="item-card lender-card">
            <div class="lender-header">
              <h2 class="section-title">{{ $t('item.contactOwner') }}</h2>
              <router-link
                v-if="item.owner?.id"
                class="lender-link"
                :to="{ name: 'user-profile', params: { id: item.owner.id } }"
              >
                {{ $t('item.viewProfile') }}
              </router-link>
            </div>
            <div class="lender-body">
              <div class="lender-avatar">
                <img
                  v-if="item.owner.profilePicture"
                  :src="item.owner.profilePicture"
                  :alt="item.owner.username"
                />
                <div v-else class="avatar-placeholder">
                  <i class="bi bi-person-fill"></i>
                </div>
              </div>
              <div class="lender-info">
                <h3 class="lender-name">{{ item.owner.username }}</h3>
                <div class="lender-meta">
                  <span v-if="item.owner.city">
                    <i class="bi bi-geo-alt me-1"></i>{{ item.owner.city }}
                  </span>
                  <span v-if="item.owner.createdAt">
                    <i class="bi bi-calendar me-1"></i>{{ formatDate(item.owner.createdAt) }}
                  </span>
                </div>
                <button
                  v-if="!isOwner"
                  class="btn btn-outline-primary btn-sm mt-2"
                  @click="showOwnerModal"
                >
                  {{ $t('item.message') }}
                </button>
              </div>
            </div>
          </div>

          <div class="item-card reviews-card">
            <ReviewsSection
              :item="item"
              :can-review="!isOwner"
              :reviews="reviews"
              :loading="false"
              :error="null"
              @refresh="handleReviewsRefresh"
            />
          </div>

          <div v-if="isOwner" class="item-card">
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

        <div class="item-sidebar">
          <div class="sidebar-card">
            <div class="sidebar-header">
              <h3 class="sidebar-title">{{ $t('item.availability') }}</h3>
            </div>
            <div class="sidebar-price">
              <span class="sidebar-price-value">{{ formatPrice(item.pricePerDay) }}</span>
              <span class="sidebar-price-unit">{{ $t('item.perDay') }}</span>
            </div>
            <div class="sidebar-details">
              <div v-if="item.initialPrice" class="sidebar-line">
                <span class="text-muted">{{ $t('item.initial') }}</span>
                <span class="fw-semibold">{{ formatPrice(item.initialPrice) }}</span>
              </div>
              <div v-if="item.deposit" class="sidebar-line">
                <span class="text-muted">{{ $t('item.deposit') }}</span>
                <span class="fw-semibold">{{ formatPrice(item.deposit) }}</span>
              </div>
            </div>
            <div class="sidebar-actions">
              <template v-if="!isOwner">
                <button class="btn btn-primary w-100" @click="showBookingModal">
                  <i class="bi bi-calendar-check me-2"></i>
                  {{ $t('item.bookNow') }}
                </button>
                <button class="btn btn-outline-primary w-100" @click="showOwnerModal">
                  <i class="bi bi-chat-dots me-2"></i>
                  {{ $t('item.message') }}
                </button>
                <button class="btn btn-outline-secondary w-100" @click="navigator.clipboard.writeText(location.href)">
                  <i class="bi bi-share me-2"></i>
                  {{ $t('item.share') }}
                </button>
              </template>
              <div v-else class="text-muted small">
                {{ $t('bookingRequests.youAreOwner') }}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- Booking Modal -->
    <div class="modal fade" id="bookingModal" tabindex="-1" aria-labelledby="bookingModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="bookingModalLabel">{{ $t('item.bookThisItem') }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('common.close')"></button>
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
            <h5 class="modal-title" id="ownerModalLabel">{{ $t('ownerPanel.title') }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('common.close')"></button>
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
            :alt="$t('item.photoAlt', { title: item.title || $t('item.item'), index: currentPhotoIndex + 1 })"
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
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.item-layout {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.item-hero {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.15);
}

.hero-media {
  position: relative;
}

.hero-image {
  aspect-ratio: 21 / 9;
  width: 100%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-image-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.25);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  transition: all 0.2s ease;
}

.hero-nav:hover {
  background: rgba(255, 255, 255, 0.4);
}

.hero-nav-prev {
  left: 16px;
}

.hero-nav-next {
  right: 16px;
}

.hero-counter {
  position: absolute;
  right: 16px;
  bottom: 16px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(6px);
}

.hero-card {
  position: absolute;
  left: 20px;
  bottom: 20px;
  max-width: 420px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.35));
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 20px;
  padding: 18px 20px;
  backdrop-filter: blur(16px) saturate(160%);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.hero-category {
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.hero-rating {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f59e0b;
  font-weight: 700;
  font-size: 14px;
}

.hero-rating-count {
  font-weight: 400;
  color: #64748b;
}

.hero-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 6px 0;
  color: #0f172a;
}

.hero-location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
  margin: 0 0 12px 0;
}

.hero-price {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.hero-price-value {
  font-size: 22px;
  font-weight: 800;
  color: #2563eb;
}

.hero-price-unit {
  font-size: 13px;
  color: #64748b;
}

.hero-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.hero-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.hero-btn-book {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.hero-btn-book:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
}

.hero-btn-message {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.5);
  color: #2563eb;
  backdrop-filter: blur(8px);
}

.hero-btn-message:hover {
  background: white;
  border-color: white;
  color: #1d4ed8;
  transform: translateY(-2px);
}

/* Mobile: Hide icons, show only text */
@media (max-width: 768px) {
  .hero-card {
    left: 12px;
    bottom: 12px;
    right: 12px;
    max-width: none;
    padding: 14px 16px;
  }
  
  .hero-title {
    font-size: 22px;
  }
  
  .hero-price-value {
    font-size: 20px;
  }
  
  .hero-btn-icon {
    display: none;
  }
  
  .hero-btn {
    font-size: 13px;
    padding: 8px 12px;
  }
  
  .hero-actions {
    gap: 8px;
    margin-top: 12px;
  }
}

@media (max-width: 576px) {
  .hero-card {
    left: 8px;
    bottom: 8px;
    right: 8px;
    padding: 12px 14px;
  }
  
  .hero-title {
    font-size: 18px;
  }
  
  .hero-price-value {
    font-size: 18px;
  }
  
  .hero-btn {
    font-size: 12px;
    padding: 7px 10px;
  }
}

.hero-thumbnails {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.hero-thumb {
  border: 2px solid transparent;
  border-radius: 14px;
  overflow: hidden;
  flex: 0 0 auto;
  width: 88px;
  height: 88px;
  padding: 0;
  background: none;
}

.hero-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-thumb.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.item-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 2rem;
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.item-sidebar {
  position: relative;
}

.item-card {
  background: #ffffff;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  padding: 1.75rem;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
}

.reviews-card .card {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 1rem;
}

.section-text {
  color: #475569;
  line-height: 1.7;
  margin: 0;
}

.lender-card .lender-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.lender-link {
  font-weight: 600;
  font-size: 13px;
  color: #2563eb;
  text-decoration: none;
}

.lender-body {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 1rem;
}

.lender-avatar {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  overflow: hidden;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lender-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lender-name {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.lender-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #64748b;
}

.sidebar-card {
  position: sticky;
  top: 96px;
  background: #ffffff;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  padding: 1.5rem;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.sidebar-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sidebar-price-value {
  font-size: 26px;
  font-weight: 800;
  color: #2563eb;
}

.sidebar-price-unit {
  color: #64748b;
  font-size: 14px;
}

.sidebar-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-line {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar {
  scrollbar-width: none;
}

:global([data-bs-theme="dark"]) .item-hero {
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
}

:global([data-bs-theme="dark"]) .hero-card {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.4));
  border-color: rgba(148, 163, 184, 0.25);
  backdrop-filter: blur(18px) saturate(140%);
}

:global([data-bs-theme="dark"]) .hero-title {
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .hero-rating-count,
:global([data-bs-theme="dark"]) .hero-location,
:global([data-bs-theme="dark"]) .hero-price-unit {
  color: #cbd5f5;
}

:global([data-bs-theme="dark"]) .hero-category {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}

:global([data-bs-theme="dark"]) .hero-thumb {
  border-color: transparent;
}

:global([data-bs-theme="dark"]) .hero-thumb.active {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.3);
}

:global([data-bs-theme="dark"]) .hero-btn-book {
  background: #3b82f6;
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

:global([data-bs-theme="dark"]) .hero-btn-book:hover {
  background: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
}

:global([data-bs-theme="dark"]) .hero-btn-message {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(148, 163, 184, 0.3);
  color: #93c5fd;
  backdrop-filter: blur(12px);
}

:global([data-bs-theme="dark"]) .hero-btn-message:hover {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(148, 163, 184, 0.5);
  color: #60a5fa;
}

:global([data-bs-theme="dark"]) .item-card,
:global([data-bs-theme="dark"]) .sidebar-card {
  background: transparent;
  border-color: #1f2937;
  box-shadow: none;
}

:global([data-bs-theme="dark"]) .section-text,
:global([data-bs-theme="dark"]) .lender-meta,
:global([data-bs-theme="dark"]) .sidebar-price-unit,
:global([data-bs-theme="dark"]) .sidebar-line .text-muted {
  color: #94a3b8 !important;
}

:global([data-bs-theme="dark"]) .section-title,
:global([data-bs-theme="dark"]) .lender-name,
:global([data-bs-theme="dark"]) .sidebar-title {
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .lender-avatar {
  background: #1e293b;
}

:global([data-bs-theme="dark"]) .sidebar-price-value {
  color: #60a5fa;
}

@media (max-width: 992px) {
  .item-grid {
    grid-template-columns: 1fr;
  }

  .sidebar-card {
    position: static;
  }
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

/* Mobile Layout Styles */
.mobile-layout {
  display: none;
}

.desktop-layout {
  display: block;
}

@media (max-width: 768px) {
  .mobile-layout {
    display: block;
  }
  
  .desktop-layout {
    display: none;
  }
}

/* Mobile Top Navigation */
.mobile-top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  pointer-events: none;
}

.mobile-nav-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-radius: 50%;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
  transition: transform 0.2s;
}

.mobile-nav-btn:active {
  transform: scale(0.95);
}

.mobile-nav-btn i {
  font-size: 18px;
  color: #0f172a;
}

.mobile-nav-actions {
  display: flex;
  gap: 8px;
}

/* Mobile Hero Section */
.mobile-hero {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: #f1f5f9;
}

.mobile-hero-media {
  width: 100%;
  height: 100%;
  position: relative;
}

.mobile-hero-image {
  width: 100%;
  height: 100%;
}

.mobile-hero-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mobile-hero-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.mobile-hero-placeholder i {
  font-size: 4rem;
}

.mobile-hero-counter {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  padding: 0.375rem 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  color: white;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.mobile-hero-dots {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}

.mobile-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transition: background 0.3s;
}

.mobile-dot.active {
  background: white;
}

/* Mobile Content */
.mobile-content {
  padding: 1.25rem;
  padding-bottom: 120px;
  max-width: 28rem;
  margin: 0 auto;
}

.mobile-header {
  margin-bottom: 1rem;
}

.mobile-header-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.mobile-category {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.mobile-rating {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #f59e0b;
  font-weight: 700;
  font-size: 14px;
}

.mobile-rating i {
  font-size: 14px;
}

.mobile-rating-count {
  color: #94a3b8;
  font-weight: 400;
}

.mobile-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #0f172a;
  line-height: 1.3;
}

.mobile-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.mobile-location i {
  font-size: 16px;
}

/* Mobile Price Section */
.mobile-price-section {
  padding: 1rem 0;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.mobile-price-wrapper {
  display: flex;
  flex-direction: column;
}

.mobile-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.mobile-price-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.mobile-price-unit {
  font-size: 12px;
  color: #64748b;
}

.mobile-price-details {
  font-size: 10px;
  color: #3b82f6;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border: none;
  background: none;
  padding: 0;
  text-align: left;
}

.mobile-book-btn {
  background: #3b82f6;
  color: white;
  padding: 0.875rem 2.5rem;
  border-radius: 16px;
  font-weight: 700;
  border: none;
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);
  transition: transform 0.2s;
}

.mobile-book-btn:active {
  transform: scale(0.98);
}

/* Mobile Sections */
.mobile-section {
  margin-bottom: 1.5rem;
}

.mobile-section-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 0.75rem 0;
  color: #0f172a;
}

.mobile-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.mobile-see-all {
  font-size: 14px;
  color: #3b82f6;
  font-weight: 600;
  border: none;
  background: none;
  padding: 0;
}

.mobile-description {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

/* Mobile Details */
.mobile-details {
  border: 1px solid #f1f5f9;
  border-radius: 16px;
  overflow: hidden;
}

.mobile-details-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  cursor: pointer;
  list-style: none;
  background: #f8fafc;
  font-weight: 600;
  font-size: 14px;
  color: #0f172a;
}

.mobile-details-summary::-webkit-details-marker {
  display: none;
}

.mobile-details-summary i {
  transition: transform 0.3s;
}

.mobile-details[open] .mobile-details-summary i {
  transform: rotate(180deg);
}

.mobile-details-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid #f1f5f9;
}

.mobile-detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #0f172a;
}

.mobile-detail-item i {
  font-size: 16px;
}

/* Mobile Owner Card */
.mobile-owner-card {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 24px;
  border: 1px solid #f1f5f9;
}

.mobile-owner-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-owner-avatar {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  overflow: hidden;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-owner-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-owner-avatar i {
  font-size: 24px;
  color: #94a3b8;
}

.mobile-owner-details {
  flex: 1;
}

.mobile-owner-name {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #0f172a;
}

.mobile-owner-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.mobile-owner-badge {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mobile-owner-badge i {
  font-size: 12px;
}

.mobile-owner-message {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #3b82f6;
  flex-shrink: 0;
}

.mobile-owner-message i {
  font-size: 20px;
}

/* Mobile Reviews */
.mobile-review-card {
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  margin-bottom: 12px;
}

.mobile-review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.mobile-review-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-review-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mobile-review-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-review-avatar i {
  font-size: 16px;
  color: #94a3b8;
}

.mobile-review-name {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
}

.mobile-review-date {
  font-size: 10px;
  color: #94a3b8;
  margin: 0;
}

.mobile-review-rating {
  display: flex;
  gap: 2px;
  color: #f59e0b;
}

.mobile-review-rating i {
  font-size: 12px;
}

.mobile-review-text {
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}

/* Mobile Info Box */
.mobile-info-box {
  display: flex;
  gap: 12px;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.05);
  border-radius: 16px;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.mobile-info-box i {
  color: #3b82f6;
  font-size: 14px;
  margin-top: 2px;
  flex-shrink: 0;
}

.mobile-info-box p {
  font-size: 11px;
  color: #1e40af;
  line-height: 1.5;
  margin: 0;
}

/* Mobile Bottom Bar */
.mobile-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  border-top: 1px solid #f1f5f9;
  z-index: 50;
  padding: 1rem 1.25rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
}

.mobile-bottom-price {
  display: flex;
  flex-direction: column;
}

.mobile-bottom-price-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.mobile-bottom-price-unit {
  font-size: 12px;
  color: #64748b;
}

.mobile-bottom-book-btn {
  background: #3b82f6;
  color: white;
  padding: 0.875rem 2.5rem;
  border-radius: 16px;
  font-weight: 700;
  border: none;
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);
  transition: transform 0.2s;
}

.mobile-bottom-book-btn:active {
  transform: scale(0.98);
}

/* Dark mode for mobile */
:global([data-bs-theme="dark"]) .mobile-nav-btn {
  background: rgba(30, 41, 59, 0.9);
}

:global([data-bs-theme="dark"]) .mobile-nav-btn i {
  color: white;
}

:global([data-bs-theme="dark"]) .mobile-hero {
  background: #1e293b;
}

:global([data-bs-theme="dark"]) .mobile-title,
:global([data-bs-theme="dark"]) .mobile-section-title,
:global([data-bs-theme="dark"]) .mobile-price-value,
:global([data-bs-theme="dark"]) .mobile-owner-name,
:global([data-bs-theme="dark"]) .mobile-review-name,
:global([data-bs-theme="dark"]) .mobile-bottom-price-value,
:global([data-bs-theme="dark"]) .mobile-details-summary {
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .mobile-location,
:global([data-bs-theme="dark"]) .mobile-price-unit,
:global([data-bs-theme="dark"]) .mobile-description,
:global([data-bs-theme="dark"]) .mobile-owner-meta,
:global([data-bs-theme="dark"]) .mobile-review-text,
:global([data-bs-theme="dark"]) .mobile-review-date,
:global([data-bs-theme="dark"]) .mobile-bottom-price-unit {
  color: #cbd5e1;
}

:global([data-bs-theme="dark"]) .mobile-category {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}

:global([data-bs-theme="dark"]) .mobile-price-section {
  border-color: #334155;
}

:global([data-bs-theme="dark"]) .mobile-details {
  border-color: #334155;
}

:global([data-bs-theme="dark"]) .mobile-details-summary {
  background: rgba(30, 41, 59, 0.5);
}

:global([data-bs-theme="dark"]) .mobile-details-content {
  border-color: #334155;
}

:global([data-bs-theme="dark"]) .mobile-owner-card {
  background: rgba(30, 41, 59, 0.5);
  border-color: #334155;
}

:global([data-bs-theme="dark"]) .mobile-owner-avatar {
  background: #1e293b;
}

:global([data-bs-theme="dark"]) .mobile-review-card {
  border-color: #334155;
}

:global([data-bs-theme="dark"]) .mobile-review-avatar {
  background: #1e293b;
}

:global([data-bs-theme="dark"]) .mobile-info-box {
  background: rgba(59, 130, 246, 0.1);
}

:global([data-bs-theme="dark"]) .mobile-info-box p {
  color: #93c5fd;
}

:global([data-bs-theme="dark"]) .mobile-bottom-bar {
  background: rgba(15, 23, 42, 0.95);
  border-color: #334155;
}
</style>
