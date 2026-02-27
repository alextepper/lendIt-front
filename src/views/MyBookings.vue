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
      <div class="bookings-curtains">
        <button
          type="button"
          class="bookings-curtain"
          :class="{ open: sections.renter }"
          @click="toggleSection('renter')"
        >
          <span class="bookings-curtain-title">
            <i class="bi bi-box-arrow-in-right"></i>
            {{ $t('bookings.myRentals') }}
          </span>
          <i class="bi" :class="sections.renter ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
        <div v-show="sections.renter" class="bookings-body">
          <OrdersList role="renter" :key="'renter'" />
        </div>

        <button
          type="button"
          class="bookings-curtain"
          :class="{ open: sections.owner }"
          @click="toggleSection('owner')"
        >
          <span class="bookings-curtain-title">
            <i class="bi bi-box-arrow-up"></i>
            {{ $t('bookings.itemsRentingOut') }}
          </span>
          <i class="bi" :class="sections.owner ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
        <div v-show="sections.owner" class="bookings-body">
          <OrdersList role="owner" :key="'owner'" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import OrdersList from '../components/OrdersList.vue';

const { t } = useI18n();

const sections = reactive({
  renter: true,
  owner: false,
});

function toggleSection(role) {
  if (!(role in sections)) return;
  sections[role] = !sections[role];
}
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

.bookings-curtains {
  display: flex;
  flex-direction: column;
}

.bookings-curtain {
  width: 100%;
  border: none;
  background: #f8fafc;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  color: #0f172a;
  transition: background 0.2s ease;
  border-bottom: 1px solid #e2e8f0;
}

.bookings-curtain-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.bookings-curtain.open {
  background: #eef2ff;
}

.bookings-body {
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .bookings-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .bookings-curtain {
    padding: 1rem;
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
::global([data-bs-theme="dark"]) .bookings-curtain {
  background: #111827;
  border-bottom-color: #1f2937;
  color: #f8fafc;
}

::global([data-bs-theme="dark"]) .bookings-curtain.open {
  background: #1f2937;
}
</style>

