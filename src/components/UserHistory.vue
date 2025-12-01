<script setup>
import { ref, computed, onMounted } from 'vue';
import { fetchRentals } from '../services/rentalsService';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const history = ref([]);
const loading = ref(true);
const error = ref('');
const activeTab = ref('all'); // all, rents, lends

onMounted(async () => {
  await loadHistory();
});

async function loadHistory() {
  loading.value = true;
  error.value = '';
  
  try {
    // Load history from the new unified endpoint
    const historyData = await fetchRentals();
    history.value = historyData || [];
  } catch (err) {
    error.value = err.message || t('dashboard.failedToLoadHistory');
  } finally {
    loading.value = false;
  }
}

// Format all history items
const allHistory = computed(() => {
  return history.value.map(item => ({
    id: item.id,
    type: item.role === 'outgoing' ? 'rental' : 'lending',
    role: item.role,
    item: item.item,
    counterparty: item.counterparty,
    dateFrom: item.date_from,
    dateTo: item.date_to,
    total: item.total,
    status: item.status,
    createdAt: item.createdAt,
    isRental: item.role === 'outgoing', // outgoing = user rented, incoming = user lent
    duration: item.duration,
    dailyRate: item.dailyRate,
    reviews: item.reviews,
    paidAt: item.paidAt
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

// Filter history based on active tab
const filteredHistory = computed(() => {
  if (activeTab.value === 'all') return allHistory.value;
  if (activeTab.value === 'rents') return allHistory.value.filter(item => item.isRental); // User rented items
  if (activeTab.value === 'lends') return allHistory.value.filter(item => !item.isRental); // User lent items
  return allHistory.value;
});

function formatPrice(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  const formatter = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return formatter.format(amount / 100);
}

function formatPriceForBackend(amount) {
  // Convert display price to backend format (multiply by 100)
  return Math.round(amount * 100);
}

function formatDateRange(from, to) {
  const startDate = new Date(from);
  const endDate = new Date(to);
  
  const startFormatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short'
  }).format(startDate);
  
  const endFormatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short'
  }).format(endDate);
  
  return `${startFormatted} → ${endFormatted}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  }).format(date);
}

function getStatusBadgeClass(status) {
  const statusClasses = {
    'approved': 'bg-success',
    'requested': 'bg-warning text-dark',
    'pending': 'bg-warning text-dark',
    'confirmed': 'bg-success',
    'cancelled': 'bg-secondary',
    'completed': 'bg-primary',
    'active': 'bg-success',
    'PENDING': 'bg-warning text-dark',
    'CONFIRMED': 'bg-success',
    'CANCELLED': 'bg-secondary',
    'COMPLETED': 'bg-primary',
    'ACTIVE': 'bg-success',
    'PAID': 'bg-success',
    'REFUNDED': 'bg-info',
    'FAILED': 'bg-danger'
  };
  return statusClasses[status] || 'bg-secondary';
}

function getStatusText(status) {
  const statusKey = status?.toUpperCase() || status;
  const statusMap = {
    'APPROVED': t('dashboard.status.approved'),
    'REQUESTED': t('dashboard.status.requested'),
    'PENDING': t('dashboard.status.pending'),
    'CONFIRMED': t('dashboard.status.confirmed'),
    'CANCELLED': t('dashboard.status.cancelled'),
    'COMPLETED': t('dashboard.status.completed'),
    'ACTIVE': t('dashboard.status.active'),
    'PAID': t('dashboard.status.paid'),
    'REFUNDED': t('dashboard.status.refunded'),
    'FAILED': t('dashboard.status.failed')
  };
  return statusMap[statusKey] || status;
}

function getRoleText(role, isRental) {
  if (isRental) {
    return role === 'incoming' ? t('dashboard.lentTo') : t('dashboard.rentedFrom');
  }
  return t('dashboard.rented');
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="h6 mb-0">{{ t('dashboard.rentalHistory') }}</h3>
      <div class="btn-group btn-group-sm">
        <button 
          class="btn btn-outline-secondary" 
          :class="{ active: activeTab === 'all' }" 
          @click="activeTab = 'all'"
        >
          {{ t('dashboard.all') }}
        </button>
        <button 
          class="btn btn-outline-secondary" 
          :class="{ active: activeTab === 'rents' }" 
          @click="activeTab = 'rents'"
          data-testid="rents-tab"
        >
          <i class="bi bi-bag-check me-1"></i>{{ t('dashboard.rents') }}
        </button>
        <button 
          class="btn btn-outline-secondary" 
          :class="{ active: activeTab === 'lends' }" 
          @click="activeTab = 'lends'"
          data-testid="lends-tab"
        >
          <i class="bi bi-box-seam me-1"></i>{{ t('dashboard.lends') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-3">
      <div class="spinner-border spinner-border-sm" role="status"></div>
      <div class="small text-secondary mt-2">{{ t('dashboard.loadingHistory') }}</div>
    </div>

    <div v-else-if="error" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle me-2"></i>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="filteredHistory.length === 0" class="text-center py-4">
      <i class="bi bi-clock-history display-6 text-muted"></i>
      <div class="mt-2">
        <h6 class="text-muted">{{ t('dashboard.noHistoryYet', { tab: activeTab === 'all' ? t('dashboard.history') : activeTab }) }}</h6>
        <p class="small text-muted mb-0">
          {{ activeTab === 'all' ? t('dashboard.rentalHistoryWillAppearHere') : 
             activeTab === 'rents' ? t('dashboard.itemsYouveRentedWillAppearHere') : 
             t('dashboard.itemsYouveLentWillAppearHere') }}
        </p>
      </div>
    </div>

    <div v-else class="history-list">
      <div v-for="item in filteredHistory" :key="item.id" class="history-item border-bottom py-3">
        <div class="row g-3 align-items-center">
          <!-- Item Info -->
          <div class="col-md-6">
            <div class="d-flex align-items-start">
              <div class="me-3">
                <div class="bg-light rounded d-flex align-items-center justify-content-center overflow-hidden" 
                     style="width: 60px; height: 60px;">
                  <img 
                    v-if="item.item?.thumbnail" 
                    :src="item.item.thumbnail" 
                    :alt="item.item.title"
                    class="w-100 h-100"
                    style="object-fit: cover;"
                  />
                  <i v-else class="bi bi-box text-muted"></i>
                </div>
              </div>
              <div class="flex-grow-1">
                <h6 class="mb-1">{{ item.item?.title || t('item.item') }}</h6>
                <p class="small text-muted mb-1">
                  <i class="bi bi-geo-alt me-1"></i>
                  {{ item.item?.location || t('item.location') }}
                </p>
                <div class="d-flex flex-wrap gap-3 small text-secondary">
                  <div>
                    <i class="bi bi-calendar-event me-1"></i>
                    {{ formatDateRange(item.dateFrom, item.dateTo) }}
                  </div>
                  <div v-if="item.duration">
                    <i class="bi bi-clock me-1"></i>
                    {{ item.duration }} {{ t('item.day') }}{{ item.duration !== 1 ? t('item.s') : '' }}
                  </div>
                  <div v-if="item.dailyRate">
                    <i class="bi bi-currency-dollar me-1"></i>
                    {{ formatPrice(item.dailyRate) }}/{{ t('item.day') }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Role and Counterparty -->
          <div class="col-md-3">
            <div class="small">
              <div class="text-muted mb-1">
                <i class="bi bi-arrow-right me-1"></i>
                {{ getRoleText(item.role, item.isRental) }}
              </div>
              <div v-if="item.counterparty" class="fw-medium">
                {{ item.counterparty.username || item.counterparty.name }}
              </div>
              <div v-else class="text-muted">
                {{ item.isRental ? t('dashboard.rentalTransaction') : t('dashboard.lendingTransaction') }}
              </div>
            </div>
          </div>

          <!-- Status and Total -->
          <div class="col-md-3 text-md-end">
            <div class="mb-2">
              <span :class="getStatusBadgeClass(item.status)" class="badge">
                {{ getStatusText(item.status) }}
              </span>
            </div>
            <div class="fw-bold text-primary">
              {{ formatPrice(item.total) }}
            </div>
            <div class="small text-muted">
              {{ item.isRental ? t('dashboard.rental') : t('dashboard.lending') }}
            </div>
            <div v-if="item.paidAt" class="small text-success">
              <i class="bi bi-check-circle me-1"></i>
              {{ t('dashboard.paid') }} {{ formatDate(item.paidAt) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-item:last-child {
  border-bottom: none !important;
}

.history-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
  margin: 0 -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  border-radius: 0.375rem;
}

.badge {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
}

.btn-group-sm .btn {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

@media (max-width: 768px) {
  .card {
    padding: 0.75rem;
  }

  .history-item {
    padding: 0.75rem 0;
  }

  .history-item:hover {
    margin: 0 -0.25rem;
    padding-left: 0.25rem;
    padding-right: 0.25rem;
  }

  .row.g-3.align-items-center {
    row-gap: 0.5rem;
  }

  .col-md-6,
  .col-md-3 {
    flex: 0 0 100%;
    max-width: 100%;
  }

  .col-md-3 {
    margin-top: 0.25rem;
  }

  .text-md-end {
    text-align: left !important;
  }

  .btn-group-sm .btn {
    font-size: 0.8rem;
    padding-inline: 0.5rem;
  }

  .badge {
    font-size: 0.7rem;
    padding: 0.25rem 0.6rem;
  }
}
</style>
