<script setup>
import { ref, computed, watch } from 'vue';
import DatePicker from 'vue-datepicker-next';
import 'vue-datepicker-next/index.css';

const props = defineProps({
  itemId: { type: String, required: true },
  unavailableDates: { type: Array, default: () => [] }, // Array of date strings from backend
  availabilityData: { type: Object, default: () => ({}) }, // Full availability data with status
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update']);

// Convert unavailable dates from backend to Date objects
const blockedDates = computed(() => {
  return props.unavailableDates.map(dateStr => new Date(dateStr));
});

// Selected dates for blocking/unblocking
const selectedDates = ref([]);
const mode = ref('block'); // 'block' or 'unblock'

// Disable function for calendar
function disabledDate(date) {
  // Make past dates non-selectable
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Custom cell class for styling
function cellClassName(date) {
  const dateStr = formatDate(date);
  
  // Check if we have detailed availability data
  if (props.availabilityData[dateStr]) {
    const status = props.availabilityData[dateStr].status;
    if (status === 'booked') {
      return 'booked-date';
    } else if (status === 'blocked') {
      return 'blocked-date';
    }
  } else {
    // Fallback to simple unavailableDates array
    const isBlocked = props.unavailableDates.includes(dateStr);
    if (isBlocked) {
      return 'blocked-date';
    }
  }
  
  return '';
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function applyChanges() {
  if (!selectedDates.value || selectedDates.value.length === 0) {
    return;
  }

  const dates = Array.isArray(selectedDates.value) 
    ? selectedDates.value.map(formatDate)
    : [formatDate(selectedDates.value)];

  emit('update', {
    action: mode.value,
    dates: dates,
  });

  // Clear selection
  selectedDates.value = [];
}

function clearSelection() {
  selectedDates.value = [];
}
</script>

<template>
  <div class="availability-calendar">
    <div class="card">
      <div class="card-header bg-white">
        <h6 class="mb-0">
          <i class="bi bi-calendar3 me-2"></i>
          Availability Calendar
        </h6>
      </div>
      <div class="card-body">
        <p class="text-muted small mb-3">
          Select dates to block or unblock. Blocked dates (shown in red) won't be available for booking.
        </p>

        <!-- Mode selector -->
        <div class="btn-group w-100 mb-3" role="group">
          <input 
            type="radio" 
            class="btn-check" 
            id="block-mode" 
            v-model="mode" 
            value="block"
            :disabled="disabled"
          />
          <label class="btn btn-outline-danger" for="block-mode">
            <i class="bi bi-x-circle me-1"></i>
            Block Dates
          </label>

          <input 
            type="radio" 
            class="btn-check" 
            id="unblock-mode" 
            v-model="mode" 
            value="unblock"
            :disabled="disabled"
          />
          <label class="btn btn-outline-success" for="unblock-mode">
            <i class="bi bi-check-circle me-1"></i>
            Unblock Dates
          </label>
        </div>

        <!-- Calendar -->
        <div class="calendar-wrapper">
          <DatePicker
            v-model:value="selectedDates"
            :disabled="disabled"
            :disabled-date="disabledDate"
            :cell-class-name="cellClassName"
            range
            multiple
            inline
            :clearable="true"
          />
        </div>

        <!-- Legend -->
        <div class="d-flex flex-wrap gap-3 mt-3 small text-muted">
          <div class="d-flex align-items-center gap-1">
            <span class="legend-box bg-danger"></span>
            Blocked
          </div>
          <div class="d-flex align-items-center gap-1">
            <span class="legend-box bg-warning"></span>
            Booked
          </div>
          <div class="d-flex align-items-center gap-1">
            <span class="legend-box bg-success"></span>
            Available
          </div>
          <div class="d-flex align-items-center gap-1">
            <span class="legend-box bg-primary"></span>
            Selected
          </div>
        </div>

        <!-- Action buttons -->
        <div class="d-flex gap-2 mt-3">
          <button
            class="btn btn-primary flex-grow-1"
            :disabled="!selectedDates || selectedDates.length === 0 || disabled"
            @click="applyChanges"
          >
            <i class="bi me-1" :class="mode === 'block' ? 'bi-lock-fill' : 'bi-unlock-fill'"></i>
            {{ mode === 'block' ? 'Block Selected' : 'Unblock Selected' }}
          </button>
          <button
            class="btn btn-outline-secondary"
            :disabled="!selectedDates || selectedDates.length === 0 || disabled"
            @click="clearSelection"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.availability-calendar {
  margin-top: 1rem;
}

.calendar-wrapper {
  display: flex;
  justify-content: center;
}

.calendar-wrapper :deep(.mx-datepicker) {
  width: 100%;
}

.calendar-wrapper :deep(.mx-calendar) {
  width: 100%;
}

.calendar-wrapper :deep(.blocked-date) {
  background-color: #dc3545;
  color: white;
  border-radius: 4px;
}

.calendar-wrapper :deep(.blocked-date:hover) {
  background-color: #bb2d3b;
}

.calendar-wrapper :deep(.booked-date) {
  background-color: #ffc107;
  color: #000;
  border-radius: 4px;
}

.calendar-wrapper :deep(.booked-date:hover) {
  background-color: #ffb300;
}

.legend-box {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.card-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.125);
}
</style>

