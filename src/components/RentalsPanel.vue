<script setup>
import { onMounted, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchRentals } from '../services/rentalsService';

const { t } = useI18n();
const rows = ref([]);
const filter = ref('all'); // all | incoming | outgoing
const loading = ref(true);

onMounted(async () => {
  try {
    rows.value = await fetchRentals();
  } finally {
    loading.value = false;
  }
});

const filtered = computed(() => {
  if (filter.value === 'all') return rows.value;
  return rows.value.filter((r) => r.role === filter.value);
});
</script>

<template>
  <div class="card p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h6 mb-0"></h2>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" :class="{ active: filter === 'all' }" @click="filter = 'all'">
          {{ $t('dashboard.all') }}
        </button>
        <button class="btn btn-outline-secondary" :class="{ active: filter === 'incoming' }" @click="filter = 'incoming'">
          {{ $t('dashboard.incomingRentals') }}
        </button>
        <button class="btn btn-outline-secondary" :class="{ active: filter === 'outgoing' }" @click="filter = 'outgoing'">
          {{ $t('dashboard.outgoingRentals') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="small text-secondary">{{ $t('dashboard.loadingRentals') }}</div>

    <div v-else class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th>{{ $t('dashboard.rentalId') }}</th>
            <th>{{ $t('dashboard.role') }}</th>
            <th>{{ $t('dashboard.item') }}</th>
            <th>{{ $t('dashboard.counterparty') }}</th>
            <th>{{ $t('dashboard.dates') }}</th>
            <th>{{ $t('dashboard.total') }}</th>
            <th>{{ $t('dashboard.statusLabel') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id">
            <td>{{ r.id }}</td>
            <td class="text-capitalize">{{ r.role === 'renter' ? $t('dashboard.renter') : $t('dashboard.owner') }}</td>
            <td><router-link :to="`/item/${r.item.id}`">{{ r.item.title }}</router-link></td>
            <td>{{ r.counterparty.name }}</td>
            <td>{{ r.date_from }} → {{ r.date_to }}</td>
            <td>${{ r.total }}</td>
            <td><span class="badge text-bg-secondary text-capitalize">{{ r.status }}</span></td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="7" class="text-center text-secondary small">{{ $t('dashboard.noRentalsYet') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
