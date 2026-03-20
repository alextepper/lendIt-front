<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useAuthModal } from '../composables/useAuthModal';
import { setPendingAction } from '../auth/pendingActions';
import ListingFormModal from '../components/ListingFormModal.vue';
import { createListing } from '../services/listingsService';
import { useUiStore } from '../stores/ui';
import http from '../lib/http';

const router = useRouter();
const auth = useAuthStore();
const { openLoginModal } = useAuthModal();
const ui = useUiStore();

const showModal = ref(true);

async function onSubmit(payload) {
  const { photoUrls, ...itemData } = payload;

  if (!auth.isAuthed) {
    // Store form data and prompt auth
    setPendingAction({
      type: 'CREATE_LISTING_WITH_DATA',
      payload: { itemData, photoUrls: photoUrls || [] },
    });
    openLoginModal('/create');
    showModal.value = false;
    ui.showToast('Please sign in to publish your listing', 'info');
    return;
  }

  try {
    let itemId;
    const createdItem = await createListing(itemData);
    itemId = createdItem.id;

    if (photoUrls && photoUrls.length > 0 && itemId) {
      try {
        for (let i = 0; i < photoUrls.length; i++) {
          await http.post(`/items/${itemId}/photos`, {
            url: photoUrls[i],
            position: i,
          });
        }
        ui.showToast('Listing created successfully', 'success');
      } catch (photoError) {
        console.error('Error adding photos:', photoError);
        ui.showToast('Item created but failed to add photos', 'warning');
      }
    } else {
      ui.showToast('Listing created successfully', 'success');
    }

    showModal.value = false;
    router.push({ name: 'my-listings' });
  } catch (e) {
    ui.showToast(e?.response?.data?.message || e.message, 'danger');
  }
}

function onClose() {
  showModal.value = false;
  router.push({ name: 'home' });
}

onMounted(() => {
  showModal.value = true;
});
</script>

<template>
  <div class="container py-4">
    <div class="text-center text-muted py-4" v-if="!showModal && !auth.isAuthed">
      <p class="mb-0">{{ $t('listing.signInToPublish') }}</p>
    </div>
    <ListingFormModal
      :model-value="showModal"
      @update:model-value="(v) => { showModal = v; if (!v) onClose(); }"
      :listing="null"
      @submit="onSubmit"
    />
  </div>
</template>
