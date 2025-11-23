<script setup>
import { onMounted, ref, computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { fetchItem, fetchItemCalendar, updateAvailability, checkBookingAvailability } from '../services/itemService';
import { updateListing, fetchCategories, fetchLocations, deleteListing, toggleListingActive } from '../services/listingsService';
import { fetchBookingCalendarData } from '../services/bookingCalendarService';
import { fetchItemReviews } from '../services/reviewsService';
import ImageGallery from '../components/ImageGallery.vue';
import BookingCard from '../components/BookingCard.vue';
import BookingFlow from '../components/BookingFlow.vue';
import OwnerPanel from '../components/OwnerPanel.vue';
import ReviewsSection from '../components/ReviewsSection.vue';
import AvailabilityCalendar from '../components/AvailabilityCalendar.vue';
import BookingCalendar from '../components/BookingCalendar.vue';
import { Modal } from 'bootstrap';
import { getItemPhotoUrl } from '../utils/imageUtils';

const route = useRoute();
const router = useRouter();
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

// Categories and locations for dropdown
const categories = ref([]);
const locations = ref([]);

// Edit form
const editForm = reactive({
  title: '',
  category: '',
  location: '',
  pricePerDay: 0,
  initialPrice: 0,
  deposit: 0,
  currency: 'ILS',
  description: '',
});

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
    editForm.pricePerDay = item.value.pricePerDay/100 || 0;
    editForm.initialPrice = item.value.initialPrice/100 || 0;
    editForm.deposit = item.value.deposit/100 || 0;
    editForm.currency = item.value.currency || 'ILS';
    editForm.description = item.value.description || '';
    
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
    error.value = e?.response?.data?.message || e.message || 'Failed to load item';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  
  // Load categories and locations for edit mode
  try {
    categories.value = await fetchCategories();
    locations.value = await fetchLocations();
  } catch (e) {
    console.error('Failed to load categories/locations:', e);
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
    ui.showToast('Edit mode enabled', 'info');
  }
}

function cancelEdit() {
  // Restore original values
  editForm.title = originalItem.value.title || '';
  editForm.category = originalItem.value.category || '';
  editForm.location = originalItem.value.address || originalItem.value.location || '';
  editForm.pricePerDay = originalItem.value.pricePerDay/100 || 0;
  editForm.initialPrice = originalItem.value.initialPrice/100 || 0;
  editForm.deposit = originalItem.value.deposit/100 || 0;
  editForm.currency = originalItem.value.currency || 'ILS';
  editForm.description = originalItem.value.description || '';
  
  editMode.value = false;
  ui.showToast('Changes discarded', 'info');
}

async function saveChanges() {
  // Validate
  if (!editForm.title?.trim()) {
    ui.showToast('Title is required', 'warning');
    return;
  }
  if (!editForm.category) {
    ui.showToast('Category is required', 'warning');
    return;
  }
  if (!editForm.location) {
    ui.showToast('Location is required', 'warning');
    return;
  }
  if (!editForm.pricePerDay || editForm.pricePerDay < 0) {
    ui.showToast('Valid price is required', 'warning');
    return;
  }
  
  saving.value = true;
  try {
    const payload = {
      title: editForm.title,
      category: editForm.category,
      address: editForm.location,
      pricePerDay: editForm.pricePerDay,
      initialPrice: editForm.initialPrice,
      deposit: editForm.deposit,
      currency: editForm.currency,
      description: editForm.description,
    };
    
    const updated = await updateListing(item.value.id, payload);
    
    // Update local item with new values
    item.value = { ...item.value, ...updated };
    originalItem.value = JSON.parse(JSON.stringify(item.value));
    
    editMode.value = false;
    ui.showToast('Listing updated successfully!', 'success');
  } catch (e) {
    console.error('Failed to update listing:', e);
    ui.showToast(e?.response?.data?.message || 'Failed to update listing', 'danger');
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
    ui.showToast(`Listing ${newActiveStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
  } catch (e) {
    console.error('Failed to toggle listing status:', e);
    ui.showToast(e?.response?.data?.message || 'Failed to update listing status', 'danger');
  } finally {
    togglingActive.value = false;
  }
}

async function deleteItem() {
  if (!item.value) return;
  
  if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
    return;
  }
  
  deleting.value = true;
  try {
    await deleteListing(item.value.id);
    ui.showToast('Listing deleted successfully!', 'success');
    // Redirect to user's listings or home page
    router.push({ name: 'dashboard' });
  } catch (e) {
    console.error('Failed to delete listing:', e);
    ui.showToast(e?.response?.data?.message || 'Failed to delete listing', 'danger');
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

function formatPrice(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount / 100)
}
</script>

<template>
  <div class="item-page">
    <!-- Breadcrumb -->
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb small mb-0">
        <li class="breadcrumb-item"><router-link to="/">Home</router-link></li>
        <li class="breadcrumb-item">
          <router-link :to="{ name: 'search', query: { category: item?.category } }">{{
            item?.category || 'Items'
          }}</router-link>
        </li>
        <li class="breadcrumb-item active" aria-current="page">{{ item?.title || 'Item' }}</li>
      </ol>
    </nav>

    <!-- Error State -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
      <div class="small text-secondary mt-2">Loading item…</div>
    </div>

    <!-- Item Content -->
    <div v-else-if="item">
      <!-- Item Header - Always at top -->
      <div class="item-header mb-4" :class="{ 'edit-mode': editMode }">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
          <div class="flex-grow-1">
            <!-- Title with Image (Owners Only) -->
            <div v-if="isOwner && !editMode" class="d-flex align-items-center gap-3 mb-2">
              <div class="item-thumbnail">
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
              <h1 class="item-title mb-0">{{ item.title }}</h1>
            </div>
            <!-- Title: View Mode (Non-Owners) -->
            <h1 v-else-if="!editMode" class="item-title mb-2">{{ item.title }}</h1>
            <div v-else class="mb-3">
              <label class="form-label small fw-bold">Title</label>
              <input 
                v-model="editForm.title" 
                type="text" 
                class="form-control form-control-lg" 
                placeholder="Item title"
                :disabled="saving"
              />
            </div>

            <!-- Meta: View or Edit Mode -->
            <div v-if="!editMode" class="item-meta d-flex flex-wrap gap-3 align-items-center text-muted">
              <span class="d-flex align-items-center gap-1">
                <i class="bi bi-geo-alt"></i> {{ item.location || item.address }}
              </span>
              <span>·</span>
              <span class="d-flex align-items-center gap-1">
                <i class="bi bi-star-fill text-warning"></i> 
                {{ item.rating || '0.0' }} 
                <span class="text-muted">({{ item.reviews_count || 0 }})</span>
              </span>
              <span>·</span>
              <span class="badge bg-primary">{{ item.category }}</span>
              <span>·</span>
              <span class="fw-bold">{{ formatPrice(item.pricePerDay) }}/day</span>
              <template v-if="item.initialPrice">
                <span>·</span>
                <span class="text-muted">Initial: {{ formatPrice(item.initialPrice) }}</span>
              </template>
              <template v-if="item.deposit">
                <span>·</span>
                <span class="text-muted">Deposit: {{ formatPrice(item.deposit) }}</span>
              </template>
            </div>
            <div v-else class="row g-3">
              <div class="col-md-3">
                <label class="form-label small fw-bold">Category</label>
                <select v-model="editForm.category" class="form-select" :disabled="saving">
                  <option value="">Choose...</option>
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label small fw-bold">Location</label>
                <select v-model="editForm.location" class="form-select" :disabled="saving">
                  <option value="">Choose...</option>
                  <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label small fw-bold">Daily Price</label>
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
                <label class="form-label small fw-bold">Initial Price</label>
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
                <label class="form-label small fw-bold">Deposit</label>
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
                <label class="form-label small fw-bold">Currency</label>
                <select v-model="editForm.currency" class="form-select" :disabled="saving">
                  <option value="ILS">ILS (₪)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="d-flex gap-2 item-actions">
            <!-- Owner Actions -->
            <template v-if="isOwner">
              <button
                class="btn"
                :class="editMode ? 'btn-success' : 'btn-primary'"
                @click="toggleEditMode"
                title="Toggle edit mode"
                :disabled="saving"
              >
                <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                <i v-else class="bi" :class="editMode ? 'bi-check-lg' : 'bi-pencil'"></i>
                <span class="ms-1">{{ saving ? 'Saving...' : (editMode ? 'Save Changes' : 'Edit Listing') }}</span>
              </button>
              <button
                v-if="editMode"
                class="btn btn-outline-secondary"
                @click="cancelEdit"
                title="Cancel editing"
                :disabled="saving"
              >
                <i class="bi bi-x-lg"></i>
                <span class="d-none d-md-inline ms-1">Cancel</span>
              </button>
              <button
                v-if="editMode"
                class="btn"
                :class="(item?.isActive !== false && item?.active !== false) ? 'btn-outline-warning' : 'btn-outline-success'"
                @click="toggleActive"
                :title="(item?.isActive !== false && item?.active !== false) ? 'Deactivate listing' : 'Activate listing'"
                :disabled="saving || togglingActive"
              >
                <span v-if="togglingActive" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                <i v-else class="bi" :class="(item?.isActive !== false && item?.active !== false) ? 'bi-eye-slash' : 'bi-eye'"></i>
                <span class="d-none d-md-inline ms-1">{{ (item?.isActive !== false && item?.active !== false) ? 'Deactivate' : 'Activate' }}</span>
              </button>
              <button
                v-if="editMode"
                class="btn btn-outline-danger"
                @click="deleteItem"
                title="Delete listing"
                :disabled="saving || deleting"
              >
                <span v-if="deleting" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                <i v-else class="bi bi-trash"></i>
                <span class="d-none d-md-inline ms-1">Delete</span>
              </button>
            </template>
            
            <!-- Non-Owner Actions -->
            <template v-else>
              <!-- TODO: Booking functionality - Coming soon -->
              <button
                class="btn btn-primary"
                @click="showBookingModal"
                title="Book this item"
              >
                <i class="bi bi-calendar-check"></i>
                <span class="ms-1">Book Now</span>
              </button>
              
              <button
                class="btn btn-primary"
                @click="showOwnerModal"
                title="Message owner"
              >
                <i class="bi bi-chat-dots"></i>
                <span class="ms-1">Message Owner</span>
              </button>
              <button
                class="btn btn-outline-danger"
                type="button"
                title="Report"
              >
                <i class="bi bi-flag"></i>
                <span class="d-none d-md-inline ms-1">Report</span>
              </button>
            </template>
            
            <!-- Share button (always visible) -->
            <button
              class="btn btn-outline-secondary"
              @click="navigator.clipboard.writeText(location.href)"
              title="Share"
            >
              <i class="bi bi-share"></i>
              <span class="d-none d-md-inline ms-1">Share</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="row g-4">
        <!-- Main Content Column -->
        <div class="col-lg-8">
          <!-- Image Gallery (Non-Owners Only) -->
          <ImageGallery v-if="!isOwner" :photos="item.photos" />

          <!-- Description Card -->
          <div class="card p-3 p-md-4 mt-3 mt-md-4">
            <h2 class="h5 mb-3">About this item</h2>
            <p v-if="!editMode" class="mb-0 text-muted">{{ item.description }}</p>
            <div v-else>
              <label class="form-label small fw-bold">Description</label>
              <textarea 
                v-model="editForm.description" 
                class="form-control" 
                rows="6" 
                placeholder="Describe your item..."
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
  </div>
</template>

<style scoped>
.item-page {
  max-width: 1400px;
  margin: 0 auto;
}

.item-header {
  padding-bottom: 1.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.item-title {
  font-size: 2rem;
  font-weight: 700;
  color: #212529;
  margin: 0;
  line-height: 1.3;
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
  flex-wrap: wrap;
}

.item-actions .btn {
  white-space: nowrap;
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
  
  .item-meta {
    font-size: 0.875rem;
  }
  
  .item-header {
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .sidebar-content {
    position: static;
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

/* Mobile optimizations */
@media (max-width: 768px) {
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
    width: 100%;
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
}
</style>
