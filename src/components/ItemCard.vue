<script setup>
import { computed, ref } from 'vue';
import { getItemPhotoUrl } from '../utils/imageUtils';
import { useUiStore } from '../stores/ui';
import http from '../lib/http';

const props = defineProps({
  item: { type: Object, required: true },
  editMode: { type: Boolean, default: false },
});

const emit = defineEmits(['photo-changed', 'update:item']);

const ui = useUiStore();
const photoInput = ref(null);
const uploadingPhoto = ref(false);

const thumbnailUrl = computed(() => {
  if (props.item.thumbnail) {
    return getItemPhotoUrl(props.item.thumbnail);
  }
  if (props.item.photos && props.item.photos.length > 0) {
    return getItemPhotoUrl(props.item.photos);
  }
  return null;
});

function formatPrice(amount) {
  // Backend sends prices in cents, so divide by 100 for display
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount / 100)
}

async function handlePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    ui.showToast('Invalid file type. Please upload JPEG, PNG, WebP, or GIF', 'danger');
    return;
  }

  // Validate file size (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    ui.showToast('File size too large. Maximum size is 5MB', 'danger');
    return;
  }

  uploadingPhoto.value = true;

  try {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('folder', 'items');

    const { data } = await http.post('/uploads/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });

    const photoUrl = data.urls?.[0];
    if (!photoUrl) {
      throw new Error('No photo URL returned');
    }

    // Add photo to item
    await http.post(`/items/${props.item.id}/photos`, {
      url: photoUrl,
      position: 0 // Set as primary photo
    });

    // Update local item data
    const updatedItem = {
      ...props.item,
      photos: [photoUrl, ...(props.item.photos || [])],
      thumbnail: photoUrl
    };

    emit('photo-changed', photoUrl);
    emit('update:item', updatedItem);
    ui.showToast('Photo updated successfully', 'success');
  } catch (error) {
    console.error('Photo upload error:', error);
    ui.showToast(error?.response?.data?.message || 'Failed to upload photo', 'danger');
  } finally {
    uploadingPhoto.value = false;
    // Reset input
    if (photoInput.value) {
      photoInput.value.value = '';
    }
  }
}

function triggerPhotoUpload() {
  photoInput.value?.click();
}
</script>

<template>
  <div class="item-card card h-100">
    <div class="card-image-wrapper position-relative">
      <div class="ratio ratio-16x9 bg-light">
        <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          class="card-image w-100 h-100 object-fit-cover"
          :alt="item.title"
        />
        <div v-else class="card-image-placeholder d-flex align-items-center justify-content-center">
          <i class="bi bi-image text-muted" style="font-size: 3rem;"></i>
        </div>
      </div>
      
      <!-- Edit Mode Photo Change Overlay -->
      <div v-if="editMode" class="photo-edit-overlay">
        <input
          ref="photoInput"
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          class="d-none"
          @change="handlePhotoChange"
        />
        <button
          type="button"
          class="btn btn-sm btn-light photo-change-btn"
          @click.stop="triggerPhotoUpload"
          :disabled="uploadingPhoto"
          title="Change photo"
        >
          <i v-if="uploadingPhoto" class="bi bi-hourglass-split"></i>
          <i v-else class="bi bi-camera"></i>
        </button>
      </div>
    </div>
    
    <div class="card-body d-flex flex-column">
      <h3 class="h6 card-title mb-1 text-truncate">{{ item.title }}</h3>
      <div class="small text-secondary d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
        <span class="text-truncate">{{ item.location || item.address || 'No location' }}</span>
        <span class="badge bg-secondary">{{ item.category }}</span>
      </div>
      <div v-if="item.distance" class="small text-primary mb-1">
        <i class="bi bi-geo-alt-fill me-1"></i>
        {{ item.distance.toFixed(1) }} km away
      </div>
      <div class="d-flex align-items-center justify-content-between mt-auto pt-2">
        <span class="fw-semibold text-nowrap">{{ formatPrice(item.pricePerDay || item.price_per_day) }}/day</span>
        <span class="small text-nowrap">
          <i class="bi bi-star-fill me-1 text-warning"></i>{{ item.rating ?? '—' }}
          <span class="text-secondary">({{ item.reviews_count ?? 0 }})</span>
        </span>
      </div>
      <router-link
        v-if="!editMode"
        class="stretched-link"
        :to="`/item/${item.id}`"
        aria-label="Open item"
      ></router-link>
    </div>
  </div>
</template>

<style scoped>
.item-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.125);
}

.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-image-wrapper {
  overflow: hidden;
  border-radius: 0.375rem 0.375rem 0 0;
}

.card-image {
  transition: transform 0.3s ease;
}

.item-card:hover .card-image {
  transform: scale(1.05);
}

.card-image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.photo-edit-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 0.375rem 0.375rem 0 0;
}

.card-image-wrapper:hover .photo-edit-overlay {
  opacity: 1;
}

.photo-change-btn {
  backdrop-filter: blur(4px);
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.photo-change-btn:hover {
  transform: scale(1.1);
  border-color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.photo-change-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.card-body {
  min-height: 140px;
}

/* Responsive improvements */
@media (max-width: 576px) {
  .card-body {
    padding: 0.75rem;
    min-height: 120px;
  }
  
  .card-title {
    font-size: 0.95rem;
  }
  
  .photo-change-btn {
    padding: 0.4rem 0.6rem;
    font-size: 0.875rem;
  }
}

@media (min-width: 577px) and (max-width: 768px) {
  .card-body {
    padding: 1rem;
  }
}

/* Ensure text doesn't overflow on small screens */
.text-truncate {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Better spacing for badges */
.badge {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
}
</style>
