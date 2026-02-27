<template>
  <div class="bookings-page">
    <div class="bookings-hero">
      <div>
        <p class="bookings-kicker">{{ $t('bookings.title') }}</p>
        <h1 class="bookings-title">{{ $t('bookings.title') }}</h1>
        <p class="bookings-subtitle">
          {{ $t('bookings.findItemsToRent') }}
        </p>
      </div>
      <router-link to="/search" class="btn btn-primary bookings-cta">
        <i class="bi bi-search me-2"></i>
        {{ $t('bookings.findItemsToRent') }}
      </router-link>
    </div>

    <div class="bookings-card">
      <div class="bookings-tabs">
        <button
          type="button"
          class="bookings-tab"
          :class="{ active: activeTab === 'renter' }"
          @click="setRole('renter')"
        >
          <i class="bi bi-box-arrow-in-right"></i>
          <span>{{ $t('bookings.myRentals') }}</span>
        </button>
        <button
          type="button"
          class="bookings-tab"
          :class="{ active: activeTab === 'owner' }"
          @click="setRole('owner')"
        >
          <i class="bi bi-box-arrow-up"></i>
          <span>{{ $t('bookings.itemsRentingOut') }}</span>
        </button>
      </div>

      <div class="bookings-body">
        <OrdersList v-if="activeTab === 'renter'" role="renter" :key="'renter'" />
        <OrdersList v-else role="owner" :key="'owner'" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import OrdersList from '../components/OrdersList.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const validRoles = ['renter', 'owner'];
const normalizeRole = (value) => {
  if (Array.isArray(value)) return value[0];
  return value;
};
const activeTab = ref(
  validRoles.includes(normalizeRole(route.query.role))
    ? normalizeRole(route.query.role)
    : 'renter'
);

function setRole(role) {
  if (!validRoles.includes(role) || activeTab.value === role) return;
  activeTab.value = role;
}

watch(
  () => activeTab.value,
  (role) => {
    router.replace({
      query: { ...route.query, role },
    });
  }
);

watch(
  () => route.query.role,
  (role) => {
    const normalized = normalizeRole(role);
    if (validRoles.includes(normalized)) {
      activeTab.value = normalized;
    }
  }
);
</script>

<style scoped>
.bookings-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.bookings-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem 2rem;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.bookings-kicker {
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin: 0 0 0.5rem;
}

.bookings-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
}

.bookings-subtitle {
  margin: 0.5rem 0 0;
  color: #64748b;
}

.bookings-cta {
  white-space: nowrap;
}

.bookings-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.bookings-tabs {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.bookings-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: transparent;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  color: #64748b;
  font-weight: 600;
  transition: all 0.2s ease;
}

.bookings-tab.active {
  background: #2563eb;
  color: #ffffff;
}

.bookings-body {
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .bookings-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .bookings-tabs {
    flex-direction: column;
  }
}

:global([data-bs-theme="dark"]) .bookings-hero,
:global([data-bs-theme="dark"]) .bookings-card {
  background: #0f172a;
  border-color: #1f2937;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

:global([data-bs-theme="dark"]) .bookings-title {
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .bookings-subtitle,
:global([data-bs-theme="dark"]) .bookings-kicker {
  color: #94a3b8;
}

:global([data-bs-theme="dark"]) .bookings-tabs {
  background: #111827;
  border-bottom-color: #1f2937;
}

:global([data-bs-theme="dark"]) .bookings-tab {
  color: #94a3b8;
}

:global([data-bs-theme="dark"]) .bookings-tab.active {
  background: #2563eb;
  color: #ffffff;
}
</style>

