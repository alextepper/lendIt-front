<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import DatePicker from 'vue-datepicker-next';
import 'vue-datepicker-next/index.css';
import OrderDetailsModal from './OrderDetailsModal.vue';
import { useUiStore } from '../stores/ui';
import http from '../lib/http';
import { Modal } from 'bootstrap';

const props = defineProps({
  itemId: { type: String, required: true },
  bookings: { type: Array, default: () => [] }, // Array of booking objects
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['refresh', 'view-booking']);

const ui = useUiStore();

// Modal state
const showOrderModal = ref(false);
const selectedOrder = ref(null);

// Blocking modal state
const showBlockingModal = ref(false);
const blockingForm = ref({
  startDate: '',
  endDate: '',
  reason: ''
});
const blockingLoading = ref(false);

// Current month being viewed
const currentMonth = ref(new Date());

// Week days
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Computed properties
const bookingsByDate = computed(() => {
  const bookingsMap = {};
  props.bookings.forEach(booking => {
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);
    
    // Add all dates in the booking range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      if (!bookingsMap[dateStr]) {
        bookingsMap[dateStr] = [];
      }
      bookingsMap[dateStr].push(booking);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  return bookingsMap;
});

// Calendar cell class names
function cellClassName(date) {
  const dateStr = formatDate(date);
  const dayBookings = bookingsByDate.value[dateStr];
  
  if (dayBookings && dayBookings.length > 0) {
    // Check if it's a start or end date
    const isStartDate = dayBookings.some(booking => 
      formatDate(new Date(booking.startDate)) === dateStr
    );
    const isEndDate = dayBookings.some(booking => 
      formatDate(new Date(booking.endDate)) === dateStr
    );
    
    if (isStartDate && isEndDate) {
      return 'booking-single-day';
    } else if (isStartDate) {
      return 'booking-start';
    } else if (isEndDate) {
      return 'booking-end';
    } else {
      return 'booking-middle';
    }
  }
  
  return '';
}

// Calendar cell content
function cellContent(date) {
  const dateStr = formatDate(date);
  const dayBookings = bookingsByDate.value[dateStr];
  
  if (dayBookings && dayBookings.length > 0) {
    return dayBookings.length > 1 ? `${dayBookings.length}` : '';
  }
  
  return '';
}

// Format date to YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date for display
function formatDisplayDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Get bookings for a specific date
function getBookingsForDate(date) {
  const dateStr = formatDate(date);
  return bookingsByDate.value[dateStr] || [];
}

// Handle date click
function onDateClick(date) {
  const bookings = getBookingsForDate(date);
  if (bookings.length > 0) {
    // Show the first booking's order details
    showOrderDetails(bookings[0]);
  }
}

// Show order details modal
function showOrderDetails(booking) {
  // Transform booking data to order format for the modal
  selectedOrder.value = {
    id: booking.id,
    itemId: props.itemId,
    renterId: booking.renter?.id,
    ownerId: booking.owner?.id,
    start: booking.startDate,
    end: booking.endDate,
    priceTotal: booking.priceTotal,
    currency: booking.currency,
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    item: booking.item,
    renter: booking.renter,
    owner: booking.owner
  };
  showOrderModal.value = true;
}

// Close order modal
function closeOrderModal() {
  showOrderModal.value = false;
  selectedOrder.value = null;
}

// Handle order update
function handleOrderUpdate() {
  // Emit refresh to reload bookings
  emit('refresh');
  closeOrderModal();
}

// Show blocking modal
function showBlockingForm() {
  showBlockingModal.value = true;
  
  // Use Bootstrap Modal
  const modalEl = document.getElementById('blockingModal');
  if (modalEl) {
    const modal = new Modal(modalEl);
    modal.show();
  }
}


// Close blocking modal
function closeBlockingModal() {
  showBlockingModal.value = false;
  blockingForm.value = {
    startDate: '',
    endDate: '',
    reason: ''
  };
  
  // Use Bootstrap Modal
  const modalEl = document.getElementById('blockingModal');
  if (modalEl) {
    const modal = Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

// Submit blocking request
async function submitBlocking() {
  if (!blockingForm.value.startDate || !blockingForm.value.endDate) {
    ui.showToast('Please select both start and end dates', 'warning');
    return;
  }

  if (new Date(blockingForm.value.startDate) >= new Date(blockingForm.value.endDate)) {
    ui.showToast('End date must be after start date', 'warning');
    return;
  }

  blockingLoading.value = true;

  try {
    const response = await http.post('/orders/blocking', {
      itemId: props.itemId,
      start: new Date(blockingForm.value.startDate).toISOString(),
      end: new Date(blockingForm.value.endDate).toISOString(),
      blockingReason: blockingForm.value.reason || undefined
    });

    ui.showToast('Date range blocked successfully', 'success');
    closeBlockingModal();
    emit('refresh');
  } catch (error) {
    console.error('Failed to block date range:', error);
    ui.showToast(error?.response?.data?.message || 'Failed to block date range', 'danger');
  } finally {
    blockingLoading.value = false;
  }
}

// Navigation
function previousMonth() {
  const newMonth = new Date(currentMonth.value);
  newMonth.setMonth(newMonth.getMonth() - 1);
  currentMonth.value = newMonth;
}

function nextMonth() {
  const newMonth = new Date(currentMonth.value);
  newMonth.setMonth(newMonth.getMonth() + 1);
  currentMonth.value = newMonth;
}

function goToToday() {
  currentMonth.value = new Date();
}

function goToOctober2025() {
  currentMonth.value = new Date(2025, 9, 1); // October 2025 (month is 0-indexed)
}

// Watch for month changes to refresh data
watch(currentMonth, () => {
  emit('refresh', {
    month: currentMonth.value.toISOString().slice(0, 7), // YYYY-MM format
    itemId: props.itemId
  });
});

// Statistics
const totalBookings = computed(() => props.bookings.length);
const totalDaysBooked = computed(() => {
  const uniqueDates = new Set();
  props.bookings.forEach(booking => {
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      uniqueDates.add(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  return uniqueDates.size;
});

const currentMonthBookings = computed(() => {
  const monthStart = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1);
  const monthEnd = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 0);
  
  return props.bookings.filter(booking => {
    const bookingStart = new Date(booking.startDate);
    const bookingEnd = new Date(booking.endDate);
    return (bookingStart <= monthEnd && bookingEnd >= monthStart);
  });
});

// Helper function to get customer name
function getCustomerName(booking) {
  if (booking.renter) {
    if (booking.renter.firstName && booking.renter.lastName) {
      return `${booking.renter.firstName} ${booking.renter.lastName}`;
    } else if (booking.renter.username) {
      return booking.renter.username;
    } else if (booking.renter.email) {
      return booking.renter.email.split('@')[0];
    }
  }
  return booking.customerName || 'Unknown Customer';
}

// Generate calendar dates for the current month
const calendarDates = computed(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  
  // Get first day of month and last day of month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Get first day of week (0 = Sunday)
  const firstDayOfWeek = firstDay.getDay();
  
  // Get last day of month
  const lastDayOfMonth = lastDay.getDate();
  
  const dates = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevMonth = new Date(year, month, 1 - firstDayOfWeek + i);
    dates.push({
      date: prevMonth,
      day: prevMonth.getDate(),
      key: `prev-${prevMonth.getTime()}`,
      isCurrentMonth: false,
      isToday: false
    });
  }
  
  // Add days of the current month
  for (let day = 1; day <= lastDayOfMonth; day++) {
    const date = new Date(year, month, day);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    dates.push({
      date: date,
      day: day,
      key: `current-${date.getTime()}`,
      isCurrentMonth: true,
      isToday: isToday
    });
  }
  
  // Add empty cells to complete the last week
  const remainingCells = 42 - dates.length; // 6 weeks * 7 days = 42 cells
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonth = new Date(year, month + 1, i);
    dates.push({
      date: nextMonth,
      day: i,
      key: `next-${nextMonth.getTime()}`,
      isCurrentMonth: false,
      isToday: false
    });
  }
  
  return dates;
});

// Get CSS classes for each day
function getDayClasses(dateObj) {
  const classes = [];
  
  if (!dateObj.isCurrentMonth) {
    classes.push('other-month');
  }
  
  if (dateObj.isToday) {
    classes.push('today');
  }
  
  // Check if this date has bookings
  const bookings = getBookingsForDate(dateObj.date);
  if (bookings.length > 0) {
    classes.push('has-bookings');
    
    // Check if it's a start date, end date, or middle date
    const dateStr = formatDate(dateObj.date);
    const isStartDate = bookings.some(booking => 
      formatDate(new Date(booking.startDate)) === dateStr
    );
    const isEndDate = bookings.some(booking => 
      formatDate(new Date(booking.endDate)) === dateStr
    );
    
    if (isStartDate && isEndDate) {
      classes.push('booking-single-day');
    } else if (isStartDate) {
      classes.push('booking-start');
    } else if (isEndDate) {
      classes.push('booking-end');
    } else {
      classes.push('booking-middle');
    }
  } else if (dateObj.isCurrentMonth) {
    // Available dates in current month
    classes.push('available');
  }
  
  return classes;
}

onMounted(() => {
  // Load initial data
  emit('refresh', {
    month: currentMonth.value.toISOString().slice(0, 7),
    itemId: props.itemId
  });
});

onUnmounted(() => {
  // Clean up if needed
});

// Debug logging
watch(() => props.bookings, (newBookings) => {
  console.log('Bookings updated:', newBookings);
  console.log('Bookings by date:', bookingsByDate.value);
  console.log('Current month:', currentMonth.value);
}, { immediate: true });

// Debug current month
watch(() => currentMonth.value, (newMonth) => {
  console.log('Current month changed to:', newMonth);
}, { immediate: true });
</script>

<template>
  <div class="booking-calendar">
    <div class="card">
      <!-- Header -->
      <div class="calendar-header">
        <div class="header-content">
          <div class="header-info">
            <h5 class="calendar-title">
              <i class="bi bi-calendar-check me-2"></i>
              Booking Calendar
            </h5>
            <p class="calendar-subtitle">View all bookings and taken dates for this item</p>
          </div>
          <div class="header-actions">
            <button 
              class="btn btn-outline-warning btn-sm me-2"
              @click="showBlockingForm"
              :disabled="loading"
            >
              <i class="bi bi-calendar-x me-1"></i>
              Block Dates
            </button>
            <button 
              class="btn btn-outline-primary btn-sm"
              @click="emit('refresh', { month: currentMonth.toISOString().slice(0, 7), itemId })"
              :disabled="loading"
            >
              <i class="bi bi-arrow-clockwise me-1" :class="{ 'spinning': loading }"></i>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="calendar-stats">
        <div class="stat-item">
          <div class="stat-value">{{ totalBookings }}</div>
          <div class="stat-label">Total Bookings</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ totalDaysBooked }}</div>
          <div class="stat-label">Days Booked</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ currentMonthBookings.length }}</div>
          <div class="stat-label">This Month</div>
        </div>
      </div>

      <!-- Month Navigation -->
      <div class="month-navigation">
        <button 
          class="nav-btn"
          @click="previousMonth"
          :disabled="loading"
        >
          <i class="bi bi-chevron-left"></i>
        </button>
        
        <div class="month-display">
          <h6 class="month-title">{{ currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}</h6>
          <div class="month-buttons">
            <button 
              class="btn btn-sm btn-outline-secondary me-2"
              @click="goToToday"
            >
              Today
            </button>
            <button 
              class="btn btn-sm btn-outline-primary"
              @click="goToOctober2025"
            >
              Oct 2025
            </button>
          </div>
        </div>
        
        <button 
          class="nav-btn"
          @click="nextMonth"
          :disabled="loading"
        >
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>

        <!-- Custom Month Calendar -->
        <div class="calendar-container">
          <div class="custom-calendar">
            <!-- Calendar Header -->
            <div class="calendar-header-row">
              <div class="day-header" v-for="day in weekDays" :key="day">
                {{ day }}
              </div>
            </div>
            
            <!-- Calendar Body -->
            <div class="calendar-body">
              <div 
                v-for="date in calendarDates" 
                :key="date.key"
                class="calendar-day"
                :class="getDayClasses(date)"
                @click="onDateClick(date.date)"
              >
                <div class="day-number">{{ date.day }}</div>
                <div v-if="getBookingsForDate(date.date).length > 0" class="day-bookings">
                  <span class="booking-indicator"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

      <!-- Legend -->
      <div class="calendar-legend">
        <div class="legend-item">
          <span class="legend-color available"></span>
          <span>Available</span>
        </div>
        <div class="legend-item">
          <span class="legend-color booking-start"></span>
          <span>Booking Start</span>
        </div>
        <div class="legend-item">
          <span class="legend-color booking-middle"></span>
          <span>Booking Middle</span>
        </div>
        <div class="legend-item">
          <span class="legend-color booking-end"></span>
          <span>Booking End</span>
        </div>
        <div class="legend-item">
          <span class="legend-color booking-single-day"></span>
          <span>Single Day</span>
        </div>
        <div class="legend-item">
          <span class="legend-color today"></span>
          <span>Today</span>
        </div>
      </div>

      <!-- Recent Bookings -->
      <div v-if="currentMonthBookings.length > 0" class="recent-bookings">
        <h6 class="bookings-title">Bookings This Month ({{ currentMonthBookings.length }})</h6>
        <div class="bookings-list">
          <div 
            v-for="booking in currentMonthBookings.slice(0, 5)" 
            :key="booking.id"
            class="booking-item"
            @click="showOrderDetails(booking)"
          >
            <div class="booking-info">
              <div class="booking-dates">
                {{ formatDisplayDate(booking.startDate) }} - {{ formatDisplayDate(booking.endDate) }}
              </div>
              <div class="booking-customer">
                <i class="bi bi-person me-1"></i>
                {{ getCustomerName(booking) }}
              </div>
            </div>
            <div class="booking-status">
              <span class="badge" :class="`bg-${getStatusColor(booking.status)}`">
                {{ booking.status }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading" class="empty-state">
        <i class="bi bi-calendar-x empty-icon"></i>
        <h6>No Bookings This Month</h6>
        <p class="text-muted">This item has no bookings for the selected month.</p>
      </div>

      <!-- Debug Section (remove in production) -->
    </div>
  </div>

  <!-- Order Details Modal -->
  <OrderDetailsModal
    v-if="showOrderModal && selectedOrder"
    :order="selectedOrder"
    @close="closeOrderModal"
    @updated="handleOrderUpdate"
  />

  <!-- Blocking Modal -->
  <div 
    v-if="showBlockingModal" 
    class="modal fade" 
    id="blockingModal" 
    tabindex="-1"
    role="dialog"
    aria-labelledby="blockingModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="blockingModalLabel">
            <i class="bi bi-calendar-x me-2"></i>
            Block Date Range
          </h5>
          <button 
            type="button" 
            class="btn-close" 
            @click="closeBlockingModal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitBlocking">
            <div class="mb-3">
              <label for="startDate" class="form-label">Start Date</label>
              <input 
                type="date" 
                class="form-control" 
                id="startDate"
                v-model="blockingForm.startDate"
                required
              >
            </div>
            <div class="mb-3">
              <label for="endDate" class="form-label">End Date</label>
              <input 
                type="date" 
                class="form-control" 
                id="endDate"
                v-model="blockingForm.endDate"
                required
              >
            </div>
            <div class="mb-3">
              <label for="reason" class="form-label">Reason (Optional)</label>
              <textarea 
                class="form-control" 
                id="reason"
                v-model="blockingForm.reason"
                rows="3"
                placeholder="e.g., Maintenance period, Personal use, etc."
              ></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-secondary" 
            @click="closeBlockingModal"
            :disabled="blockingLoading"
          >
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-warning" 
            @click="submitBlocking"
            :disabled="blockingLoading || !blockingForm.startDate || !blockingForm.endDate"
          >
            <span v-if="blockingLoading" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-calendar-x me-1"></i>
            {{ blockingLoading ? 'Blocking...' : 'Block Dates' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// Helper function for status colors
function getStatusColor(status) {
  const colors = {
    'PENDING': 'warning',
    'PAID': 'success',
    'HANDED_OVER': 'primary',
    'RETURNED': 'info',
    'CANCELLED': 'danger',
    'CONFIRMED': 'success',
    'COMPLETED': 'info',
    'IN_PROGRESS': 'primary'
  };
  return colors[status] || 'secondary';
}
</script>

<style scoped>
.booking-calendar {
  margin-top: 1rem;
}

.card {
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  overflow: hidden;
}

/* Header */
.calendar-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.calendar-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.calendar-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.calendar-subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin: 4px 0 0 0;
}

/* Statistics */
.calendar-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: #e2e8f0;
  margin: 0;
}

.stat-item {
  background: white;
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

/* Month Navigation */
.month-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover:not(:disabled) {
  border-color: #667eea;
  background: #667eea;
  color: white;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.month-display {
  text-align: center;
}

.month-title {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 8px 0;
}

.month-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* Custom Calendar */
.calendar-container {
  padding: 24px;
  background: white;
}

.custom-calendar {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.calendar-header-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.day-header {
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  color: #4a5568;
  border-right: 1px solid #e2e8f0;
}

.day-header:last-child {
  border-right: none;
}

.calendar-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
}

.calendar-day {
  min-height: 60px;
  padding: 8px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
}

.calendar-day:nth-child(7n) {
  border-right: none;
}

.calendar-day:hover {
  background: #f7fafc;
}

.day-number {
  font-size: 14px;
  font-weight: 500;
  color: #2d3748;
  margin-bottom: 4px;
}

.day-bookings {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
}

.booking-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #dc2626;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
}

/* Day States */
.calendar-day.other-month {
  background: #f8f9fa;
  color: #adb5bd;
}

.calendar-day.other-month .day-number {
  color: #adb5bd;
}

.calendar-day.today {
  background: #e3f2fd;
  border: 2px solid #2196f3;
}

.calendar-day.today .day-number {
  color: #1976d2;
  font-weight: 700;
}

.calendar-day.available {
  background: #f0f9ff;
  border-left: 4px solid #10b981;
}

.calendar-day.available .day-number {
  color: #059669;
  font-weight: 600;
}

.calendar-day.available:hover {
  background: #e0f2fe;
}

/* Booking States */
.calendar-day.has-bookings {
  background: #fef2f2;
  border-left: 4px solid #dc2626;
}

.calendar-day.has-bookings .day-number {
  color: #dc2626;
  font-weight: 700;
}

.calendar-day.booking-start {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-left: 4px solid #dc2626;
}

.calendar-day.booking-start .day-number {
  color: #dc2626;
  font-weight: 700;
}

.calendar-day.booking-middle {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-left: 4px solid #ef4444;
}

.calendar-day.booking-middle .day-number {
  color: #ef4444;
  font-weight: 600;
}

.calendar-day.booking-end {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-left: 4px solid #dc2626;
}

.calendar-day.booking-end .day-number {
  color: #dc2626;
  font-weight: 700;
}

.calendar-day.booking-single-day {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-left: 4px solid #991b1b;
}

.calendar-day.booking-single-day .day-number {
  color: white;
  font-weight: 700;
}

.calendar-day.booking-single-day .booking-indicator {
  background: white;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}


/* Legend */
.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 20px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #4a5568;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.legend-color.available {
  background: #10b981;
}

.legend-color.booking-start,
.legend-color.booking-end {
  background: #dc2626;
}

.legend-color.booking-middle {
  background: #ef4444;
}

.legend-color.booking-single-day {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.legend-color.today {
  background: #2196f3;
}

/* Recent Bookings */
.recent-bookings {
  padding: 24px;
  background: white;
  border-top: 1px solid #e2e8f0;
}

.bookings-title {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 16px;
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.booking-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.booking-item:hover {
  background: #edf2f7;
  border-color: #cbd5e0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.booking-dates {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.booking-customer {
  font-size: 14px;
  color: #718096;
}

.booking-status {
  flex-shrink: 0;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: white;
}

.empty-icon {
  font-size: 48px;
  color: #cbd5e0;
  margin-bottom: 16px;
}

.empty-state h6 {
  color: #4a5568;
  margin-bottom: 8px;
}

/* Loading Animation */
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Debug Section */
.debug-section {
  padding: 16px;
  background: #f8f9fa;
  border-top: 1px solid #e2e8f0;
  font-size: 12px;
}

.debug-section pre {
  background: #e9ecef;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
  font-size: 10px;
}

/* Blocking Modal Styles */

.modal-header {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-bottom: 1px solid #f59e0b;
}

.modal-title {
  color: #92400e;
  font-weight: 600;
}

.btn-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: none;
  color: white;
  font-weight: 500;
}

.btn-warning:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-warning:disabled {
  background: #9ca3af;
  transform: none;
  box-shadow: none;
}

.form-control:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 0.2rem rgba(245, 158, 11, 0.25);
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .calendar-stats {
    grid-template-columns: 1fr;
  }
  
  .calendar-legend {
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .booking-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .booking-status {
    align-self: flex-end;
  }
  
  .calendar-day {
    min-height: 50px;
    padding: 6px;
  }
  
  .day-number {
    font-size: 12px;
  }
  
  .booking-indicator {
    width: 4px;
    height: 4px;
  }
  
  .day-header {
    padding: 8px 4px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .calendar-container {
    padding: 16px;
  }
  
  .calendar-day {
    min-height: 45px;
    padding: 4px;
  }
  
  .day-number {
    font-size: 11px;
  }
  
  .month-buttons {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
