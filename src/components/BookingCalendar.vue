<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DatePicker from 'vue-datepicker-next';
import 'vue-datepicker-next/index.css';
import OrderDetailsModal from './OrderDetailsModal.vue';
import { useUiStore } from '../stores/ui';
import http from '../lib/http';
import { Modal } from 'bootstrap';
import { fetchAllBookings } from '../services/bookingRequestService';

const { t } = useI18n();

const props = defineProps({
  itemId: { type: String, required: true },
  bookings: { type: Array, default: () => [] }, // Array of booking objects (optional, will fetch if not provided)
  loading: { type: Boolean, default: false },
  item: { type: Object, default: null }, // Item object with blockedDates property
});

const emit = defineEmits(['refresh', 'view-booking']);

const ui = useUiStore();
const router = useRouter();

// Internal state for fetched bookings
const fetchedBookings = ref([]);
const internalLoading = ref(false);

// Modal state
const showOrderModal = ref(false);
const selectedOrder = ref(null);

// Hover tooltip state
const hoveredDate = ref(null);
const hoveredBookings = ref([]);
const tooltipPosition = ref({ x: 0, y: 0 });

// Blocking modal state
const showBlockingModal = ref(false);
const editingBlockedDate = ref(null); // ID of blocked date being edited, null for new
const blockingForm = ref({
  startDate: '',
  endDate: '',
  reason: ''
});
const blockingLoading = ref(false);
const deletingBlockId = ref(null);
const showBlockedDatesList = ref(false);

// Current month being viewed
const currentMonth = ref(new Date());

// Week days - translated
const weekDays = computed(() => [
  t('calendar.weekDays.sun'),
  t('calendar.weekDays.mon'),
  t('calendar.weekDays.tue'),
  t('calendar.weekDays.wed'),
  t('calendar.weekDays.thu'),
  t('calendar.weekDays.fri'),
  t('calendar.weekDays.sat')
]);

// Get all bookings (from props or fetched)
const allBookings = computed(() => {
  // Use props.bookings if provided, otherwise use fetchedBookings
  const bookings = props.bookings.length > 0 ? props.bookings : fetchedBookings.value;
  
  // Filter bookings for this item and only confirmed/active bookings
  return bookings.filter(booking => {
    // Check if booking is for this item
    const bookingItemId = booking.itemId || booking.item?.id;
    if (bookingItemId !== props.itemId) return false;
    
    // Only show confirmed/active bookings as unavailable
    // Hide declined/cancelled bookings
    const status = booking.status;
    return status === 'CONFIRMED' || 
           status === 'AWAITING_PAYMENT' || 
           status === 'IN_PROGRESS' ||
           status === 'PAID' ||
           status === 'HANDED_OVER';
  });
});

// Computed property for blocked dates from item.blockedDates
const blockedDatesByDate = computed(() => {
  const blockedMap = {};
  const blockedDates = localBlockedDates.value;
  
  blockedDates.forEach(blockedRange => {
    // Handle the structure: { id, from, to, reason, createdAt, updatedAt }
    let from, to;
    
    if (blockedRange && typeof blockedRange === 'object') {
      // Object with from/to properties (the actual structure from backend)
      if (blockedRange.from && blockedRange.to) {
        from = blockedRange.from;
        to = blockedRange.to;
      } else if (typeof blockedRange === 'string') {
        // Single date string (fallback)
        from = to = blockedRange;
      } else {
        return;
      }
    } else if (typeof blockedRange === 'string') {
      // Single date string (fallback)
      from = to = blockedRange;
    } else {
      return;
    }
    
    // Parse dates (handle YYYY-MM-DD format)
    const start = new Date(from);
    const end = new Date(to);
    
    // Set time to midnight to avoid timezone issues
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    
    // Add all dates in the blocked range (inclusive)
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = formatDate(currentDate);
      blockedMap[dateStr] = {
        blocked: true,
        reason: blockedRange.reason || null,
        id: blockedRange.id || null
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  return blockedMap;
});

// Computed properties
const bookingsByDate = computed(() => {
  const bookingsMap = {};
  allBookings.value.forEach(booking => {
    // Handle both startDate/endDate and from/to formats
    const startDate = booking.startDate || booking.from || booking.start;
    const endDate = booking.endDate || booking.to || booking.end;
    
    if (!startDate || !endDate) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    
    // Add all dates in the booking range
    const currentDate = new Date(start);
    while (currentDate <= end) {
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

// Fetch bookings for the item
async function loadBookings() {
  // If bookings are provided via props, don't fetch
  if (props.bookings.length > 0) {
    return;
  }
  
  internalLoading.value = true;
  try {
    // Fetch all bookings and filter by itemId
    const response = await fetchAllBookings({
      limit: 100, // Get enough bookings to cover calendar
    });
    
    const bookings = response.bookings || response.items || response || [];
    
    // Filter bookings for this item
    fetchedBookings.value = bookings.filter(booking => {
      const bookingItemId = booking.itemId || booking.item?.id;
      return bookingItemId === props.itemId;
    });
  } catch (error) {
    console.error('Failed to fetch bookings for calendar:', error);
    ui.showToast('Failed to load bookings', 'danger');
    fetchedBookings.value = [];
  } finally {
    internalLoading.value = false;
  }
}

// Handle date click
function onDateClick(date) {
  const bookings = getBookingsForDate(date);
  if (bookings.length > 0) {
    // Redirect to booking list/dashboard instead of showing modal
    // Navigate to booking requests page
    router.push({ name: 'booking-requests' });
  }
}

// Handle date hover
function onDateHover(event, date) {
  const bookings = getBookingsForDate(date);
  if (bookings.length > 0) {
    hoveredDate.value = date;
    hoveredBookings.value = bookings;
    
    // Calculate tooltip position
    const rect = event.currentTarget.getBoundingClientRect();
    tooltipPosition.value = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    };
  }
}

// Handle date hover out
function onDateHoverOut() {
  hoveredDate.value = null;
  hoveredBookings.value = [];
}

// Show order details modal
function showOrderDetails(booking) {
  // Transform booking data to order format for the modal
  selectedOrder.value = {
    id: booking.id,
    itemId: props.itemId,
    renterId: booking.renterId || booking.renter?.id || booking.counterparty?.id,
    ownerId: booking.ownerId || booking.owner?.id,
    start: booking.startDate || booking.from || booking.start,
    end: booking.endDate || booking.to || booking.end,
    priceTotal: booking.totalAmount || booking.priceTotal || booking.total,
    currency: booking.currency || 'ILS',
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    item: booking.item,
    renter: booking.renter || booking.counterparty,
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

// Navigate to booking details page
function goToBookingDetails(booking) {
  if (!booking || !booking.id) return;
  router.push({
    name: 'booking-details',
    params: { bookingId: booking.id }
  });
}

// Show blocking modal (for new or edit)
function showBlockingForm(blockedDate = null) {
  editingBlockedDate.value = blockedDate ? blockedDate.id : null;
  
  if (blockedDate) {
    // Edit mode - populate form with existing data
    blockingForm.value = {
      startDate: blockedDate.from,
      endDate: blockedDate.to,
      reason: blockedDate.reason || ''
    };
  } else {
    // New mode - reset form
    blockingForm.value = {
      startDate: '',
      endDate: '',
      reason: ''
    };
  }
  
  // Close the blocked dates list modal
  showBlockedDatesList.value = false;
  
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
  editingBlockedDate.value = null;
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

// Submit blocking request (create or update)
async function submitBlocking() {
  if (!blockingForm.value.startDate || !blockingForm.value.endDate) {
    ui.showToast(t('calendar.errors.selectBothDates'), 'warning');
    return;
  }

  if (new Date(blockingForm.value.startDate) >= new Date(blockingForm.value.endDate)) {
    ui.showToast(t('calendar.errors.endDateAfterStart'), 'warning');
    return;
  }

  blockingLoading.value = true;

  try {
    // Format dates as YYYY-MM-DD strings
    const fromDate = new Date(blockingForm.value.startDate);
    const toDate = new Date(blockingForm.value.endDate);
    
    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
    
    let response;
    if (editingBlockedDate.value) {
      // Update existing blocked date
      response = await http.patch(`/items/${props.itemId}/calendar/block/${editingBlockedDate.value}`, {
        from,
        to,
        reason: blockingForm.value.reason || undefined
      });
      
      // Update in local array
      const index = localBlockedDates.value.findIndex(bd => bd.id === editingBlockedDate.value);
      if (index !== -1) {
        const updatedBlock = response.data || {
          id: editingBlockedDate.value,
          from,
          to,
          reason: blockingForm.value.reason || null
        };
        localBlockedDates.value[index] = updatedBlock;
      }
      
      ui.showToast(t('calendar.messages.blockedDateUpdated'), 'success');
    } else {
      // Create new blocked date
      response = await http.post(`/items/${props.itemId}/calendar/block`, {
        from,
        to,
        reason: blockingForm.value.reason || undefined
    });
      
      // Add to local array immediately
      const newBlock = response.data || {
        id: `temp-${Date.now()}`,
        from,
        to,
        reason: blockingForm.value.reason || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      localBlockedDates.value.push(newBlock);

    ui.showToast(t('calendar.messages.dateRangeBlocked'), 'success');
    }

    closeBlockingModal();
    emit('refresh', {
      month: currentMonth.value.toISOString().slice(0, 7), // YYYY-MM format
      itemId: props.itemId
    });
  } catch (error) {
    console.error('Failed to block date range:', error);
    ui.showToast(error?.response?.data?.message || t('calendar.messages.failedToBlock'), 'danger');
  } finally {
    blockingLoading.value = false;
  }
}

// Delete blocked date
async function deleteBlockedDate(blockedDateId) {
  if (!confirm(t('calendar.confirmDelete'))) {
    return;
  }

  deletingBlockId.value = blockedDateId;

  // Optimistically remove from UI
  const index = localBlockedDates.value.findIndex(bd => bd.id === blockedDateId);
  const removedBlock = index !== -1 ? { ...localBlockedDates.value[index] } : null;
  if (index !== -1) {
    localBlockedDates.value.splice(index, 1);
  }

  try {
    await http.delete(`/items/${props.itemId}/calendar/block/${blockedDateId}`);
    ui.showToast(t('calendar.messages.blockedDateDeleted'), 'success');
    emit('refresh', {
      month: currentMonth.value.toISOString().slice(0, 7),
      itemId: props.itemId
    });
  } catch (error) {
    // Revert optimistic update on error
    if (removedBlock && index !== -1) {
      localBlockedDates.value.splice(index, 0, removedBlock);
    }
    console.error('Failed to delete blocked date range:', error);
    ui.showToast(error?.response?.data?.message || t('calendar.messages.failedToDelete'), 'danger');
  } finally {
    deletingBlockId.value = null;
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
  // Only load bookings if not provided via props
  if (props.bookings.length === 0) {
    loadBookings();
  }
  // Always emit refresh to let parent know month changed
  emit('refresh', {
    month: currentMonth.value.toISOString().slice(0, 7), // YYYY-MM format
    itemId: props.itemId
  });
});

// Watch for itemId changes
watch(() => props.itemId, () => {
  loadBookings();
});

// Local copy of blocked dates for optimistic updates
const localBlockedDates = ref([]);

// Watch props.item.blockedDates and sync with local copy
watch(() => props.item?.blockedDates, (newBlockedDates) => {
  if (Array.isArray(newBlockedDates)) {
    localBlockedDates.value = [...newBlockedDates];
  } else {
    localBlockedDates.value = [];
  }
}, { immediate: true, deep: true });

// Computed property for active blocked dates (only future/current dates)
const activeBlockedDates = computed(() => {
  const blockedDates = localBlockedDates.value;
  if (!blockedDates || blockedDates.length === 0) {
    return [];
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return blockedDates.filter(blockedRange => {
    if (!blockedRange || !blockedRange.to) return false;
    const endDate = new Date(blockedRange.to);
    endDate.setHours(0, 0, 0, 0);
    // Only show if end date is today or in the future
    return endDate >= today;
  }).sort((a, b) => {
    // Sort by start date (earliest first)
    const aStart = new Date(a.from);
    const bStart = new Date(b.from);
    return aStart - bStart;
  });
});

// Statistics
const totalBookings = computed(() => allBookings.value.length);
const totalDaysBooked = computed(() => {
  const uniqueDates = new Set();
  allBookings.value.forEach(booking => {
    const startDate = booking.startDate || booking.from || booking.start;
    const endDate = booking.endDate || booking.to || booking.end;
    
    if (!startDate || !endDate) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      uniqueDates.add(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  return uniqueDates.size;
});

const currentMonthBookings = computed(() => {
  const monthStart = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1);
  const monthEnd = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 0);
  
  return allBookings.value.filter(booking => {
    const startDate = booking.startDate || booking.from || booking.start;
    const endDate = booking.endDate || booking.to || booking.end;
    
    if (!startDate || !endDate) return false;
    
    const bookingStart = new Date(startDate);
    const bookingEnd = new Date(endDate);
    
    if (Number.isNaN(bookingStart.getTime()) || Number.isNaN(bookingEnd.getTime())) return false;
    
    return (bookingStart <= monthEnd && bookingEnd >= monthStart);
  });
});

// Helper function to get customer name
function getCustomerName(booking) {
  // Check counterparty first (new API structure)
  if (booking.counterparty) {
    return booking.counterparty.displayName || 
           booking.counterparty.username || 
           booking.counterparty.name || 
           'Unknown Customer';
  }
  
  // Fallback to renter (old API structure)
  if (booking.renter) {
    if (booking.renter.firstName && booking.renter.lastName) {
      return `${booking.renter.firstName} ${booking.renter.lastName}`;
    } else if (booking.renter.username) {
      return booking.renter.username;
    } else if (booking.renter.displayName) {
      return booking.renter.displayName;
    } else if (booking.renter.email) {
      return booking.renter.email.split('@')[0];
    }
  }
  return booking.customerName || 'Unknown Customer';
}

// Format currency for display
function formatCurrency(amount, currency = 'ILS') {
  if (!amount && amount !== 0) return '';
  // Backend sends in cents
  const amountInCents = typeof amount === 'number' ? amount : parseInt(amount);
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
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
  
  const dateStr = formatDate(dateObj.date);
  
  // Check if this date is blocked (from item.blockedDates)
  const blockedInfo = blockedDatesByDate.value[dateStr];
  const isBlocked = blockedInfo && blockedInfo.blocked;
  
  // Check if this date has bookings
  const bookings = getBookingsForDate(dateObj.date);
  if (bookings.length > 0) {
    classes.push('has-bookings');
    
    // Check if it's a start date, end date, or middle date
    const isStartDate = bookings.some(booking => {
      const startDate = booking.startDate || booking.from || booking.start;
      if (!startDate) return false;
      return formatDate(new Date(startDate)) === dateStr;
    });
    const isEndDate = bookings.some(booking => {
      const endDate = booking.endDate || booking.to || booking.end;
      if (!endDate) return false;
      return formatDate(new Date(endDate)) === dateStr;
    });
    
    if (isStartDate && isEndDate) {
      classes.push('booking-single-day');
    } else if (isStartDate) {
      classes.push('booking-start');
    } else if (isEndDate) {
      classes.push('booking-end');
    } else {
      classes.push('booking-middle');
    }
  } else if (isBlocked) {
    // Blocked dates (no bookings, but blocked by owner)
    classes.push('blocked-date');
  } else if (dateObj.isCurrentMonth) {
    // Available dates in current month
    classes.push('available');
  }
  
  return classes;
}

onMounted(async () => {
  // Load bookings for the item (only if not provided via props)
  await loadBookings();
  
  // Don't emit refresh event on initial mount if bookings are already provided
  // This prevents duplicate requests when parent already loaded bookings
  // The parent (Item.vue) will handle initial loading
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
              {{ $t('calendar.title') }}
            </h5>
            <p class="calendar-subtitle">{{ $t('calendar.subtitle') }}</p>
          </div>
          <div class="header-actions">
            <button 
              class="btn btn-outline-warning btn-sm me-2"
              @click="showBlockedDatesList = !showBlockedDatesList"
              :disabled="loading"
            >
              <i class="bi bi-calendar-x me-1"></i>
              {{ showBlockedDatesList ? $t('calendar.hideBlockedDates') : $t('calendar.blockDates') }}
            </button>
            <button 
              class="btn btn-outline-primary btn-sm"
              @click="loadBookings"
              :disabled="loading || internalLoading"
            >
              <i class="bi bi-arrow-clockwise me-1" :class="{ 'spinning': loading || internalLoading }"></i>
              {{ $t('calendar.refresh') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="calendar-stats">
        <div class="stat-item">
          <div class="stat-value">{{ totalBookings }}</div>
          <div class="stat-label">{{ $t('calendar.totalBookings') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ totalDaysBooked }}</div>
          <div class="stat-label">{{ $t('calendar.daysBooked') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ currentMonthBookings.length }}</div>
          <div class="stat-label">{{ $t('calendar.thisMonth') }}</div>
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
              {{ $t('calendar.today') }}
            </button>
            <button 
              class="btn btn-sm btn-outline-primary"
              @click="goToOctober2025"
            >
              {{ $t('calendar.oct2025') }}
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
                @mouseenter="onDateHover($event, date.date)"
                @mouseleave="onDateHoverOut"
              >
                <div class="day-number">{{ date.day }}</div>
                <div v-if="getBookingsForDate(date.date).length > 0" class="day-bookings">
                  <span class="booking-indicator"></span>
                  <span v-if="getBookingsForDate(date.date).length > 1" class="booking-count">
                    {{ getBookingsForDate(date.date).length }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      <!-- Legend -->
      <!-- <div class="calendar-legend">
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
        <div class="legend-item">
          <span class="legend-color blocked-date"></span>
          <span>Blocked</span>
        </div>
      </div> -->

      <!-- Recent Bookings -->
      <div v-if="currentMonthBookings.length > 0" class="recent-bookings">
        <h6 class="bookings-title">{{ $t('calendar.bookingsThisMonth', { count: currentMonthBookings.length }) }}</h6>
        <div class="bookings-list">
          <div 
            v-for="booking in currentMonthBookings.slice(0, 5)" 
            :key="booking.id"
            class="booking-item"
            @click="goToBookingDetails(booking)"
          >
            <div class="booking-info">
              <div class="booking-dates">
                {{ formatDisplayDate(booking.startDate || booking.from || booking.start) }} - {{ formatDisplayDate(booking.endDate || booking.to || booking.end) }}
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
        <h6>{{ $t('calendar.noBookingsThisMonth') }}</h6>
        <p class="text-muted">{{ $t('calendar.noBookingsDescription') }}</p>
      </div>

      <!-- Blocked Dates Modal -->
      <div v-if="showBlockedDatesList" class="blocked-dates-modal-overlay" @click.self="showBlockedDatesList = false">
        <div class="blocked-dates-modal">
          <div class="blocked-dates-modal-header">
            <h5 class="blocked-dates-modal-title">
              <i class="bi bi-calendar-x me-2"></i>
              {{ $t('calendar.blockedDates', { count: activeBlockedDates.length }) }}
            </h5>
            <button 
              type="button"
              class="btn-close"
              @click="showBlockedDatesList = false"
              :aria-label="$t('common.close')"
            ></button>
          </div>
          
          <div class="blocked-dates-modal-body">
            <div class="d-flex justify-content-end mb-3">
              <button 
                class="btn btn-sm btn-warning"
                @click="showBlockingForm()"
              >
                <i class="bi bi-plus-circle me-1"></i>
                {{ $t('calendar.addBlock') }}
              </button>
            </div>
            
            <div v-if="activeBlockedDates.length === 0" class="text-muted text-center py-5">
              <i class="bi bi-calendar-check display-6 d-block mb-2"></i>
              <p class="mb-0">{{ $t('calendar.noActiveBlockedDates') }}</p>
            </div>
            
            <div v-else class="blocked-dates-list">
              <div 
                v-for="blockedDate in activeBlockedDates" 
                :key="blockedDate.id"
                class="blocked-date-item"
              >
                <div class="blocked-date-info">
                  <div class="blocked-date-range">
                    <i class="bi bi-calendar-range me-2"></i>
                    <strong>{{ formatDisplayDate(blockedDate.from) }} - {{ formatDisplayDate(blockedDate.to) }}</strong>
                  </div>
                  <div v-if="blockedDate.reason" class="blocked-date-reason text-muted small">
                    <i class="bi bi-chat-quote me-1"></i>
                    {{ blockedDate.reason }}
                  </div>
                </div>
                <div class="blocked-date-actions">
                  <button
                    class="btn btn-sm btn-outline-primary me-2"
                    @click="showBlockingForm(blockedDate)"
                    :disabled="blockingLoading"
                  >
                    <i class="bi bi-pencil"></i>
                    {{ $t('calendar.edit') }}
                  </button>
                  <button
                    class="btn btn-sm btn-outline-danger"
                    @click="deleteBlockedDate(blockedDate.id)"
                    :disabled="deletingBlockId === blockedDate.id"
                  >
                    <span v-if="deletingBlockId === blockedDate.id" class="spinner-border spinner-border-sm me-1"></span>
                    <i v-else class="bi bi-trash"></i>
                    {{ $t('calendar.delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Debug Section (remove in production) -->
    </div>
  </div>

  <!-- Booking Hover Tooltip -->
  <div
    v-if="hoveredDate && hoveredBookings.length > 0"
    class="booking-tooltip"
    :style="{
      left: tooltipPosition.x + 'px',
      top: tooltipPosition.y + 'px',
      transform: 'translateX(-50%) translateY(-100%)'
    }"
    @mouseenter.stop
    @mouseleave="onDateHoverOut"
  >
    <div class="tooltip-arrow"></div>
    <div class="tooltip-content">
      <div v-for="(booking, index) in hoveredBookings" :key="booking.id" class="tooltip-booking">
        <div class="tooltip-header">
          <strong>{{ getCustomerName(booking) }}</strong>
          <span class="badge badge-sm" :class="`bg-${getStatusColor(booking.status)}`">
            {{ booking.status }}
          </span>
        </div>
        <div class="tooltip-dates">
          <i class="bi bi-calendar3 me-1"></i>
          {{ formatDisplayDate(booking.startDate || booking.from || booking.start) }} - 
          {{ formatDisplayDate(booking.endDate || booking.to || booking.end) }}
        </div>
        <div v-if="booking.totalAmount || booking.priceTotal || booking.total" class="tooltip-price">
          <i class="bi bi-currency-dollar me-1"></i>
          {{ formatCurrency(booking.totalAmount || booking.priceTotal || booking.total, booking.currency || 'ILS') }}
        </div>
        <router-link
          :to="{ name: 'booking-checkout', params: { bookingId: booking.id } }"
          class="tooltip-link"
          @click.stop
        >
          <i class="bi bi-box-arrow-up-right me-1"></i>
          {{ $t('calendar.viewBookingDetails') }}
        </router-link>
        <div v-if="index < hoveredBookings.length - 1" class="tooltip-divider"></div>
      </div>
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
            {{ editingBlockedDate ? $t('calendar.editBlockedDateRange') : $t('calendar.blockDateRange') }}
          </h5>
          <button 
            type="button" 
            class="btn-close" 
            @click="closeBlockingModal"
            :aria-label="$t('common.close')"
          ></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitBlocking">
            <div class="mb-3">
              <label for="startDate" class="form-label">{{ $t('calendar.startDate') }}</label>
              <input 
                type="date" 
                class="form-control" 
                id="startDate"
                v-model="blockingForm.startDate"
                required
              >
            </div>
            <div class="mb-3">
              <label for="endDate" class="form-label">{{ $t('calendar.endDate') }}</label>
              <input 
                type="date" 
                class="form-control" 
                id="endDate"
                v-model="blockingForm.endDate"
                required
              >
            </div>
            <div class="mb-3">
              <label for="reason" class="form-label">{{ $t('calendar.reason') }}</label>
              <textarea 
                class="form-control" 
                id="reason"
                v-model="blockingForm.reason"
                rows="3"
                :placeholder="$t('calendar.reasonPlaceholder')"
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
            {{ $t('calendar.cancel') }}
          </button>
          <button 
            type="button" 
            class="btn btn-warning" 
            @click="submitBlocking"
            :disabled="blockingLoading || !blockingForm.startDate || !blockingForm.endDate"
          >
            <span v-if="blockingLoading" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-calendar-x me-1"></i>
            {{ blockingLoading ? (editingBlockedDate ? $t('calendar.updating') : $t('calendar.blocking')) : (editingBlockedDate ? $t('calendar.updateDates') : $t('calendar.blockDates')) }}
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
  position: relative;
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

/* Blocked Dates */
.calendar-day.blocked-date {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
}

.calendar-day.blocked-date .day-number {
  color: #92400e;
  font-weight: 600;
}

.calendar-day.blocked-date:hover {
  background: #fde68a;
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

.legend-color.blocked-date {
  background: #f59e0b;
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

/* Booking Tooltip */
.booking-tooltip {
  position: fixed;
  z-index: 1050;
  pointer-events: auto;
  margin-top: -8px;
}

.tooltip-arrow {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #1f2937;
}

.tooltip-content {
  background: #1f2937;
  color: white;
  border-radius: 8px;
  padding: 12px;
  min-width: 250px;
  max-width: 350px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.tooltip-booking {
  margin-bottom: 8px;
}

.tooltip-booking:last-child {
  margin-bottom: 0;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.tooltip-header strong {
  color: white;
  font-size: 14px;
}

.tooltip-header .badge {
  font-size: 10px;
  padding: 2px 6px;
}

.tooltip-dates,
.tooltip-price {
  font-size: 12px;
  color: #d1d5db;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
}

.tooltip-link {
  display: inline-flex;
  align-items: center;
  color: #60a5fa;
  text-decoration: none;
  font-size: 12px;
  margin-top: 6px;
  transition: color 0.2s;
}

.tooltip-link:hover {
  color: #93c5fd;
  text-decoration: underline;
}

.tooltip-divider {
  height: 1px;
  background: #374151;
  margin: 8px 0;
}

/* Dark Mode */
:global([data-bs-theme="dark"]) .booking-calendar .card {
  background: #1f1f1f;
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .calendar-stats {
  background: #343a40;
}

:global([data-bs-theme="dark"]) .stat-item {
  background: #1f1f1f;
}

:global([data-bs-theme="dark"]) .stat-value {
  color: #f1f3f5;
}

:global([data-bs-theme="dark"]) .stat-label {
  color: #adb5bd;
}

:global([data-bs-theme="dark"]) .month-navigation {
  background: #232323;
  border-bottom-color: #343a40;
}

:global([data-bs-theme="dark"]) .nav-btn {
  background: #1f1f1f;
  border-color: #343a40;
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .nav-btn:hover:not(:disabled) {
  border-color: #8ab4ff;
  background: #2b2b2b;
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .month-title {
  color: #f1f3f5;
}

:global([data-bs-theme="dark"]) .calendar-container {
  background: #1f1f1f;
}

:global([data-bs-theme="dark"]) .custom-calendar {
  border-color: #343a40;
}

:global([data-bs-theme="dark"]) .calendar-header-row {
  background: #232323;
  border-bottom-color: #343a40;
}

:global([data-bs-theme="dark"]) .day-header {
  color: #ced4da;
  border-right-color: #343a40;
}

:global([data-bs-theme="dark"]) .calendar-day {
  border-right-color: #343a40;
  border-bottom-color: #343a40;
}

:global([data-bs-theme="dark"]) .calendar-day:hover {
  background: #2b2b2b;
}

:global([data-bs-theme="dark"]) .day-number {
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .calendar-day.other-month {
  background: #232323;
  color: #6c757d;
}

:global([data-bs-theme="dark"]) .calendar-day.other-month .day-number {
  color: #6c757d;
}

:global([data-bs-theme="dark"]) .calendar-day.today {
  background: #1d2b3a;
  border-color: #3b82f6;
}

:global([data-bs-theme="dark"]) .calendar-day.today .day-number {
  color: #8ab4ff;
}

:global([data-bs-theme="dark"]) .calendar-day.available {
  background: #0f2f27;
  border-left-color: #10b981;
}

:global([data-bs-theme="dark"]) .calendar-day.available .day-number {
  color: #34d399;
}

:global([data-bs-theme="dark"]) .calendar-day.available:hover {
  background: #123a30;
}

:global([data-bs-theme="dark"]) .calendar-day.has-bookings {
  background: #2b1414;
  border-left-color: #dc2626;
}

:global([data-bs-theme="dark"]) .calendar-day.has-bookings .day-number {
  color: #f87171;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-start {
  background: linear-gradient(135deg, #2b1414 0%, #3a1b1b 100%);
  border-left-color: #dc2626;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-start .day-number {
  color: #f87171;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-middle {
  background: linear-gradient(135deg, #3a1b1b 0%, #4a1f1f 100%);
  border-left-color: #ef4444;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-middle .day-number {
  color: #fca5a5;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-end {
  background: linear-gradient(135deg, #2b1414 0%, #3a1b1b 100%);
  border-left-color: #dc2626;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-end .day-number {
  color: #f87171;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-single-day {
  background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%);
  border-left-color: #991b1b;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-single-day .day-number {
  color: #fff5f5;
}

:global([data-bs-theme="dark"]) .calendar-day.booking-single-day .booking-indicator {
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

:global([data-bs-theme="dark"]) .calendar-day.blocked-date {
  background: #3b2a08;
  border-left-color: #f59e0b;
}

:global([data-bs-theme="dark"]) .calendar-day.blocked-date .day-number {
  color: #fbbf24;
}

:global([data-bs-theme="dark"]) .calendar-day.blocked-date:hover {
  background: #4a340a;
}

:global([data-bs-theme="dark"]) .calendar-legend {
  background: #232323;
  border-top-color: #343a40;
}

:global([data-bs-theme="dark"]) .legend-item {
  color: #ced4da;
}

:global([data-bs-theme="dark"]) .recent-bookings {
  background: #1f1f1f;
  border-top-color: #343a40;
}

:global([data-bs-theme="dark"]) .bookings-title {
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .booking-item {
  background: #232323;
  border-color: #343a40;
}

:global([data-bs-theme="dark"]) .booking-item:hover {
  background: #2b2b2b;
  border-color: #495057;
}

:global([data-bs-theme="dark"]) .booking-dates {
  color: #f1f3f5;
}

:global([data-bs-theme="dark"]) .booking-customer {
  color: #adb5bd;
}

:global([data-bs-theme="dark"]) .empty-state {
  background: #1f1f1f;
  color: #adb5bd;
}

:global([data-bs-theme="dark"]) .empty-state h6 {
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .empty-icon {
  color: #495057;
}

:global([data-bs-theme="dark"]) .debug-section {
  background: #232323;
  border-top-color: #343a40;
  color: #adb5bd;
}

:global([data-bs-theme="dark"]) .debug-section pre {
  background: #1f1f1f;
  color: #ced4da;
}

:global([data-bs-theme="dark"]) .blocked-dates-modal {
  background: #1f1f1f;
  color: #e9ecef;
}

:global([data-bs-theme="dark"]) .blocked-dates-modal-overlay {
  background: rgba(0, 0, 0, 0.65);
}

/* Blocked Dates Modal */
.blocked-dates-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.blocked-dates-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  max-width: 700px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.blocked-dates-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px 12px 0 0;
}

.blocked-dates-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #92400e;
  margin: 0;
}

.blocked-dates-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.blocked-dates-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blocked-date-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.blocked-date-item:hover {
  background: #fde68a;
  border-color: #d97706;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
}

.blocked-date-info {
  flex-grow: 1;
}

.blocked-date-range {
  font-size: 14px;
  color: #92400e;
  margin-bottom: 4px;
}

.blocked-date-reason {
  font-size: 12px;
  color: #78350f;
  margin-top: 4px;
}

.blocked-date-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .blocked-date-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .blocked-date-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
