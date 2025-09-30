<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUiStore } from '../stores/ui';
import { fetchListings, fetchCategories, fetchLocations } from '../services/listingsService';
import ItemCard from '../components/ItemCard.vue';
import PaginationBar from '../components/PaginationBar.vue';
import { useQuerySync } from '../composables/useQuerySync';
// import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel.vue' // if you prefer infinite scroll

const ui = useUiStore();

// URL-synced search state
const { state, setPatch, setPage, reset } = useQuerySync({
  q: '',
  category: '',
  location: '',
  price_min: '',
  price_max: '',
  date_from: '',
  date_to: '',
  sort: 'relevance',
  page: 1,
  per_page: 12,
});

const categories = ref([]);
const locations = ref([]);
const data = ref({ items: [], page: 1, per_page: 12, total: 0, total_pages: 1 });
const loading = ref(false);
const error = ref(null);

// Fetch meta
onMounted(async () => {
  try {
    [categories.value, locations.value] = await Promise.all([fetchCategories(), fetchLocations()]);
  } catch (e) {
    // non-blocking
  }
  await runSearch();
});

// Derived label
const resultsLabel = computed(() => {
  const t = data.value.total;
  if (t === 0) return 'No items found';
  const start = (data.value.page - 1) * data.value.per_page + 1;
  const end = Math.min(data.value.page * data.value.per_page, t);
  return `Showing ${start}–${end} of ${t}`;
});

async function runSearch() {
  loading.value = true;
  error.value = null;
  ui.setLoading(true);
  try {
    // Filter out empty parameters and zero price values before sending to API
    const params = Object.fromEntries(
      Object.entries(state.value).filter(([key, value]) => {
        // Filter out empty strings, null, undefined
        if (value === '' || value === null || value === undefined) {
          return false;
        }
        // Filter out zero price values (they would exclude all items)
        if ((key === 'price_min' || key === 'price_max') && value === 0) {
          return false;
        }
        return true;
      })
    );
    data.value = await fetchListings(params);
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load';
  } finally {
    loading.value = false;
    ui.setLoading(false);
  }
}

function applyFilters(ev) {
  ev?.preventDefault?.();
  setPage(1);
  runSearch();
}

function clearFilters() {
  reset();
  runSearch();
}

function onPageChange(p) {
  setPage(p);
  runSearch();
}

// If you want infinite scroll instead of the pager, keep an accumulator:
// - store all items in an array and append when sentinel becomes visible and page < total_pages.
</script>

<template>
  <h1 class="h4 mb-3">Search</h1>

  <div class="row g-3">
    <!-- Filters -->
    <div class="col-12 col-lg-3">
      <form class="card p-3" @submit.prevent="applyFilters">
        <h2 class="h6">Filters</h2>

        <div class="mb-3">
          <label class="form-label">Keyword</label>
          <input v-model="state.q" class="form-control" placeholder="drill, PS5, tent…" />
        </div>

        <div class="mb-3">
          <label class="form-label">Category</label>
          <select v-model="state.category" class="form-select">
            <option value="">Any</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="mb-3">
          <label class="form-label">Location</label>
          <select v-model="state.location" class="form-select">
            <option value="">Anywhere</option>
            <option v-for="l in locations" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>

        <div class="row g-2 mb-3">
          <div class="col">
            <label class="form-label">Price min</label>
            <input v-model.number="state.price_min" type="number" min="0" class="form-control" />
          </div>
          <div class="col">
            <label class="form-label">Price max</label>
            <input v-model.number="state.price_max" type="number" min="0" class="form-control" />
          </div>
        </div>

        <div class="row g-2 mb-3">
          <div class="col">
            <label class="form-label">From</label>
            <input v-model="state.date_from" type="date" class="form-control" />
          </div>
          <div class="col">
            <label class="form-label">To</label>
            <input v-model="state.date_to" type="date" class="form-control" />
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Sort by</label>
          <select v-model="state.sort" class="form-select">
            <option value="relevance">Relevance</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="rating_desc">Rating</option>
          </select>
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-primary" type="submit">
            <i class="bi bi-search me-1"></i> Apply
          </button>
          <button class="btn btn-outline-secondary" type="button" @click="clearFilters">Reset</button>
        </div>
      </form>
    </div>

    <!-- Results -->
    <div class="col-12 col-lg-9">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="small text-secondary">{{ resultsLabel }}</div>
        <div class="d-flex align-items-center gap-2">
          <label class="small text-secondary">Per page</label>
          <select
            v-model.number="state.per_page"
            class="form-select form-select-sm"
            style="width: auto"
            @change="applyFilters"
          >
            <option :value="12">12</option>
            <option :value="24">24</option>
            <option :value="48">48</option>
          </select>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
        <div v-for="item in data.items" :key="item.id" class="col">
          <ItemCard :item="item" />
        </div>

        <div v-if="!loading && data.items.length === 0" class="col-12">
          <div class="alert alert-warning">No items matched your filters.</div>
        </div>
      </div>

      <div class="mt-3">
        <PaginationBar :page="data.page" :total-pages="data.total_pages" @change="onPageChange" />
      </div>

      <!-- For infinite scroll alternative:
      <InfiniteScrollSentinel v-if="data.page < data.total_pages" @visible="() => { setPage(state.page + 1); runSearchAppend(); }" />
      -->
    </div>
  </div>
</template>
