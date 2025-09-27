<script setup>
import { onMounted, ref } from 'vue';
import StarRating from './StarRating.vue';
import { fetchAggregate, fetchReviews, createReview } from '../services/reviewsService';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import ReviewModal from './ReviewModal.vue';

const props = defineProps({ itemId: { type: [String, Number], required: true } });
const ui = useUiStore();
const auth = useAuthStore();

const agg = ref({ avg: 0, count: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
const data = ref({ items: [], page: 1, total_pages: 1 });
const loading = ref(true);
const showModal = ref(false);

async function load(page = 1) {
  loading.value = true;
  try {
    const [a, r] = await Promise.all([
      fetchAggregate(props.itemId),
      fetchReviews(props.itemId, { page, per_page: 6 })
    ]);
    agg.value = a;
    data.value = r;
  } finally { 
    loading.value = false; 
  }
}

onMounted(() => load(1));

async function onSubmitReview(payload) {
  try {
    await createReview(props.itemId, payload);
    ui.showToast('Thanks for your review!', 'success');
    load(1);
  } catch (e) {
    ui.showToast(e?.response?.data?.message || e.message, 'danger');
  }
}
</script>

<template>
  <div class="card p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h6 mb-0">Reviews ({{ agg.count }})</h2>
      <button v-if="auth.isAuthed" class="btn btn-sm btn-outline-primary" @click="showModal = true">
        <i class="bi bi-pencil-square me-1"></i>Write a review
      </button>
      <router-link v-else class="btn btn-sm btn-outline-primary" :to="{ name: 'login', query: { redirect: `/item/${props.itemId}` } }">
        Sign in to review
      </router-link>
    </div>

    <!-- Aggregate -->
    <div class="row g-3">
      <div class="col-md-4">
        <div class="border rounded p-3 text-center">
          <div class="display-6">{{ agg.avg?.toFixed?.(1) || '0.0' }}</div>
          <div class="mb-1"><StarRating :value="agg.avg" readonly size="1.25rem" /></div>
          <div class="small text-secondary">{{ agg.count }} total</div>
        </div>
      </div>
      <div class="col-md-8">
        <div v-for="s in [5, 4, 3, 2, 1]" :key="s" class="d-flex align-items-center gap-2 small">
          <span style="width: 20px">{{ s }}</span>
          <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="agg.breakdown?.[s] || 0" aria-valuemin="0" :aria-valuemax="agg.count || 1">
            <div class="progress-bar" :style="{ width: ((agg.breakdown?.[s] || 0) / (agg.count || 1)) * 100 + '%' }"></div>
          </div>
          <span class="text-secondary" style="width: 28px">{{ agg.breakdown?.[s] || 0 }}</span>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="mt-3">
      <div v-if="loading" class="small text-secondary">Loading…</div>
      <div v-else>
        <div v-for="r in data.items" :key="r.id" class="border-top py-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <img :src="r.user?.avatar" class="rounded-circle" width="32" height="32" alt="">
            <strong>{{ r.user?.name }}</strong>
            <span class="small text-secondary">{{ (r.created_at || '').slice(0, 10) }}</span>
          </div>
          <StarRating :value="r.rating" readonly />
          <p class="mb-0 mt-1">{{ r.comment }}</p>
        </div>

        <div class="d-flex justify-content-center gap-2 mt-3" v-if="data.total_pages > 1">
          <button class="btn btn-outline-secondary btn-sm" :disabled="data.page <= 1" @click="load(data.page - 1)">Prev</button>
          <span class="small text-secondary">Page {{ data.page }} / {{ data.total_pages }}</span>
          <button class="btn btn-outline-secondary btn-sm" :disabled="data.page >= data.total_pages" @click="load(data.page + 1)">Next</button>
        </div>
      </div>
    </div>
  </div>

  <ReviewModal v-model="showModal" @submit="onSubmitReview" />
</template>
