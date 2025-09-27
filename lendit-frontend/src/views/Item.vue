<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { fetchItem, fetchRelated } from '../services/itemService';
import ImageGallery from '../components/ImageGallery.vue';
import PriceBox from '../components/PriceBox.vue';
import OwnerPanel from '../components/OwnerPanel.vue';
import RelatedItems from '../components/RelatedItems.vue';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();
const item = ref(null);
const related = ref([]);
const loading = ref(true);
const error = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const id = route.params.id;
    item.value = await fetchItem(id);
    related.value = await fetchRelated(id, 6);
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load item';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function onRequestBooking(payload) {
  // payload: { date_from, date_to, days, total }
  ui.showToast(`Request sent: ${payload.days} days · $${payload.total}`, 'success');
  // Navigate to checkout with prefilled query (you'll finalize flow in Prompt #8)
  router.push({ name: 'checkout', query: { id: item.value.id, ...payload } });
}
</script>

<template>
  <div class="mb-2">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb small">
        <li class="breadcrumb-item"><router-link to="/">Home</router-link></li>
        <li class="breadcrumb-item">
          <router-link :to="{ name: 'search', query: { category: item?.category } }">{{
            item?.category || 'Items'
          }}</router-link>
        </li>
        <li class="breadcrumb-item active" aria-current="page">{{ item?.title || 'Item' }}</li>
      </ol>
    </nav>
  </div>

  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div v-if="loading" class="text-center py-5">
    <div class="spinner-border" role="status"></div>
    <div class="small text-secondary mt-2">Loading item…</div>
  </div>

  <div v-else-if="item" class="row g-3">
    <div class="col-md-7">
      <ImageGallery :photos="item.photos" />

      <div class="card p-3 mt-3">
        <h2 class="h6 mb-2">About this item</h2>
        <p class="mb-0">{{ item.description }}</p>
      </div>
    </div>

    <div class="col-md-5">
      <div class="card p-3 mb-3">
        <div class="d-flex align-items-start justify-content-between">
          <div>
            <h1 class="h5 mb-1">{{ item.title }}</h1>
            <div class="small text-secondary d-flex gap-2 align-items-center">
              <span><i class="bi bi-geo-alt"></i> {{ item.location }}</span>
              <span>·</span>
              <span><i class="bi bi-star-fill"></i> {{ item.rating }} ({{ item.reviews_count }})</span>
            </div>
          </div>
          <div class="ms-auto d-flex gap-2">
            <button
              class="btn btn-sm btn-outline-secondary"
              @click="navigator.clipboard.writeText(location.href)"
            >
              <i class="bi bi-share"></i> Share
            </button>
            <button class="btn btn-sm btn-outline-danger" type="button">
              <i class="bi bi-flag"></i> Report
            </button>
          </div>
        </div>
      </div>

      <PriceBox :price-per-day="item.price_per_day" @request="onRequestBooking" />
      <div class="mt-3">
        <OwnerPanel :owner="item.owner" />
      </div>
    </div>

    <div class="col-12 mt-2">
      <RelatedItems :items="related" />
    </div>
  </div>
</template>
