<script setup>
import { ref, computed, onMounted } from 'vue';
import { Modal } from 'bootstrap';
import { useI18n } from 'vue-i18n';
import { fetchOrders } from '../services/orderService';
import { useAuthStore } from '../stores/auth';
import OrderDetailsModal from './OrderDetailsModal.vue';
import { getImageUrl } from '../utils/imageUtils';

const props = defineProps({
  role: { type: String, default: 'renter' }, // 'renter' or 'owner'
});

const auth = useAuthStore();
const { t, locale } = useI18n();
const orders = ref([]);
const loading = ref(true);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const totalPages = ref(1);
let loadPromise = null;
const selectedOrder = ref(null);
const activeFilter = ref('all'); // 'all', 'PENDING', 'PAID', 'HANDED_OVER', 'RETURNED', 'CANCELLED'

const filteredOrders = computed(() => {
  if (activeFilter.value === 'all') return orders.value;
  return orders.value.filter(o => o.status === activeFilter.value);
});

const statusCounts = computed(() => {
  const counts = { all: orders.value.length };
  orders.value.forEach(o => {
    counts[o.status] = (counts[o.status] || 0) + 1;
  });
  return counts;
});

const filterLabels = computed(() => ({
  all: t('orders.filters.all'),
  PAID: t('orders.filters.paid'),
  HANDED_OVER: t('orders.filters.active'),
  RETURNED: t('orders.filters.completed'),
}));

const emptyFilterLabel = computed(() => filterLabels.value[activeFilter.value] || activeFilter.value.toLowerCase());

onMounted(async () => {
  await loadOrders(1);
});

async function loadOrders(targetPage = page.value) {
  if (loadPromise) {
    return loadPromise;
  }

  loading.value = true;
  loadPromise = (async () => {
    try {
      const response = await fetchOrders({
        role: props.role,
        page: targetPage,
        pageSize: pageSize.value,
      });
      const items = response.data || response.items || response.orders || response.bookings || [];
      orders.value = items;

      const pagination = response.pagination || {};
      page.value = pagination.page || response.page || targetPage;
      total.value = pagination.total || response.total || items.length;
      totalPages.value =
        pagination.total_pages ||
        pagination.totalPages ||
        response.total_pages ||
        Math.max(1, Math.ceil(total.value / pageSize.value));
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      loading.value = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function showOrderDetails(order) {
  selectedOrder.value = order;
  const modalEl = document.getElementById('orderDetailsModal');
  if (modalEl) {
    const modal = new Modal(modalEl);
    modal.show();
  }
}

function closeModal() {
  const modalEl = document.getElementById('orderDetailsModal');
  if (modalEl) {
    const modal = Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
  selectedOrder.value = null;
}

function handleOrderUpdated() {
  loadOrders();
}

function goToPage(targetPage) {
  if (targetPage < 1 || targetPage > totalPages.value) return;
  loadOrders(targetPage);
}

function formatDate(dateString) {
  if (!dateString) return '';
  const formatLocale = locale.value || 'en-US';
  return new Date(dateString).toLocaleDateString(formatLocale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  const mainUnit = amount / 100;
  return `${mainUnit.toFixed(2)}`;
}

function formatPriceForBackend(amount) {
  // Convert display price to backend format (multiply by 100)
  return Math.round(amount * 100);
}

function getStatusColor(status) {
  const colors = {
    PENDING: 'warning',
    PAID: 'info',
    HANDED_OVER: 'primary',
    RETURNED: 'success',
    CANCELLED: 'danger',
  };
  return colors[status] || 'secondary';
}

function getStatusIcon(status) {
  const icons = {
    PENDING: 'clock',
    PAID: 'credit-card',
    HANDED_OVER: 'hand-thumbs-up',
    RETURNED: 'check-circle',
    CANCELLED: 'x-circle',
  };
  return icons[status] || 'circle';
}
</script>

<template>
  <div class="orders-list">
    <!-- Filters -->
    <div class="filter-tabs mb-4">
      <div class="btn-group" role="group">
        <input 
          type="radio" 
          class="btn-check" 
          id="filter-all" 
          value="all" 
          v-model="activeFilter"
        />
        <label class="btn btn-outline-primary" for="filter-all">
          All ({{ statusCounts.all || 0 }})
        </label>

        <input 
          type="radio" 
          class="btn-check" 
          id="filter-pending" 
          value="PENDING" 
          v-model="activeFilter"
        />
        <label class="btn btn-outline-warning" for="filter-pending">
          Pending ({{ statusCounts.PENDING || 0 }})
        </label>

        <input 
          type="radio" 
          class="btn-check" 
          id="filter-paid" 
          value="PAID" 
          v-model="activeFilter"
        />
        <label class="btn btn-outline-info" for="filter-paid">
          {{ $t('orders.filters.paid') }} ({{ statusCounts.PAID || 0 }})
        </label>

        <input 
          type="radio" 
          class="btn-check" 
          id="filter-active" 
          value="HANDED_OVER" 
          v-model="activeFilter"
        />
        <label class="btn btn-outline-primary" for="filter-active">
          {{ $t('orders.filters.active') }} ({{ statusCounts.HANDED_OVER || 0 }})
        </label>

        <input 
          type="radio" 
          class="btn-check" 
          id="filter-completed" 
          value="RETURNED" 
          v-model="activeFilter"
        />
        <label class="btn btn-outline-success" for="filter-completed">
          {{ $t('orders.filters.completed') }} ({{ statusCounts.RETURNED || 0 }})
        </label>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">{{ $t('common.loading') }}</span>
      </div>
    </div>

    <!-- Orders List -->
    <div v-else-if="filteredOrders.length > 0" class="row g-3">
      <div v-for="order in filteredOrders" :key="order.id" class="col-12">
        <div class="card order-card">
          <div class="card-body" @click="showOrderDetails(order)" style="cursor: pointer;">
            <div class="row align-items-center">
              <!-- Item Image & Info -->
              <div class="col-md-6">
                <div class="d-flex gap-3 align-items-center">
                  <router-link 
                    :to="{ name: 'item', params: { id: order.item?.id } }"
                    @click.stop
                    class="text-decoration-none"
                  >
                    <img
                      v-if="order.item?.photos?.[0]"
                      :src="getImageUrl(order.item.photos[0].url)"
                      class="rounded item-image"
                      width="80"
                      height="80"
                      style="object-fit: cover;"
                    />
                  </router-link>
                  <div class="flex-grow-1">
                    <router-link 
                      :to="{ name: 'item', params: { id: order.item?.id } }"
                      @click.stop
                      class="text-decoration-none"
                    >
                      <h6 class="mb-1 item-title-link">
                        {{ order.item?.title }}
                        <i class="bi bi-box-arrow-up-right ms-1 small"></i>
                      </h6>
                    </router-link>
                    <div class="text-muted small">
                      {{ formatDate(order.start) }} → {{ formatDate(order.end) }}
                    </div>
                    <div class="text-muted small">
                      {{ role === 'renter' ? $t('dashboard.owner') : $t('dashboard.renter') }}: 
                      <router-link
                        :to="{ name: 'search', query: { owner: role === 'renter' ? order.item?.owner?.id : order.renter?.id } }"
                        @click.stop
                        class="text-decoration-none user-name-link"
                      >
                        <i class="bi bi-person-circle me-1"></i>
                        {{ role === 'renter' ? order.item?.owner?.username : order.renter?.username }}
                      </router-link>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Status & Price -->
              <div class="col-md-3 text-center">
                <span class="badge rounded-pill" :class="`bg-${getStatusColor(order.status)}`">
                  <i class="bi me-1" :class="`bi-${getStatusIcon(order.status)}`"></i>
                  {{ $t(`orders.status.${order.status}`) }}
                </span>
              </div>

              <!-- Total -->
              <div class="col-md-3 text-end">
                <div class="h5 mb-0">{{ formatCurrency(order.priceTotal) }} {{ order.currency }}</div>
                <div class="small text-muted">{{ $t('orders.orderNumber', { id: order.id.slice(-8) }) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && totalPages > 1" class="mt-4 d-flex justify-content-center align-items-center gap-2">
      <button class="btn btn-outline-secondary btn-sm" :disabled="page <= 1" @click="goToPage(page - 1)">
        {{ $t('common.previous') }}
      </button>
      <span class="small text-muted">Page {{ page }} / {{ totalPages }}</span>
      <button class="btn btn-outline-secondary btn-sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">
        {{ $t('common.next') }}
      </button>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-5">
      <i class="bi bi-inbox display-4 text-muted mb-3 d-block"></i>
      <h5 class="text-muted">{{ $t('orders.emptyTitle') }}</h5>
      <p class="text-muted">
        {{ activeFilter === 'all' ? $t('orders.emptyBodyAll') : $t('orders.emptyBodyFiltered', { status: emptyFilterLabel }) }}
      </p>
      <router-link to="/search" class="btn btn-primary mt-2">
        <i class="bi bi-search me-2"></i>
        {{ $t('orders.browseItems') }}
      </router-link>
    </div>

    <!-- Order Details Modal -->
    <div class="modal fade" id="orderDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <OrderDetailsModal
          v-if="selectedOrder"
          :order="selectedOrder"
          @close="closeModal"
          @updated="handleOrderUpdated"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.item-image {
  transition: transform 0.2s ease;
  border: 2px solid transparent;
}

.item-image:hover {
  transform: scale(1.05);
  border-color: var(--bs-primary);
}

.item-title-link {
  color: var(--bs-dark);
  transition: color 0.2s ease;
}

.item-title-link:hover {
  color: var(--bs-primary);
}

.user-name-link {
  color: var(--bs-primary);
  transition: opacity 0.2s ease;
}

.user-name-link:hover {
  opacity: 0.8;
  text-decoration: underline !important;
}

.filter-tabs .btn-group {
  flex-wrap: wrap;
}

.filter-tabs .btn {
  border-radius: 0;
}

.filter-tabs .btn:first-child {
  border-top-left-radius: 0.375rem;
  border-bottom-left-radius: 0.375rem;
}

.filter-tabs .btn:last-child {
  border-top-right-radius: 0.375rem;
  border-bottom-right-radius: 0.375rem;
}
</style>

