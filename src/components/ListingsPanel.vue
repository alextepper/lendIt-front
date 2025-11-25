<script setup>
import { ref, onMounted } from 'vue';
import { fetchListings, createListing, updateListing, deleteListing } from '../services/listingsService';
import ListingFormModal from './ListingFormModal.vue';
import ItemCard from './ItemCard.vue';
import { useUiStore } from '../stores/ui';
import http from '../lib/http';

const ui = useUiStore();
const items = ref([]);
const page = ref(1);
const totalPages = ref(1);
const per = 12;
const showModal = ref(false);
const editing = ref(null);

async function load() {
  const { items: rows, total_pages } = await fetchListings({
    mine: true,
    page: page.value,
    pageSize: per,
  });
  items.value = rows;
  totalPages.value = total_pages;
}
onMounted(load);

function openNew() {
  editing.value = null;
  showModal.value = true;
}
function openEdit(it) {
  editing.value = it;
  showModal.value = true;
}

async function onSubmit(payload) {
  try {
    // Extract photoUrls from payload
    const { photoUrls, ...itemData } = payload;
    
    let itemId;
    if (editing.value) {
      await updateListing(editing.value.id, itemData);
      itemId = editing.value.id;
      ui.showToast('Listing updated', 'success');
    } else {
      const createdItem = await createListing(itemData);
      itemId = createdItem.id;
      ui.showToast('Listing created', 'success');
    }

    // Add photos to the item if there are any
    if (photoUrls && photoUrls.length > 0 && itemId) {
      try {
        for (let i = 0; i < photoUrls.length; i++) {
          await http.post(`/items/${itemId}/photos`, {
            url: photoUrls[i],
            position: i
          });
        }
        ui.showToast('Photos added successfully', 'success');
      } catch (photoError) {
        console.error('Error adding photos:', photoError);
        ui.showToast('Item created but failed to add photos', 'warning');
      }
    }

    await load();
  } catch (e) {
    ui.showToast(e?.response?.data?.message || e.message, 'danger');
  }
}

async function remove(it) {
  if (!confirm('Delete this listing?')) return;
  try {
    await deleteListing(it.id);
    ui.showToast('Listing deleted', 'success');
    await load();
  } catch (e) {
    ui.showToast('Failed to delete', 'danger');
  }
}

function handlePhotoChanged(itemId) {
  // Reload items to get updated photo
  load();
}

function handleItemUpdate(itemId, updatedItem) {
  // Update the item in the local array
  const index = items.value.findIndex(it => it.id === itemId);
  if (index !== -1) {
    items.value[index] = updatedItem;
  }
}
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <h2 class="h6 mb-0">My Listings</h2>
    <button class="btn btn-primary btn-sm" @click="openNew">
      <i class="bi bi-plus-lg me-1"></i>New
    </button>
  </div>

  <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
    <div v-for="it in items" :key="it.id" class="col">
      <div class="position-relative">
        <ItemCard 
          :item="it" 
          :edit-mode="true"
          @photo-changed="handlePhotoChanged(it.id)"
          @update:item="handleItemUpdate(it.id, $event)"
        />
        <div class="position-absolute top-0 end-0 p-2 d-flex gap-1" style="z-index: 10;">
          <button class="btn btn-light btn-sm shadow-sm" @click="openEdit(it)" title="Edit listing">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-light btn-sm shadow-sm" @click="remove(it)" title="Delete listing">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-3 text-center" v-if="totalPages > 1">
    <button class="btn btn-outline-secondary btn-sm me-2" :disabled="page <= 1" @click="page--; load()">
      Prev
    </button>
    <span class="small text-secondary">Page {{ page }} / {{ totalPages }}</span>
    <button class="btn btn-outline-secondary btn-sm ms-2" :disabled="page >= totalPages" @click="page++; load()">
      Next
    </button>
  </div>

  <ListingFormModal v-model="showModal" :listing="editing" @submit="onSubmit" />
</template>
