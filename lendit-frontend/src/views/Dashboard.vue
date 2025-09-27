<script setup>
import { ref } from 'vue';
import DashboardTabs from '../components/DashboardTabs.vue';
import ProfilePanel from '../components/ProfilePanel.vue';
import ListingsPanel from '../components/ListingsPanel.vue';
import RentalsPanel from '../components/RentalsPanel.vue';

const tab = ref('listings'); // default; change to 'profile' if you prefer
</script>

<template>
  <h1 class="h4 mb-3">Dashboard</h1>
  <DashboardTabs v-model="tab" />

  <div v-show="tab === 'profile'">
    <ProfilePanel />
  </div>

  <div v-show="tab === 'listings'">
    <ListingsPanel />
  </div>

  <div v-show="tab === 'rentals'">
    <RentalsPanel />
  </div>
</template>
